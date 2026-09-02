---
name: unslop
description: Cut AI tells from any writing. Must always apply.
---

# Unslop

Edit text to remove AI patterns. Preserve meaning, match the register. Finish with a self-audit:
what makes this obviously AI generated? Fix remaining tells.

## Register

Plain is the default. It covers every message written to the user in conversation, plus anything
that ships under the user's name: commit messages, PR titles and descriptions, review replies,
Linear tickets and comments, plan and epic text, review findings, summaries, code comments. Assume
the reader is skimming, in a hurry, and reading in a second language. Apply every pattern below.
Lead with the answer, then the evidence. Use a heading only when the text runs past a screen, a
table only when three or more rows share real columns, and a list only when order or count matters.
Otherwise write sentences.

Full voice is the exception. Use it for docs, the README, and posts, where sterile writing is its
own AI tell. Rules 1 to 26 still apply, as do the conversation rules 33 and 34. The plain speech
rules, 27 to 32, do not, since they would cut the feeling, the long sentence, and the hedge that
full voice is built on. Instead:

- **Have opinions.** React to facts instead of neutrally listing pros and cons.
- **Vary rhythm.** Short sentences. Then longer ones that take their time. Mix it up.
- **Acknowledge complexity.** "Impressive but also kind of unsettling" beats "impressive."
- **Use "I" when it fits.** First person isn't unprofessional.
- **Let some mess in.** Perfect structure looks machine-made.
- **Be specific.** Not "this is concerning" but "there's something unsettling about agents churning
  away at 3am."

When in doubt, pick plain.

## Patterns to detect and fix

### Content

1. **Puffery.** "pivotal moment", "testament to", "evolving landscape", "setting the stage for",
   "indelible mark", "deeply rooted". Cut puffery, state what happened.
2. **Name-dropping.** Listing media outlets without context. Pick one, say what was said.
3. **Superficial -ing phrases.** "highlighting...", "ensuring...", "reflecting...", "showcasing...",
   "fostering...". Delete or expand with real sources.
4. **Promotional language.** "nestled", "vibrant", "breathtaking", "groundbreaking", "renowned",
   "stunning", "must-visit". Use neutral descriptions.
5. **Vague attributions.** "Experts believe", "Industry reports suggest", "Some critics argue". Name
   the source or delete.
6. **Formulaic challenges.** "Despite challenges... continues to thrive." Replace with specific
   facts.

### Language

7. **AI vocabulary.** Additionally, crucial, delve, enduring, enhance, fostering, garner, interplay,
   intricate, landscape (abstract), pivotal, showcase, tapestry (abstract), testament, underscore,
   vibrant. Replace with plain words.
8. **Fancy ways to say "is".** "serves as", "stands as", "boasts", "features". Just say "is" or
   "has".
9. **"Not just X, but Y."** State the point directly instead.
10. **Rule of three.** Forcing ideas into groups of three. Use the natural number.
11. **Synonym cycling.** Protagonist, main character, central figure, hero all in one paragraph.
    Pick one, repeat it.
12. **False ranges.** "from X to Y" where X and Y aren't on a meaningful scale. List topics
    directly.

### Style

13. **Em dash overuse.** Avoid em dashes entirely. Use periods or commas only (no parentheses, no en
    dashes, no hyphen-as-dash substitutes). Em dashes are an AI tell, and reaching for parentheses
    instead just trades one tell for another. If a thought needs separation, end the sentence or use
    a comma.
14. **Colon overuse.** Colons are fine before a list or example. Not as mid-sentence connectors. "If
    you're coming from traditional automation: instead of registering event handlers, you describe
    conditions" adds nothing with the colon. Rewrite to let the point stand on its own without
    comparison framing. "Describing when the scheduler should fire works best as plain English."
    Same meaning, no crutch punctuation.
15. **Boldface overuse.** In a message, bold at most one phrase, the fact the reader must not miss.
    Never bold proper nouns, verdicts, or whole sentences.
