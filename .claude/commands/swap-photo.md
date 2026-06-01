---
description: Replace a photo on a page with a new one
---

Help the operator swap a photo on the website.

1. Ask which page and which photo they want to replace (e.g. "the big photo at the top of the homepage").
2. Ask for the new photo's file name and where it is (e.g. on the Desktop), plus a one-line description of what it shows (for the alt text).
3. Check the new photo is a JPG or PNG, under 500KB, and no wider than 1600px. If it's bigger, ask them to resize it at https://tinypng.com first — do NOT try to compress it yourself (CLAUDE.md).
4. Place/confirm the file in `assets/images/` and update the `src=""` (and the `alt=""`) in the right HTML file.
5. Show the change in plain English, then offer to run `/preview` so they can see it before it goes live.
