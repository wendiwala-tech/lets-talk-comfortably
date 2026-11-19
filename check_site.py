#!/usr/bin/env python3
"""Check story behavior and the generated site's content/link integrity.

Run `python3 build.py` first, then `python3 check_site.py`.
Uses only the Python standard library and never changes site files.
"""

from collections import Counter
from functools import lru_cache
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
SLUGS = ("consent-boundaries", "protection", "preferences", "sexual-health")
PHASES = (
    "Opening", "Clarifying", "Misunderstanding", "Different needs",
    "Next steps", "Decision",
)
RESOURCE_KEYS = {"uhs", "shep", "care"}
PUBLIC_WORDING = re.compile(r"\bfictional\b", re.IGNORECASE)


class CheckError(Exception):
    """A useful, user-facing validation failure."""


def require(condition, message):
    if not condition:
        raise CheckError(message)


def unique_object(pairs):
    """Reject duplicate JSON keys before they can silently overwrite an ID."""
    result = {}
    for key, value in pairs:
        require(key not in result, f"Duplicate JSON key: {key!r}")
        result[key] = value
    return result


def read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=unique_object)
    except (OSError, ValueError, CheckError) as exc:
        raise CheckError(f"{path.relative_to(ROOT)}: {exc}") from exc


def fields(obj, required, location):
    require(isinstance(obj, dict), f"{location}: expected an object")
    missing = set(required) - obj.keys()
    require(not missing, f"{location}: missing fields {sorted(missing)}")


def text(value, location, allow_empty=False):
    require(isinstance(value, str), f"{location}: expected text")
    require(allow_empty or bool(value.strip()), f"{location}: text is empty")
    require(not PUBLIC_WORDING.search(value), f"{location}: contains unwanted public wording")


