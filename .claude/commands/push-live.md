---
description: Make the previewed change LIVE on the real website
---

The operator has reviewed the preview and wants to make it LIVE on lcautism.org.

FIRST, confirm out loud: **"Just to confirm — you want this live on the real website now? Type 'yes' to send it live."** Wait for "yes" (CLAUDE.md rule 3). If they say no, stop and do nothing.

Once they confirm:

1. Make sure the current change is committed and pushed on the working branch (run `/preview` first if it isn't).
2. Switch to main and update it: `git switch main` then `git pull origin main`.
3. Merge the working branch into main: `git merge <branch-name>`.
4. Push main live: `git push origin main`.
5. Switch back to the working branch: `git switch <branch-name>`.
6. Tell the operator: **"Pushed! The website should update in about 60 seconds. Want to make another change?"**

If ANY git step errors — a merge conflict, an auth failure, anything red — STOP immediately. Do not force, do not `--hard`, do not retry blindly. Tell the operator: "I hit an error pushing. Could you text Ben?" (CLAUDE.md rule on push failures).
