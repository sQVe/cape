# Brainstorm: replacing REST API with GraphQL for dashboard endpoints

I'm using the brainstorming skill to refine your idea into a design.

---

## Step 1: Understand the idea

### Research findings

**Codebase investigation (simulated):**

- Express routes found in `src/routes/` with 15 endpoint files covering dashboard CRUD operations
  (widgets, layouts, filters, user preferences, analytics summaries, etc.)
- Auth middleware at `src/middleware/auth.ts` — JWT-based, validates tokens and attaches user
  context to `req.user`
- Rate limiting middleware at `src/middleware/rateLimit.ts` — uses `express-rate-limit`, configured
  per-route with different tiers (stricter for write operations)
- External integrations consume 5 of the 15 endpoints (read-only data export, webhook registration,
  status checks)
- Response shapes vary: some endpoints return nested objects (dashboard with widgets), others return
  flat lists
- No existing GraphQL schema or resolver infrastructure in the codebase
- Tests use supertest against Express routes directly

**Answering my own questions before asking the user:**

| Question                            | Found via research            | Answer                                                                                |
| ----------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------- |
| What framework is used?             | `package.json`, route files   | Express.js                                                                            |
| How is auth implemented?            | `src/middleware/auth.ts`      | JWT middleware, attaches user to request                                              |
| How is rate limiting done?          | `src/middleware/rateLimit.ts` | express-rate-limit, per-route config                                                  |
| Are there external consumers?       | User stated                   | Yes, "a few external integrations" use the same REST API                              |
| How many endpoints?                 | User stated                   | ~15 endpoints                                                                         |
| Is there an existing GraphQL setup? | Codebase search               | No — this would be net-new infrastructure                                             |
| Do endpoints have N+1 patterns?     | Route handlers                | Several dashboard endpoints make 3-4 sequential DB calls to assemble nested responses |

### Clarifying questions (simulated — answering as the user)

**Critical questions:**

1. **What's driving the migration?** Over-fetching on the dashboard (loading full objects when the
   UI only needs a few fields) and the desire to reduce multiple round-trips for dashboard page
   loads.

2. **Must external integrations continue working on REST?** Yes — external partners are on contracts
   and cannot be forced to migrate. REST endpoints serving external integrations must remain
   operational.

3. **Is this a full replacement or a gradual migration?** Gradual — we can't freeze feature
   development for a rewrite. Dashboard endpoints should migrate first, external-facing ones stay
   REST.

### Key decisions (from Step 1)

| Question                        | Answer                                             | Implication                                                                                   |
| ------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Migration driver                | Over-fetching + round-trip reduction for dashboard | GraphQL value is strongest for dashboard's nested data; external endpoints don't benefit much |
| External integration continuity | Must keep REST for external consumers              | Cannot do a wholesale replacement; must run both simultaneously                               |
| Migration strategy              | Gradual, dashboard-first                           | Need a coexistence architecture; both GraphQL and REST served from the same Express app       |
| Auth approach                   | Reuse existing JWT middleware                      | GraphQL context must extract user from the same JWT; no new auth system                       |
| Rate limiting                   | Must apply to GraphQL too                          | Need query-complexity-based or operation-based rate limiting, not just per-route              |

---

## Step 2: Research and propose approaches

This is a complex architectural decision — it touches multiple components (routing, middleware, data
fetching, client integration, external API compatibility), has competing viable approaches, and
involves significant trade-offs. Using **divergent mode**.

### Design 1: Minimal — thin GraphQL layer over existing handlers

**Constraint:** Minimize the interface — simplest possible approach.

**Approach:** Add Apollo Server as Express middleware at `/graphql`. Schema wraps existing route
handler logic by calling the same service functions. REST routes remain untouched for external
consumers. Dashboard React app switches to Apollo Client.

- Schema mirrors existing REST response shapes exactly
- Resolvers call the same service layer the REST handlers call
- Auth: pass Express `req` into GraphQL context, reuse JWT middleware
- Rate limiting: use `graphql-rate-limit` directive with same limits as REST

**Pros:**

- Smallest change surface — service layer untouched
- REST and GraphQL share business logic from day one
- Low risk to external integrations

**Cons:**

- Schema mirrors REST shapes, missing GraphQL's relational modeling benefits
- No DataLoader — existing N+1 patterns persist
- "GraphQL skin over REST" — limited value beyond query flexibility

### Design 2: Flexible — full GraphQL schema with relay-style connections

**Constraint:** Maximize flexibility — support many use cases.

**Approach:** Design a proper graph schema with node interfaces, relay-style connections, and
cursor-based pagination. Introduce DataLoader for batching. Build a resolver layer that replaces the
REST handler logic entirely for dashboard endpoints. External REST endpoints become thin wrappers
over GraphQL queries internally.

