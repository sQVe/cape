---
name: ubiquitous-language
description: >
  Extract DDD-style domain glossaries from conversation context and formalize them into a structured
  UBIQUITOUS_LANGUAGE.md file. Use when the user asks to define domain terms, create a glossary,
  establish shared vocabulary, "what do we call X", "define the terms", "build a domain model",
  "language guide", or after a brainstorm that surfaced ambiguous terminology. Also triggers on:
  "ubiquitous language", "domain glossary", "term definitions", "naming conventions for domain
  concepts." On re-run, merges new terms into the existing file. Do NOT use for: code-level naming
  conventions (that's cape:conform), API documentation, or general writing tasks.
---

<skill_overview> Scan conversation context for domain concepts, resolve ambiguities, and produce an
opinionated UBIQUITOUS_LANGUAGE.md with terms grouped by domain cluster. Each term gets a
one-sentence definition and a list of aliases to avoid. Relationships between terms show
cardinality. Example dialogue demonstrates correct usage.

Core contract: every term comes from the conversation. No invented concepts. Definitions are
opinionated — pick one canonical name and flag the rest as aliases to avoid. </skill_overview>

<rigidity_level> HIGH FREEDOM — The output structure (tables, relationships, examples, ambiguities)
is fixed. How you extract terms, how many clusters you identify, and how opinionated you are about
naming adapts to the domain complexity. </rigidity_level>

<when_to_use>

- After a brainstorm or design discussion with ambiguous terminology
- "Define our domain terms" or "create a glossary"
- "What should we call X?" when multiple names exist for one concept
- "Build a ubiquitous language" or "domain language guide"
- When the same concept appears under different names in conversation
- Re-running to incorporate terms from a new discussion

**Don't use for:**

- Code-level naming conventions (use `cape:conform`)
- API or endpoint documentation
- General writing or copywriting tasks
- Renaming variables in code (just do it)

</when_to_use>

<critical_rules>

1. **Every term comes from the conversation** — do not invent domain concepts that were not
   discussed
2. **One canonical name per concept** — be opinionated; relegate alternatives to "aliases to avoid"
3. **One sentence per definition** — if it takes two sentences, the concept needs splitting
4. **Flag ambiguity, don't hide it** — when a term means different things in different contexts,
   call it out explicitly with a recommendation
5. **Merge, don't overwrite** — on re-run, read the existing file first and preserve unchanged terms
6. **Commit to the language** — after writing, use these terms consistently in all subsequent output

</critical_rules>

<the_process>

## Step 1: Check for existing file

Before extracting terms, check whether `UBIQUITOUS_LANGUAGE.md` already exists in the project root.

- **File exists** — read it. This is the baseline. New terms merge into it; existing terms are
  preserved unless the conversation explicitly redefines them.
- **No file** — fresh extraction. Proceed to step 2.

## Step 2: Extract domain concepts

Scan the conversation for domain-relevant terms. Look for:

- **Nouns used repeatedly** — entities, aggregates, value objects, actors
- **Verbs that describe domain actions** — lifecycle transitions, operations, commands
- **Terms used inconsistently** — same concept called different things by different people or at
  different points in the conversation
- **Implicit concepts** — ideas discussed but never named ("the thing that happens when X" needs a
  name)
- **Contested terms** — words where participants disagreed on meaning or scope

For each candidate term, note:

- Where it appeared in the conversation (paraphrase the context)
- Whether it was used consistently or with shifting meaning
- Any competing names for the same concept

## Step 3: Organize into domain clusters

Group related terms into clusters that reflect natural domain boundaries. Typical clusters:

- **Lifecycle** — states, transitions, events
- **Actors** — users, roles, external systems
- **Entities** — core domain objects
- **Operations** — commands, actions, processes
- **Boundaries** — contexts, modules, integration points

Choose cluster names that fit the actual domain — these are examples, not a fixed taxonomy. A
financial domain might have "Instruments," "Settlements," "Counterparties." A logistics domain might
have "Routes," "Carriers," "Shipments."

For each term within a cluster, define:

- **Canonical name** — the one name everyone should use. Be opinionated. Pick the most precise,
  least ambiguous option.
- **Definition** — one sentence. Maximum. If you need two sentences, the concept is either too broad
  (split it) or too vague (sharpen it).
- **Aliases to avoid** — other names used in conversation for this concept. These are not wrong —
  they are retired in favor of the canonical name.

## Step 4: Map relationships

Identify how terms relate to each other. Express relationships with cardinality:

- `User` → has many → `Order`
- `Order` → has one → `Status`
- `Team` → belongs to → `Organization`

Focus on relationships that surfaced in the conversation. Do not model the entire domain — only
relationships that were discussed or implied.

## Step 5: Write UBIQUITOUS_LANGUAGE.md

Write the file to the project root using this structure:

```markdown
# Ubiquitous language

## Terms

### [Cluster name]

| Term | Definition | Aliases to avoid |
| ---- | ---------- | ---------------- |
| ...  | ...        | ...              |

### [Next cluster]

...

## Relationships

| Subject | Relationship | Object | Cardinality |
| ------- | ------------ | ------ | ----------- |
| ...     | ...          | ...    | ...         |

## Example dialogue

> **[Role A]:** [Example using terms correctly] **[Role B]:** [Response using terms correctly] ...

3-5 exchanges demonstrating natural usage of the canonical terms in context.

## Ambiguities

| Term | Problem | Recommendation |
| ---- | ------- | -------------- |
| ...  | ...     | ...            |

Terms where the conversation revealed genuine ambiguity that a definition alone cannot resolve.
Include a concrete recommendation for each.
```

**Re-run merge rules** (when an existing file was read in step 1):

1. Read all existing terms into memory
2. For each new term:
   - If it matches an existing term by name → compare definitions. If changed, update and mark
     `(updated)` after the term name.
   - If it is genuinely new → add and mark `(new)` after the term name.
3. Existing terms not mentioned in the current conversation → preserve unchanged, no annotation.
4. Remove `(new)` and `(updated)` annotations from terms that were marked in a previous run — only
   the current run's changes get annotated.
5. Merge relationships and ambiguities the same way.

## Step 6: Post-output commitment

After writing the file, state:

> I've written/updated UBIQUITOUS_LANGUAGE.md. From this point forward I will use these terms
> consistently.

Then actually do it. In all subsequent messages, use the canonical terms from the file. If you catch
yourself using an alias-to-avoid, correct yourself.

</the_process>

<examples>

<example>
<scenario>First run after a brainstorm about an e-commerce domain</scenario>

Conversation discussed "orders," "purchases," "transactions" interchangeably. Some participants said
"customer," others said "buyer," others said "user."

**Wrong:** Include all three synonyms as separate terms with overlapping definitions. Or skip the
ambiguity — just pick names without explaining what was retired.

**Right:** Pick "Order" as the canonical term, list "purchase" and "transaction" as aliases to
avoid. Pick "Customer" over "buyer" and "user" (more precise in a commerce context). Flag that
"transaction" has a second meaning in payment processing and recommend reserving it for that
context. </example>

<example>
<scenario>Re-run after a new discussion introduces terms</scenario>

Existing UBIQUITOUS_LANGUAGE.md has 12 terms across 3 clusters. New conversation introduced
"Fulfillment Center" and refined the definition of "Shipment."

**Wrong:** Rewrite the entire file from scratch, losing the stable terms and their history. Or
append new terms at the bottom without integrating them into clusters.

**Right:** Read the existing file. Add "Fulfillment Center" to the appropriate cluster marked
`(new)`. Update the "Shipment" definition and mark it `(updated)`. Leave the other 11 terms
untouched. Remove any `(new)`/`(updated)` markers from the previous run. </example>

<example>
<scenario>Conversation reveals genuine ambiguity that cannot be resolved by naming alone</scenario>

"Account" means both "user account" (authentication) and "financial account" (billing) in the
conversation. Participants used both meanings without distinguishing them.

**Wrong:** Pick one meaning and ignore the other. Or create "Account1" and "Account2."

**Right:** Create two terms: "User Account" (authentication context) and "Billing Account"
(financial context). Add an entry to the Ambiguities table: "Account" / "Used for both
authentication and billing contexts" / "Always qualify: 'User Account' or 'Billing Account.' Never
use bare 'Account.'" </example>

</examples>

<key_principles>

- **Opinionated over diplomatic** — the value is in choosing one name, not listing options
- **Conversation-grounded** — every term traces back to something actually discussed
- **Precise over comprehensive** — a tight glossary of 10 well-defined terms beats 50 vague ones
- **Living document** — re-runs merge; the file grows with the project's understanding
- **Commitment over documentation** — the file is only useful if everyone (including Claude)
  actually uses the terms

</key_principles>
