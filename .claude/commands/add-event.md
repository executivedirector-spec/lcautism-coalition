---
description: Add a new event to the events page
---

Help the operator add a new event to `pages/events.html`.

1. Collect the details. Ask for anything missing:
   - Date (and time)
   - Event name
   - Location
   - Short description
   - Does it need an RSVP button? (yes/no)
   - Is there a YouTube video? (optional)
   - Is there a flyer PDF? (optional — if so, where is the file?)
2. Build the event card using the `data-event-*` pattern documented in `README.md` (date as `YYYY-MM-DD`, name, optional video embed, optional flyer in `assets/flyers/`, RSVP toggle).
3. If they gave a YouTube "watch" URL, convert it to the embed format automatically.
4. Show the change as a plain-English diff (CLAUDE.md rule 8).
5. Offer to run `/preview` so they can see it before it goes live. Do NOT push live without preview + confirmation.
