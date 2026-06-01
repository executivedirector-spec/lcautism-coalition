---
description: Save the current change to a PREVIEW link (not live yet)
---

The operator wants to PREVIEW the change you just made before it goes live. Nothing should go live in this command.

Follow these steps:

1. Run `git diff` and summarize, in plain English, exactly what changed (per CLAUDE.md rule 8). Show it to the operator.
2. Make sure you are NOT on the `main` branch. If you are on `main`, create/switch to a branch named `edits` first (`git switch -c edits` or `git switch edits` if it exists).
3. Stage ONLY the file(s) you changed and commit with a plain-English message (no jargon, no "feat:"/"chore:" — see CLAUDE.md rule 2).
4. Push the branch: `git push -u origin <branch-name>`.
5. Vercel automatically builds a preview for this branch. Tell the operator the preview will be ready in about a minute, and give them the preview URL. The pattern is:
   `https://lcautism-coalition-git-<branch-name>-benfreemn-dels-projects.vercel.app`
   (If a Vercel comment on the PR shows the exact URL, use that.)
6. Remind them clearly: **"This is NOT live yet. Look it over on the preview link, and when it looks right, just say 'push live'."**

Do NOT merge to `main` in this command. If any git step errors, STOP and tell the operator to text Ben (CLAUDE.md).