def check_story(slug):
    story = read_json(ROOT / "stories" / f"{slug}.json")
    fields(story, ("title", "subtitle", "setting", "characters", "goal", "entry", "nodes", "endings"), slug)
    for key in ("title", "subtitle", "setting", "goal", "entry"):
        text(story[key], f"{slug}.{key}")
    characters = story["characters"]
    require(isinstance(characters, list) and len(characters) >= 2, f"{slug}: expected at least two characters")
    for index, character in enumerate(characters):
        where = f"{slug}.characters[{index}]"
        fields(character, ("name", "description"), where)
        for key in ("name", "description"):
            text(character[key], f"{where}.{key}")

    nodes, endings = story["nodes"], story["endings"]
    require(isinstance(nodes, dict) and len(nodes) >= 12, f"{slug}: expected at least 12 story nodes")
    require(isinstance(endings, dict) and len(endings) >= 3, f"{slug}: expected at least three endings")
    require(not (nodes.keys() & endings.keys()), f"{slug}: a node ID is also used by an ending")
    require(story["entry"] in nodes, f"{slug}: entry does not identify a story node")
    for identifier in (*nodes, *endings):
        require(isinstance(identifier, str) and bool(identifier.strip()), f"{slug}: empty or invalid ID")

    for identifier, node in nodes.items():
        where = f"{slug}.{identifier}"
        fields(node, ("round", "phase", "title", "situation", "partner", "prompt", "choices"), where)
        round_number = node["round"]
        require(type(round_number) is int and 1 <= round_number <= 6, f"{where}: round must be 1–6")
        require(node["phase"] == PHASES[round_number - 1], f"{where}: phase does not match round")
        for key in ("title", "situation", "prompt"):
            text(node[key], f"{where}.{key}")
        text(node["partner"], f"{where}.partner", allow_empty=True)
        choices = node["choices"]
        require(isinstance(choices, list) and 2 <= len(choices) <= 3, f"{where}: expected two or three choices")
        targets = []
        for index, choice in enumerate(choices):
            choice_where = f"{where}.choices[{index}]"
            fields(choice, ("label", "response", "explanation", "next"), choice_where)
            for key in ("label", "response", "explanation", "next"):
                text(choice[key], f"{choice_where}.{key}")
            target = choice["next"]
            targets.append(target)
            require(target in nodes or target in endings, f"{choice_where}: unknown target {target!r}")
        require(len(targets) == len(set(targets)), f"{where}: choices merge immediately instead of branching")

    for identifier, ending in endings.items():
        where = f"{slug}.{identifier}"
        fields(ending, ("title", "summary", "takeaways", "reflection", "resourceKeys"), where)
        for key in ("title", "summary", "reflection"):
            text(ending[key], f"{where}.{key}")
        takeaways = ending["takeaways"]
        require(isinstance(takeaways, list) and len(takeaways) == 3, f"{where}: expected three takeaways")
        for index, takeaway in enumerate(takeaways):
            text(takeaway, f"{where}.takeaways[{index}]")
        keys = ending["resourceKeys"]
        require(isinstance(keys, list) and keys, f"{where}: resourceKeys must be a nonempty list")
        require(all(isinstance(key, str) for key in keys), f"{where}: resource keys must be strings")
        require(set(keys) <= RESOURCE_KEYS, f"{where}: unknown resource keys {set(keys) - RESOURCE_KEYS}")
        require(len(keys) == len(set(keys)), f"{where}: duplicate resource keys")

    # Check cycles independently of the round progression, including unreachable nodes.
    colors = {}

    def visit(identifier, trail):
        if identifier in endings or colors.get(identifier) == "done":
            return
        require(colors.get(identifier) != "active", f"{slug}: cycle {' -> '.join(trail + [identifier])}")
        colors[identifier] = "active"
        for choice in nodes[identifier]["choices"]:
            visit(choice["next"], trail + [identifier])
        colors[identifier] = "done"

    for identifier in nodes:
        visit(identifier, [])

    reachable = set()

    def mark_reachable(identifier):
        if identifier in reachable:
            return
        reachable.add(identifier)
        if identifier in nodes:
            for choice in nodes[identifier]["choices"]:
                mark_reachable(choice["next"])

    mark_reachable(story["entry"])
    unreachable = (nodes.keys() | endings.keys()) - reachable
    require(not unreachable, f"{slug}: unreachable IDs {sorted(unreachable)}")
    require(nodes[story["entry"]]["round"] == 1, f"{slug}: entry must start at round one")
    for identifier, node in nodes.items():
        for choice in node["choices"]:
            target = choice["next"]
            if target in nodes:
                require(nodes[target]["round"] == node["round"] + 1,
                        f"{slug}: {identifier} -> {target} does not advance exactly one round")
            else:
                require(node["round"] == 6, f"{slug}: {identifier} ends the story before round six")

    @lru_cache(maxsize=None)
    def path_lengths(identifier):
        if identifier in endings:
            return frozenset({0})
        return frozenset(1 + length for choice in nodes[identifier]["choices"]
                         for length in path_lengths(choice["next"]))

    @lru_cache(maxsize=None)
    def path_count(identifier):
        if identifier in endings:
            return 1
        return sum(path_count(choice["next"]) for choice in nodes[identifier]["choices"])

    lengths = path_lengths(story["entry"])
    require(lengths == {6}, f"{slug}: complete path lengths are {sorted(lengths)}, expected only six")
    print(f"PASS story {slug}: {len(nodes)} nodes, {len(endings)} endings, "
          f"{path_count(story['entry'])} paths; all six rounds and reachable")
    return story


