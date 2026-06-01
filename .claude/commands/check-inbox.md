---
description: Check your email inbox for pending draft replies waiting for approval
---

Michelle wants to see her pending email draft replies from the LCAC email co-pilot.

1. Read the Supabase credentials from `.env.local`:
   - `SUPABASE_URL` (should be `https://byxuapnhhuxekamgnwaf.supabase.co`)
   - `SUPABASE_SERVICE_ROLE_KEY`

2. If `SUPABASE_SERVICE_ROLE_KEY` is missing from `.env.local`, stop and say:
   "The email inbox isn't connected yet — Ben still needs to finish setting that up. You can still use /draft-reply to paste in an email and I'll write a reply for you!"

3. If the key exists, query the `queued_replies` table using PowerShell:
   ```powershell
   $url = (Get-Content .env.local | Select-String "SUPABASE_URL").ToString().Split("=")[1]
   $key = (Get-Content .env.local | Select-String "SUPABASE_SERVICE_ROLE_KEY").ToString().Split("=")[1]
   $h = @{ apikey = $key; Authorization = "Bearer $key" }
   $res = Invoke-RestMethod -Uri "$url/rest/v1/queued_replies?status=eq.pending&order=created_at.desc" -Headers $h
   $res | ConvertTo-Json
   ```

4. Show the results in a friendly, plain-English format:
   - How many pending drafts are waiting
   - For each one: who it's from, the subject, and the draft reply
   - Ask: "Want me to mark any of these approved, or make edits first?"

5. If she wants to edit a draft before approving, make the edit inline and show her the updated version.

6. If she says "approve" or "send" for a draft, remind her:
   "Approving happens in the CRM inbox tab for now — go to [CRM URL] and click Approve next to this one. Ben is working on letting me do it directly from here!"