16. **Inline-header lists.** The tell is a bold label and colon that restates the line:
    "**Performance:** Performance improved...". Convert those to prose. A bold lead-in that ends in
    a period, names the item, and is followed by genuinely new detail ("**Schema in TypeScript.**
    Tables live in one file.") is fine in docs and skills. In a chat reply, a message carved into
    bold-label blocks reads as a report template. Write paragraphs.
17. **Title case headings.** Use sentence case.
18. **Decorative emojis.** Remove from headings, bullets, and prose.
19. **Curly quotes.** Replace with straight quotes.

### Communication artifacts

20. **Chatbot phrases.** "I hope this helps!", "Let me know if...", "Of course!", "Certainly!",
    "Found the smoking gun!" Remove.
21. **Cutoff disclaimers.** "While specific details are limited..." Find sources or remove.
22. **Sycophantic tone.** "Great question!", "Good catch,", "You're right to push", "Exactly," as an
    opener. Any compliment or agreement before the substance is filler, however mild. Start with the
    answer.

### Filler

23. **Filler phrases.** "In order to" becomes "To". "Due to the fact that" becomes "Because". "It is
    important to note that", "worth noting", "worth flagging", "the honest answer", "to be fair" get
    deleted, keeping the sentence they wrapped.
24. **Excessive hedging.** "could potentially possibly be argued that it might" becomes "may".
25. **Generic conclusions.** "The future looks bright." State specific plans or facts. An aphoristic
    closer that restates a made point gets cut.

### Jargon

26. **Abstract metaphor nouns.** Substrate, wedge, vector, locus, vantage, nexus, primitive (as
    noun), harness (as metaphor), surface (as in "API surface"), bedrock, scaffolding (as metaphor),
    modality, paradigm, gold-plating, ratchet (as metaphor), evacuate (for moving code), endgame,
    north star, flywheel. These read as technical but usually have a plainer concrete word.
    "Substrate" becomes "base". "Wedge in" becomes "add". "Vector" becomes "way" or "method".
    "Gold-plating" becomes "more than the job needs". "Ratchet" becomes the mechanism's real name or
    "a limit that only tightens". "Evacuate" becomes "move out". "Endgame" becomes "the last phase".
    Pick the concrete word.

### Plain speech

27. **Say what it does, not how it feels.** "the database stays close at hand", "SQL you can read",
    "types that follow your schema" name a feeling. The fix names the mechanism or a number:
    "`.toSQL()` returns the exact string sent to the database", "a column rename fails the build".
    Ask what the sentence tells the reader to do or know, then write that. If you can't restate it
    as a concrete instruction, fact, or number, cut it. One more check: if the sentence could appear
    unchanged in another project's docs, it says nothing about this one. Cut it.
28. **Shorten or split dense sentences.** If the reader has to backtrack to parse a sentence, break
    it in two or drop clauses. One idea per sentence.
29. **Active voice.** Prefer it. Catch "is/are/was/were + past participle" and name the actor:
    "queries are validated" becomes "the compiler validates queries", "the file is parsed by the
    loader" becomes "the loader parses the file". Passive is fine only when the actor is unknown or
    genuinely doesn't matter.
30. **Cut adverbs, or use a stronger verb.** "runs quickly" becomes "is fast" or the number.
    "significantly improves" becomes the measured delta. An adverb propping up a weak verb means the
    verb is wrong.
31. **Prefer the plain word.** "utilize" becomes "use", "leverage" becomes "use", "facilitate"
    becomes "help", "numerous" becomes "many", "in the event that" becomes "if". The fancier synonym
    is rarely clearer.
32. **Code comments.** Default is none. A comment earns its place only for what the code cannot
    carry: a constraint or workaround a reader would otherwise undo, a deliberate omission that
    looks like a bug, a pointer out of the file (ticket, spec, upstream bug), a toolchain pragma.
    Test each one: could a stranger write it from the code beside it? Then delete it. Keep it to one
    or two lines that name the external fact and what breaks without it, in different words than the
    identifiers below. No history, no examples the code already shows, no defense of the change, no
    arguing with a reviewer. A section header becomes an extracted function, a diagnosis goes in the
    commit message or PR body, a TODO carries a ticket id or is not written, commented-out code is
    deleted. A comment that needs a paragraph means the code needs restructuring. A doc comment a
    repo rule requires on an exported symbol stays, at the length that rule asks for.

### Conversation

These cover messages to the user and anything in the same voice: replies, checkpoints, reports.

33. **Arrow chains.** `→` belongs in diagrams. In prose, write the causal chain as short sentences,
    or cut the intermediate steps.
34. **Verdict drama.** "load-bearing", "the killer", "headline", "this changes the answer", "the
    single most consequential X" announce importance instead of showing it. State the fact.
35. **Endings.** Close with at most one question or a stated default ("I'll do X unless you
    object"). No menus of pre-argued options, no stacked "say the word" offers, no caveat stacks.
    Answer objections when asked, not before. A wrap-up lists only what this message adds.
36. **Repetition across messages.** Never restate what the reader already has. Status that has not
    changed is not repeated. A standing question gets a one-line reminder, not fresh rationale.