def check_support():
    """Check all 24 warm-ups before the page payloads reach the browser."""
    support = read_json(ROOT / "practice-support.json")
    require(isinstance(support, dict) and set(support) == set(SLUGS),
            "practice-support.json: expected exactly the four story module keys")
    interaction_count = choice_count = 0
    for slug in SLUGS:
        rounds = support[slug]
        require(isinstance(rounds, list) and len(rounds) == 6,
                f"support.{slug}: expected six interactions in round order")
        for index, activity in enumerate(rounds, start=1):
            where = f"support.{slug}.round{index}"
            fields(activity, ("title", "prompt", "hint", "humor", "choices"), where)
            require(set(activity) == {"title", "prompt", "hint", "humor", "choices"},
                    f"{where}: unexpected support fields")
            for key in ("title", "prompt", "hint", "humor"):
                text(activity[key], f"{where}.{key}")
            require(len(activity["humor"]) <= 100, f"{where}: humor exceeds 100 characters")
            choices = activity["choices"]
            require(isinstance(choices, list) and len(choices) == 3,
                    f"{where}: expected exactly three tap choices")
            labels, responses = [], []
            for choice_index, choice in enumerate(choices, start=1):
                choice_where = f"{where}.choice{choice_index}"
                fields(choice, ("label", "response"), choice_where)
                require(set(choice) == {"label", "response"},
                        f"{choice_where}: unexpected choice fields")
                for key in ("label", "response"):
                    text(choice[key], f"{choice_where}.{key}")
                require(len(choice["label"]) <= 80,
                        f"{choice_where}: label exceeds 80 characters")
                response_words = len(choice["response"].split())
                require(20 <= response_words <= 40,
                        f"{choice_where}: expected 20–40 response words, found {response_words}")
                labels.append(" ".join(choice["label"].split()).casefold())
                responses.append(" ".join(choice["response"].split()).casefold())
            require(len(set(labels)) == 3, f"{where}: choices need three distinct labels")
            require(len(set(responses)) == 3, f"{where}: choices need three distinct responses")
            interaction_count += 1
            choice_count += len(choices)
    print(f"PASS support: four modules, {interaction_count} round-specific interactions, "
          f"{choice_count} tap choices with distinct responses")
    return support


class SitePage(HTMLParser):
    """Collect the static DOM facts needed for content and link checks."""

    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.h1_count = 0
        self.ids = Counter()
        self.references = []
        self.public_text = []
        self.typing_controls = []
        self.script_chunks = []
        self.scenario_script_count = 0
        self.raw_tag = None
        self.capture_scenario = False
        self.feed(path.read_text(encoding="utf-8"))
        self.close()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "textarea":
            self.typing_controls.append("textarea")
        if tag == "input" and attrs.get("type", "text").lower() not in {
            "button", "checkbox", "radio", "range", "submit", "reset", "image", "hidden"
        }:
            self.typing_controls.append(f"input[type={attrs.get('type', 'text')}]")
        if "contenteditable" in attrs and attrs["contenteditable"] != "false":
            self.typing_controls.append("contenteditable")
        if tag == "h1":
            self.h1_count += 1
        if attrs.get("id"):
            self.ids[attrs["id"]] += 1
        for key in ("href", "src"):
            if key in attrs and attrs[key] is not None:
                self.references.append((tag, key, attrs[key]))
        for key in ("alt", "title", "aria-label", "placeholder"):
            if attrs.get(key):
                self.public_text.append(attrs[key])
        if tag in ("script", "style"):
            self.raw_tag = tag
        if tag == "script" and attrs.get("id") == "scenario-data":
            require(attrs.get("type") == "application/json", f"{self.path.name}: scenario-data is not JSON")
            self.capture_scenario = True
            self.scenario_script_count += 1

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag == self.raw_tag:
            self.raw_tag = None
        if tag == "script":
            self.capture_scenario = False

    def handle_data(self, value):
        if self.capture_scenario:
            self.script_chunks.append(value)
        elif self.raw_tag is None:
            self.public_text.append(value)


def local_target(page_path, value):
    """Resolve web-root paths against dist, not against the computer's root."""
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc:
        return None
    decoded_path = unquote(parsed.path)
    if not decoded_path:
        target = page_path
    elif decoded_path.startswith("/"):
        target = DIST / decoded_path.lstrip("/")
    else:
        target = page_path.parent / decoded_path
    target = target.resolve()
    require(target.is_relative_to(DIST.resolve()), f"{page_path.name}: local URL escapes dist: {value!r}")
    if target.is_dir() or decoded_path.endswith("/"):
        target = target / "index.html"
    return target, unquote(parsed.fragment)


