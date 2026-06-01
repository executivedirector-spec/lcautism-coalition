# Windows Setup — Get Mom's PC Ready (Claude Code + CRM + Voice)

For Ben to follow on Michelle's Windows computer. Prereqs confirmed: she has a **Claude Pro/Max** plan ✅ and a **GitHub account** ✅. Project goes in **`Documents\LCAC`**.

> Goal: she can talk to Claude Code, preview a change, and say "push live" — plus open her CRM and use voice typing.

---

## Step 1 — Give her GitHub push access (do this first, on github.com)
- Repo **Settings → Collaborators → Add people** → add her GitHub username → she accepts the email invite.

## Step 2 — Install Git for Windows
- Download from **https://gitforwindows.org** → run installer → accept defaults (this also installs **Git Credential Manager**, which makes her GitHub login a simple browser popup later).

## Step 3 — Install Claude Code
Open **PowerShell** (Start → type "PowerShell") and run:
```powershell
irm https://claude.ai/install.ps1 | iex
```
(Alternative if that doesn't work: install **Node.js LTS** from nodejs.org, then `npm install -g @anthropic-ai/claude-code`. Latest instructions: https://code.claude.com/docs)
- Close and reopen PowerShell after it finishes.

## Step 4 — Sign her into Claude Code
- Run `claude` once → it opens a browser → log in with **her Pro/Max account** → approve. Done.

## Step 5 — Clone the website into Documents\LCAC
In PowerShell:
```powershell
cd "$HOME\Documents"
git clone https://github.com/benfreemn-del/lcautism-coalition.git LCAC
cd LCAC
claude
```
- That last `claude` launches Claude Code **inside the project**, so her shortcuts (`/morning-brief`, `/add-event`, `/preview`, `/push-live`, etc.) and `CLAUDE.md` all load automatically.

## Step 6 — First push authorizes GitHub
- The first time she pushes (or run `git pull` now), Git Credential Manager pops a browser → she logs into GitHub → it remembers her. No tokens to manage.

## Step 7 — Create her CRM login
- Supabase dashboard → **lcac-crm** project → **Authentication → Users → Add user** → her email + a password.
- That's the login for the CRM dashboard at `/crm-admin/` (e.g. `lcautism.org/crm-admin/` once live).

## Step 8 — Install WhisperFlow (voice typing)
- Install the WhisperFlow Windows app → set its push-to-talk keyboard shortcut → test it in any text box.

## Step 9 — Test it together (5 minutes)
1. In the `LCAC` folder with `claude` running, type `/morning-brief` → she sees today's summary.
2. Make a tiny real edit (e.g. fix a word) → type `/preview` → open the link Claude gives → confirm it looks right.
3. Type `/push-live` → confirm → it's live in ~60s.
4. Open `/crm-admin/`, sign in, click around the Contacts/Inbox/Grants tabs.

---

## What she ends up with
- **3 logins:** Claude (Pro/Max), GitHub (push access), Supabase CRM.
- **Talk-to-edit website** with preview-then-live safety.
- **Her shortcuts** for events, photos, thank-yous, grants.
- **A CRM** at `/crm-admin/` (grants pipeline already pre-loaded).
- **Voice typing** everywhere via WhisperFlow.

## Common snags
- *`claude` not recognized after install* → close/reopen PowerShell (PATH needs a refresh).
- *Push asks for username/password forever* → that's Git Credential Manager; make sure she completes the **browser** login, and that she's accepted the collaborator invite (Step 1).
- *CRM shows nothing after login* → confirm the user was created in the **lcac-crm** project (Step 7), not a different project.
