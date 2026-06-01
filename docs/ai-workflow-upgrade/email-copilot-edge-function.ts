// ============================================================
// LCAC Email Co-Pilot — Supabase Edge Function
// Function name: draft-email-reply
// Project: lcac-crm (ref: byxuapnhhuxekamgnwaf)
// ============================================================
// Triggered by: Google Apps Script webhook (see BEN_HANDOFF_EMAIL_COPILOT.md)
// Secrets needed (set in Supabase Dashboard → Settings → Edge Functions):
//   ANTHROPIC_API_KEY   — dedicated key with $20/mo hard cap
//   WEBHOOK_SECRET      — shared secret to verify calls from Apps Script
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VOICE_PROFILE = `
You are drafting email replies on behalf of Michelle Whitlow, Executive Director
of the Lewis County Autism Coalition (LCAC) in Napavine, WA.

Michelle's voice:
- Warm, direct, personal — like writing to a neighbor, not a stakeholder
- Short paragraphs, plain English, never corporate or clinical
- Leads with the human thing before the business thing
- Never uses: "stakeholders", "leverage", "synergy", "circle back", "touch base"
- Uses: family, community, support, connect, belong, neighbors, grateful, together
- Keeps replies short (3–5 sentences) unless the topic genuinely needs more

Always end with:
Warm regards,
Michelle Whitlow, M.S.
Executive Director | Lewis County Autism Coalition
(360) 644-5222 | executivedirector@lcautism.org
`.trim();

serve(async (req) => {
  // Verify webhook secret
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== Deno.env.get("WEBHOOK_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const body = await req.json();
  const { inbox, from_email, from_name, subject, body_text } = body;

  // Look up contact in CRM by email
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, first_name, last_name")
    .eq("email", from_email)
    .single();

  // Build context string for the prompt
  const contactContext = contact
    ? `This email is from ${contact.first_name} ${contact.last_name}, an existing contact in the LCAC CRM.`
    : `This sender (${from_name || from_email}) is not yet in the LCAC CRM.`;

  // Draft the reply via Claude API
  const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",   // cheapest model — drafting only
      max_tokens: 500,
      system: VOICE_PROFILE,
      messages: [
        {
          role: "user",
          content: `${contactContext}

Please draft a reply to this email:

FROM: ${from_name || from_email} <${from_email}>
SUBJECT: ${subject}

${body_text}

Reply only with the draft email body — no commentary, no subject line, no extra notes.`,
        },
      ],
    }),
  });

  const claude = await claudeRes.json();
  const draft = claude.content?.[0]?.text ?? "";
  const tokensIn = claude.usage?.input_tokens ?? 0;
  const tokensOut = claude.usage?.output_tokens ?? 0;
  const costUsd = (tokensIn * 0.00000025) + (tokensOut * 0.00000125); // Haiku pricing

  // Save draft to queued_replies
  const { data: reply, error } = await supabase
    .from("queued_replies")
    .insert({
      inbox,
      from_email,
      from_name,
      subject,
      body_text,
      contact_id: contact?.id ?? null,
      draft_subject: `Re: ${subject}`,
      draft_body: draft,
      draft_generated_at: new Date().toISOString(),
      status: "pending",
      tokens_used: tokensIn + tokensOut,
      cost_usd: costUsd,
    })
    .select()
    .single();

  if (error) {
    console.error("DB insert error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  // Log cost
  const month = new Date().toISOString().slice(0, 7);
  await supabase.from("system_costs").insert({
    service: "claude-email-copilot",
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_usd: costUsd,
    month,
  });

  return new Response(JSON.stringify({ id: reply.id, status: "draft_queued" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
});