- Full graph modeling: Dashboard -> Widgets -> DataSources with proper edges
- Relay connection spec for pagination
- DataLoader for all database access to eliminate N+1
- Subscriptions for real-time dashboard updates
- External REST endpoints internally execute GraphQL queries (REST-over-GraphQL)

**Pros:**

- Maximizes GraphQL's value — proper graph modeling, efficient data loading
- Future-proof: external integrations could migrate to GraphQL later
- Subscriptions enable real-time without additional infrastructure

**Cons:**

- Large scope — essentially a rewrite of the data access layer
- Relay connection spec adds complexity the dashboard may not need
- REST-over-GraphQL adds latency to external endpoints for no consumer benefit
- Subscriptions are YAGNI — no stated requirement for real-time

### Design 3: Pragmatic — GraphQL for dashboard with shared service layer

**Constraint:** Optimize for the most common case.

**Approach:** Add Apollo Server at `/graphql` with a schema designed for the dashboard's actual
query patterns. Introduce DataLoader where N+1 problems exist (dashboard-with-widgets,
analytics-with-filters). REST endpoints remain for external consumers, both calling the same service
layer. No relay spec, no subscriptions — just the queries and mutations the dashboard needs today.

- Schema designed around dashboard UI views, not REST resource shapes
- DataLoader for the 3-4 endpoints with nested data fetching
- Shared service layer: REST handlers and GraphQL resolvers call the same functions
- Auth: GraphQL context built from Express req using existing JWT middleware
- Rate limiting: query-complexity analysis using `graphql-query-complexity`, mapped to existing rate
  limit tiers
- Mutations for dashboard write operations (save layout, update widget config)
- REST routes for external integrations left completely untouched

**Pros:**

- Solves the stated problems (over-fetching, round-trips) without over-engineering
- DataLoader addresses real N+1 issues
- Schema designed for actual UI needs, not abstract graph modeling
- Zero impact on external integrations
- Service layer sharing prevents logic duplication

**Cons:**

- Schema not relay-compliant — would need refactoring if relay is adopted later
- No subscriptions — would be separate work if real-time is needed
- Two API surfaces to maintain long-term

### Comparison and recommendation

```
Three designs explored under different constraints:

1. **Minimal** (simplest interface)
   - Approach: Thin GraphQL wrapper over existing REST handlers
   - Pro: Smallest change, lowest risk
   - Con: "GraphQL skin over REST" — limited value, N+1 persists
   - Trade-off: Fast to ship but doesn't solve the core data-fetching problems

2. **Flexible** (maximum flexibility)
   - Approach: Full graph schema with relay connections, DataLoader, subscriptions
   - Pro: Future-proof, maximizes GraphQL value
   - Con: Scope creep — subscriptions and relay spec are YAGNI
   - Trade-off: 3-4x the effort for capabilities not yet needed

3. **Pragmatic** (common case optimized)
   - Approach: Dashboard-shaped GraphQL schema, DataLoader for N+1, shared service layer
   - Pro: Solves stated problems, right-sized scope, zero external impact
   - Con: Not relay-compliant, no real-time
   - Trade-off: Optimized for now, refactorable later

I recommend option 3 (Pragmatic) because it directly addresses the over-fetching
and round-trip problems that motivated this migration without introducing unnecessary
abstractions. The shared service layer pattern is consistent with how the codebase
already separates route handlers from business logic.

The other designs revealed two insights the recommended approach should absorb:
- From Design 1: reusing the existing JWT middleware via GraphQL context is the right auth strategy
- From Design 2: DataLoader is valuable and should be included, but only where N+1 actually occurs
```

---

## Step 3: Challenge assumptions — grill-me cadence

### Branch 1/5: Coexistence duration

REST and GraphQL will coexist indefinitely since external integrations require REST. This means
maintaining two API surfaces long-term.

Recommended: Accept permanent coexistence. The shared service layer keeps logic in one place. The
REST routes for external consumers are stable and rarely change — maintenance cost is low.

a) Permanent coexistence with shared service layer — low maintenance, proven pattern b) Sunset REST
after migrating external consumers to GraphQL — cleaner but forces partners to change c) Build a
REST-to-GraphQL gateway so all traffic flows through GraphQL — adds latency, over-engineering

**Resolution:** Option (a). External integrations are on contracts. Forcing a migration creates
partner friction for zero user value. The 5 external endpoints are read-only and stable — carrying
them as REST indefinitely costs almost nothing.

---

### Branch 2/5: GraphQL server library choice

Apollo Server is the dominant choice but adds significant bundle weight and has moved toward a
commercial model. Alternatives exist.