def check_html(stories, support):
    expected_names = {"index.html", "resources.html", *(f"{slug}.html" for slug in SLUGS)}
    actual_names = {str(path.relative_to(DIST)) for path in DIST.rglob("*.html")}
    require(actual_names == expected_names,
            f"HTML page set differs: missing {sorted(expected_names - actual_names)}; "
            f"unexpected {sorted(actual_names - expected_names)}")
    pages = {path.resolve(): SitePage(path) for path in sorted(DIST.glob("*.html"))}
    content = read_json(ROOT / "content.json")
    require(isinstance(content.get("scenarios"), list), "content.json: scenarios must be a list")
    titles = {scenario["slug"]: scenario["title"] for scenario in content["scenarios"]}
    require(set(titles) == set(SLUGS), "content.json: scenario slugs do not match the four stories")
    reference_count = 0
    loaded_scripts = set()
    for path, page in pages.items():
        require(page.h1_count == 1, f"{path.name}: found {page.h1_count} h1 elements, expected one")
        duplicate_ids = [identifier for identifier, count in page.ids.items() if count > 1]
        require(not duplicate_ids, f"{path.name}: duplicate HTML IDs {duplicate_ids}")
        require(not PUBLIC_WORDING.search(" ".join(page.public_text)),
                f"{path.name}: unwanted wording appears in visible text or an accessible label")
        require(not page.typing_controls, f"{path.name}: typing controls found: {page.typing_controls}")

        slug = path.stem
        if slug in stories:
            require(page.scenario_script_count == 1, f"{path.name}: expected one embedded scenario-data script")
            try:
                embedded = json.loads("".join(page.script_chunks), object_pairs_hook=unique_object)
            except (ValueError, CheckError) as exc:
                raise CheckError(f"{path.name}: invalid embedded story JSON: {exc}") from exc
            require(embedded == {"title": titles[slug], "slug": slug,
                                 "story": stories[slug], "support": support[slug]},
                    f"{path.name}: embedded story/support differs from source JSON; rebuild the site")
        else:
            require(page.scenario_script_count == 0, f"{path.name}: unexpected embedded story")

        for tag, attribute, value in page.references:
            resolved = local_target(path, value)
            if resolved is None:
                continue
            reference_count += 1
            target, fragment = resolved
            require(target.is_file(), f"{path.name}: broken {tag}[{attribute}] {value!r}")
            if tag == "script" and attribute == "src":
                loaded_scripts.add(target)
            # Only static links are checked; links generated by JavaScript are not parsed.
            if fragment and target.suffix.lower() == ".html":
                require(target in pages, f"{path.name}: HTML target is outside the expected page set: {value!r}")
                require(fragment in pages[target].ids,
                        f"{path.name}: missing anchor #{fragment} in {target.name} ({value!r})")
        print(f"PASS HTML {path.name}: one h1, unique IDs, wording, links, assets, and story payload")
    # Inspect only scripts loaded by these pages, not abandoned/generated backups.
    # Dynamic controls still need the keyboard/interaction checks in the session guide.
    textarea_pattern = re.compile(
        r"<textarea\b|(?:createElement|el)\s*\(\s*['\"]textarea['\"]", re.IGNORECASE
    )
    for script in loaded_scripts:
        require(not textarea_pattern.search(script.read_text(encoding="utf-8")),
                f"{script.relative_to(DIST)}: script creates a textarea in a tap-only experience")
    print(f"PASS tap-only controls: static pages and {len(loaded_scripts)} loaded scripts")
    print(f"PASS site: {len(pages)} pages; {reference_count} local href/src references checked")


def main():
    try:
        stories = {slug: check_story(slug) for slug in SLUGS}
        support = check_support()
        check_html(stories, support)
    except (CheckError, OSError, KeyError, TypeError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1
    print("All story and generated-site checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
