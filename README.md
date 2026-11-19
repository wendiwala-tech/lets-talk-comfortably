# Let’s Talk Comfortably

PBHLTH 182 Group 103-3: an interactive sexual-health communication practice website.

Live website: https://lets-talk-comfortably.netlify.app/

## Edit the website

- `content.json`: topic explanations and learning content.
- `stories/*.json`: the four branching, six-round conversations.
- `practice-support.json`: hints, humor, and optional interactions.
- `relationships.json`: character profiles and illustration mappings.
- `build.py`: page templates.
- `dist/assets/`: CSS, JavaScript, and illustrations.

Edit the source JSON or templates rather than generated HTML. Run:

```sh
python3 build.py
python3 check_site.py
node check_path.cjs
node check_relationships.cjs --assets
```

Preview locally with `python3 -m http.server 8765 --directory dist` and open http://localhost:8765.
Commit the source changes and rebuilt `dist/` together. Use a branch and pull request when collaborating.

## Publication

The current Netlify website was uploaded manually. GitHub edits do not automatically update the live website until this repository is connected in Netlify. The included `netlify.toml` provides the build settings for that connection. Until then, publish the updated `dist/` folder to the existing Netlify project.

## Project notes

Exercises use point-and-click choices. Practice settings stay in the browser tab; the website does not upload participants’ exercise answers. Actual usability-study results must come from real participants; the testing guide contains no fabricated results. Illustration generation records are included in the provenance files.