Recommended: Apollo Server — largest ecosystem, best Express integration, established pattern.

a) Apollo Server v4 — industry standard, large ecosystem, middleware-based Express integration b)
graphql-yoga — lighter weight, built on standard Fetch API, good DX c) mercurius (Fastify) — would
require migrating from Express, not viable

**Resolution:** Option (a). Apollo Server v4 has the broadest community support, best tooling
(Apollo Studio for query inspection during development), and the most straightforward Express
integration via `expressMiddleware`. The commercial features are optional and not needed. No reason
to adopt a less common library for this use case.

---

### Branch 3/5: Schema design philosophy

The schema could mirror REST resource shapes (User, Widget, Dashboard as independent types) or be
designed around dashboard view needs (DashboardView that includes everything the page needs).

Recommended: Domain-model types with dashboard-specific query entry points. Types represent domain
objects (Dashboard, Widget, DataSource) but top-level queries are shaped around what the UI actually
requests.

a) UI-view-shaped schema — fast for current dashboard, hard to extend b) Domain-model types with
UI-shaped queries — balanced: types are reusable, queries match UI needs c) Pure resource-oriented
schema — mirrors REST, defeats the purpose

**Resolution:** Option (b). Domain types give a proper graph to traverse
(`Dashboard -> widgets -> dataSource`) while top-level queries like `dashboardWithWidgets(id)` serve
the UI's actual access patterns. This avoids both the over-abstraction of pure domain modeling and
the rigidity of view-shaped types.

---

### Branch 4/5: Rate limiting strategy for GraphQL

REST rate limiting is per-route. GraphQL has a single endpoint, so per-route limiting doesn't apply.
A single expensive query could bypass limits.

Recommended: Query complexity analysis — assign cost to each field/type, reject queries exceeding a
complexity threshold.

a) Query complexity analysis — assign costs per field, reject over-threshold queries b)
Operation-based limiting — rate limit by named operation (mutation vs. query) c) Depth limiting only
— simple but doesn't catch wide queries

**Resolution:** Option (a) with depth limiting as a secondary guardrail. Query complexity analysis
using `graphql-query-complexity` maps directly to the existing rate-limit tier concept: read
operations have lower field costs, write operations (mutations) have higher costs. Depth limiting
(max depth = 5) prevents pathological nesting. This combination covers both wide and deep abuse
patterns.

---

### Branch 5/5: Migration sequencing for the React dashboard

The dashboard has ~15 endpoints to migrate. Migrating all at once is risky. Need a sequencing
strategy.

Recommended: Migrate by page, starting with the most data-heavy dashboard view that suffers most
from over-fetching.

a) Migrate by page — one dashboard view at a time, old REST calls replaced by GraphQL queries b)
Migrate by operation type — all reads first, then mutations c) Big bang — migrate all 15 at once
behind a feature flag

**Resolution:** Option (a). Page-by-page migration lets the team validate the GraphQL setup with a
single high-value page (the main dashboard view with its nested widgets — the page that suffers most
from over-fetching and multiple round-trips). Each subsequent page migration is lower risk because
the infrastructure is proven. REST routes stay functional throughout, so any page can fall back.

---

All 5 branches resolved. Proceeding to design summary.

---

## Design summary

**Problem:** The React dashboard over-fetches data and makes multiple round-trips to load nested
views (dashboards with widgets, analytics with filters). 15 REST endpoints serve both the dashboard
and external integrations. The dashboard needs more flexible data fetching; external integrations
need stability.

**Chosen approach:** Pragmatic GraphQL — dashboard-shaped schema with DataLoader, coexisting with
REST for external consumers, sharing a service layer.

**Requirements:**

- Apollo Server v4 mounted at `/graphql` as Express middleware
- GraphQL schema with domain-model types (Dashboard, Widget, DataSource, UserPreference) and
  dashboard-optimized query entry points
- DataLoader instances for dashboard-with-widgets, analytics-with-filters, and other N+1 patterns
  (3-4 resolvers)
- GraphQL context built from Express `req` using existing JWT auth middleware
- Query complexity analysis via `graphql-query-complexity` with depth limiting (max 5)
- Mutations for dashboard write operations (save layout, update widget config, manage filters)
- React dashboard migrated page-by-page, starting with the main dashboard view
- All 5 external-facing REST endpoints remain untouched
- Shared service layer: both REST handlers and GraphQL resolvers call the same business logic
  functions

**Anti-patterns:**

- NO REST-over-GraphQL gateway (reason: adds latency to external endpoints for zero consumer
  benefit)
- NO relay connection spec (reason: cursor-based pagination is YAGNI for dashboard's fixed-size
  widget lists)
