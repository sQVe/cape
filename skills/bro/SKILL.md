---
name: bro
description: >
  Restate the previous message in plain language: what happened, what it means, what to do next. Use
  on "explain that", "what does that mean", "in plain english", "eli5". Not for redoing the work.
---

# Bro

Say the previous message again, plainly. No jargon, no tables, no raw tool output. The user already
got the answer once and it did not land, so the job is translation.

## What to cover

- **What happened.** The concrete event: a test failed, three files changed, the query returned no
  rows.
- **What it means.** Why that matters for what the user is trying to do.
- **What to do next.** The one action worth taking, or "nothing, this is finished."

A few sentences. Name real things, files, commands, numbers, instead of categories.

## Limits

Explain, do not re-run. No new tool calls, no fresh investigation, no revised answer. If the
previous message was wrong, fixing it is a new request.

Report the same outcome the previous message reported. A failure stays a failure. Do not soften it
into "mostly working" and do not inflate a warning into a crisis.

If the previous message asked a question or laid out a decision, restate the choice and what each
option costs. Do not pick one. The decision was the user's before and it still is.
