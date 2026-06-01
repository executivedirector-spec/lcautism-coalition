/*
 * crm-capture.js
 * ------------------------------------------------------------------
 * Quietly copies public form submissions into the Supabase CRM
 * database, IN ADDITION to the existing Web3Forms email flow.
 *
 * This file is intentionally SEPARATE from js/main.js so it can never
 * interfere with the site's core form/email behavior. It attaches its
 * OWN "submit" listener. The database write is fire-and-forget:
 *   - it never blocks the form,
 *   - it never shows the visitor an error,
 *   - if the database is down, the email still sends normally.
 *
 * Backend: a locked-down Supabase project whose public (anon) key can
 * ONLY insert rows into two tables. It cannot read anything back.
 * ------------------------------------------------------------------
 */
(function () {
  "use strict";

  // --- Supabase connection (public, insert-only anon key) ------------
  var SUPABASE_URL = "https://byxuapnhhuxekamgnwaf.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_HP0LFR18xtQuMtqAYAHwmw_Tkx2QgJt";

  // Send one row to a PostgREST table. Fire-and-forget: we do not await
  // it from the submit handler and we swallow all errors.
  function insertRow(table, row) {
    try {
      fetch(SUPABASE_URL + "/rest/v1/" + table, {
        method: "POST",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": "Bearer " + SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
          // return=minimal => server sends nothing back; lighter + faster.
          "Prefer": "return=minimal"
        },
        body: JSON.stringify(row),
        // Best-effort: let the request finish even if the page navigates.
        keepalive: true
      }).catch(function () {
        /* ignore network errors — email submission is unaffected */
      });
    } catch (e) {
      /* never let a CRM problem surface to the visitor */
    }
  }

  // --- Small helpers --------------------------------------------------

  // Read a single field value from a form by its name= attribute.
  function val(form, name) {
    var el = form.elements[name];
    if (!el) return "";
    // Radio/checkbox groups come back as a RadioNodeList; .value is fine
    // for single inputs. For our use we only read single text fields here.
    return (el.value || "").trim();
  }

  // Collect ALL checked values for a checkbox group (e.g. volunteer
  // opportunities / availability) into a comma-separated string.
  function checkedValues(form, name) {
    var nodes = form.querySelectorAll('input[name="' + name + '"]:checked');
    var out = [];
    nodes.forEach(function (n) { out.push(n.value); });
    return out.join(", ");
  }

  // Build a "First Last" name from whatever name fields the form has.
  function fullName(form) {
    var single = val(form, "name");
    if (single) return single;
    var first = val(form, "first_name");
    var last = val(form, "last_name");
    return (first + " " + last).trim();
  }

  // Guarantee a non-empty string (the DB columns are NOT NULL).
  function nonEmpty(value, fallback) {
    var v = (value || "").trim();
    return v ? v : fallback;
  }

  // --- Per-form capture logic ----------------------------------------

  // Contact / Volunteer / Sponsor all go to contact_form_submissions.
  function captureContactLike(form, subjectLabel) {
    var row = {
      name: nonEmpty(fullName(form), "(no name provided)"),
      email: val(form, "email"),
      phone: val(form, "phone"),
      subject: subjectLabel,
      // message is REQUIRED / NOT NULL — synthesize one if the form
      // has no message field or it was left blank.
      message: "",
      source_page: location.pathname
    };

    // Pull the most relevant free-text the form offers as the message.
    var message =
      val(form, "message") ||  // contact forms
      val(form, "why");        // volunteer "tell us your why"

    if (subjectLabel === "Volunteer signup") {
      // Volunteer form has no single message box guaranteed — summarize.
      var parts = [];
      var why = val(form, "why");
      if (why) parts.push(why);
      var opps = checkedValues(form, "opportunity");
      if (opps) parts.push("Interested in: " + opps);
      var avail = checkedValues(form, "availability");
      if (avail) parts.push("Availability: " + avail);
      var address = val(form, "address");
      if (address) parts.push("Address: " + address);
      message = parts.join(" | ");
    } else if (subjectLabel === "Sponsor inquiry") {
      // Sponsor form has no message field — summarize the key details.
      var sparts = [];
      var business = val(form, "business");
      if (business) sparts.push("Business: " + business);
      var tier = val(form, "tier");
      if (tier) sparts.push("Tier: " + tier);
      var website = val(form, "website");
      if (website) sparts.push("Website: " + website);
      var saddress = val(form, "address");
      if (saddress) sparts.push("Address: " + saddress);
      message = sparts.join(" | ");
    }

    row.message = nonEmpty(message, subjectLabel + " (no additional details)");
    insertRow("contact_form_submissions", row);
  }

  // RSVP modal goes to event_rsvps.
  function captureRsvp(form) {
    var size = parseInt(val(form, "number_attending"), 10);
    if (!size || size < 1) size = 1;

    var row = {
      event_id: null, // optional — we don't have a DB uuid on the page
      name: nonEmpty(fullName(form), "(no name provided)"),
      email: val(form, "email"),
      phone: val(form, "phone"), // RSVP form has no phone; sends ""
      party_size: size,
      message: val(form, "notes"),
      source_page: location.pathname
    };
    insertRow("event_rsvps", row);
  }

  // --- Decide which capture (if any) applies to a submitted form ------
  function handleSubmit(event) {
    try {
      var form = event.target;
      if (!form || form.tagName !== "FORM") return;

      // Identify the form by its data-form-name (set in the HTML).
      var kind = (form.getAttribute("data-form-name") || "").trim();

      switch (kind) {
        case "Contact":
        case "Contact-Home":
          captureContactLike(form, "Contact form");
          break;
        case "Volunteer":
          captureContactLike(form, "Volunteer signup");
          break;
        case "Sponsor":
          captureContactLike(form, "Sponsor inquiry");
          break;
        case "RSVP":
          captureRsvp(form);
          break;
        default:
          // Newsletter and any other forms: do nothing.
          return;
      }
    } catch (e) {
      /* swallow everything — never affect the real submission */
    }
  }

  // Listen on the document during the capture phase so we run no matter
  // what other handlers do (and even if they later stop propagation).
  document.addEventListener("submit", handleSubmit, true);
})();