- NO GraphQL subscriptions (reason: no stated real-time requirement; add separately if needed)
- NO schema that mirrors REST response shapes (reason: defeats GraphQL's value; schema should model
  the domain graph)
- NO forcing external integrations to migrate (reason: partner contracts; REST endpoints are stable
  and cheap to maintain)
- NO big-bang migration (reason: page-by-page migration de-risks the rollout and allows fallback)
- NO custom auth system for GraphQL (reason: existing JWT middleware works; pass req into context)

**Architecture:**

```
React Dashboard                 External Integrations
      |                                  |
  Apollo Client                    REST clients
      |                                  |
      v                                  v
  /graphql (Apollo Server)     /api/* (Express routes)
      |                                  |
      +------ GraphQL Context -----------+
      |       (JWT from req.user)        |
      v                                  v
  Resolvers + DataLoader          Route Handlers
      |                                  |
      +-------> Service Layer <----------+
                     |
                  Database
```

**Scope:**

- In: GraphQL server setup, schema + resolvers for dashboard endpoints, DataLoader for N+1 cases,
  query complexity rate limiting, React dashboard migration (page-by-page), shared service layer
  refactoring where needed
- Out: External integration migration, subscriptions/real-time, relay spec, REST endpoint changes,
  new auth system

**Open questions:**

- Which specific dashboard page to migrate first (likely the main overview with nested widgets —
  confirm with usage analytics)
- Whether existing supertest-based API tests should be duplicated for GraphQL or if a shared
  service-layer test suite is sufficient
- Apollo Studio adoption for development-time query inspection (free tier vs. self-hosted
  alternative)

### Key decisions

| Question                        | Answer                                   | Implication                                                       |
| ------------------------------- | ---------------------------------------- | ----------------------------------------------------------------- |
| Migration driver                | Over-fetching + round-trips on dashboard | GraphQL value targets dashboard; external endpoints don't benefit |
| External integration continuity | Keep REST permanently                    | Coexistence architecture required; shared service layer           |
| Migration strategy              | Gradual, page-by-page                    | Infrastructure proven on first page before broader rollout        |
| Auth approach                   | Reuse JWT middleware via GraphQL context | No new auth system; `req.user` available in resolvers             |
| Rate limiting                   | Query complexity + depth limiting        | Maps to existing tier concept; covers wide and deep abuse         |
| GraphQL library                 | Apollo Server v4                         | Largest ecosystem, best Express integration                       |
| Schema philosophy               | Domain types with UI-shaped queries      | Reusable types, practical query entry points                      |
| Coexistence duration            | Permanent                                | Low cost — 5 stable read-only REST endpoints                      |

### Research findings

**Codebase:**

- `src/routes/` — 15 Express route files for dashboard CRUD
- `src/middleware/auth.ts` — JWT auth middleware, attaches `req.user`
- `src/middleware/rateLimit.ts` — `express-rate-limit`, per-route config with read/write tiers
- `src/services/` — service layer already separates business logic from route handlers (partially —
  some handlers contain inline logic that would need extraction)
- Test suite uses supertest against Express routes

**External:**

- Apollo Server v4 Express integration: `@apollo/server` with `expressMiddleware`
- DataLoader: `dataloader` npm package for batching and caching per-request
- Query complexity: `graphql-query-complexity` for cost analysis
- Depth limiting: `graphql-depth-limit` for nesting protection

### Approaches considered

1. **Pragmatic** (selected) — Dashboard-shaped GraphQL with DataLoader and shared service layer.
   Solves stated problems without over-engineering. Zero impact on external integrations.
2. **Minimal** (rejected) — Thin GraphQL wrapper over REST handlers. Too little value: N+1 persists,
   schema mirrors REST shapes. DO NOT REVISIT UNLESS the team wants a proof-of-concept before
   committing to proper schema design.
3. **Flexible** (rejected) — Full relay schema with subscriptions. Scope far exceeds stated needs.
   DO NOT REVISIT UNLESS real-time dashboards or relay adoption become actual requirements.

### Dead ends

- **Mercurius (Fastify-based GraphQL):** Explored as a lighter alternative to Apollo. Abandoned
  because it requires Fastify — migrating from Express is out of scope and introduces unrelated
  risk.
- **REST-over-GraphQL for external endpoints:** Considered having REST routes internally execute
  GraphQL queries for a single data path. Abandoned because it adds latency to stable endpoints and
  couples external API stability to GraphQL schema evolution.
- **tRPC as an alternative to GraphQL:** Explored briefly. Abandoned because tRPC is best for
  monorepo setups where client and server share types — external integrations can't use tRPC, and it
  doesn't solve the nested data-fetching problem as elegantly as GraphQL's graph traversal.

---

Design summary complete. Run `/cape:write-plan` to formalize this into a br epic.
