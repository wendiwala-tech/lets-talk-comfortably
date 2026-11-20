# Let’s Talk Comfortably


PBHLTH 182 Group 103-3: an interactive sexual-health communication practice website.


Live website: https://lets-talk-comfortably.netlify.app/


## Edit the website


- `content.json`: topic explanations and learning content.
- `stories/*.json`: the four branching, six-round conversations. Every node and choice has a reviewed `comicExpression` for its own partner line/reply.
- `practice-support.json`: hints, humor, and optional interactions.
- `relationships.json`: character profiles and illustration mappings.
- `photos.json`: editorial photography, credits, display positions, and source/license links.
- `build.py`: page templates.
- `dist/assets/`: CSS, JavaScript, and illustrations.
- `dist/assets/compact.css`: compact practice presentation, using the existing reading styles.
- `dist/assets/rewards.js` and `rewards.css`: a per-story conversation map based on optional choice `moveTags`.
- `dist/assets/comic.js` and `comic.css`: speaker-specific illustrated dialogue, including the selected mixed-pair role. New dialogue needs one of `hesitant`, `asking`, `concerned`, `explaining`, `boundary`, or `warm`; choose from the actual line, not reward tags or the next scene. Unmapped lines remain text-only until reviewed.


Edit the source JSON or templates rather than generated HTML. Run:


```sh
python3 build.py
python3 check_site.py
node check_path.cjs
node check_relationships.cjs --assets
node check_rewards.cjs
node check_comics.cjs --assets
```


Preview locally with `python3 -m http.server 8765 --directory dist` and open http://localhost:8765.
Commit the source changes and rebuilt `dist/` together. Use a branch and pull request when collaborating.


## Publication


Netlify is connected to this repository. Every push or merged pull request to `main` triggers an automatic build with `python3 build.py` and publishes `dist/` to https://lets-talk-comfortably.netlify.app/ after a successful build. The build settings are stored in `netlify.toml`.

For collaboration, create a branch, edit the source files, and open a pull request. Merge into `main` when ready to publish. Check Netlify deployment status before sharing a new version. No manual file upload is needed.


## Project notes


Exercises use point-and-click choices. Practice settings stay in the browser tab; the website does not upload participants’ exercise answers. Actual usability-study results must come from real participants; the testing guide contains no fabricated results. Photography credits are on the Resources page; original source links and license notes are in `photos.json` and `photo-provenance.txt`. Illustration generation records are included in the provenance files. Editorial photos stay separate from the named comic characters.

