# REST to GraphQL migration for dashboard endpoints

## Context

- 15 REST endpoints serving a React dashboard and external integrations
- Existing auth middleware and rate limiting
- Two distinct consumer profiles: internal dashboard (React) and external integrations

## Approaches

### Approach A: Full replacement — swap REST for GraphQL

Replace all 15 endpoints with a single GraphQL endpoint. Dashboard and external consumers both use
GraphQL.

**Pros:**

- Single API surface to maintain
- Dashboard gets flexible queries, reduced over-fetching
- Schema serves as living documentation

**Cons:**

- Forces external integrations to rewrite their clients
- Breaking change for all consumers simultaneously
- Rate limiting becomes harder (one endpoint, variable query cost)
- High risk, big-bang migration

### Approach B: GraphQL for dashboard only, keep REST for integrations

Stand up a GraphQL endpoint exclusively for the React dashboard. External integrations continue
using the existing REST API.

**Pros:**

- Dashboard gets the flexibility benefits without breaking external consumers
- Incremental rollout — can migrate endpoint by endpoint
- REST rate limiting stays unchanged for integrations
- External API contract remains stable

**Cons:**

- Two API surfaces to maintain
- Shared business logic must be accessible to both layers
- Risk of divergence if not architectured with shared resolvers/services

### Approach C: GraphQL internally, REST facade for integrations

GraphQL becomes the canonical API layer. External integrations hit a thin REST facade that
translates to GraphQL queries internally.

**Pros:**

- Single source of truth (GraphQL schema)
- External consumers see no breaking change
- Dashboard uses GraphQL directly

**Cons:**

- REST facade adds a translation layer to maintain
- Facade must evolve whenever the GraphQL schema changes
- Over-engineered if the external API surface is small

### Approach D: Keep REST, add a BFF (Backend for Frontend) layer

Instead of GraphQL, build a BFF that aggregates REST calls for the dashboard. REST stays canonical.

**Pros:**

- No new query language for the team to learn
- Dashboard gets tailored endpoints without over-fetching
- External integrations unchanged

**Cons:**

- BFF is custom code per view — more maintenance than a schema
- Doesn't solve the N+1 request problem as cleanly as GraphQL
- Still have to maintain the BFF alongside REST

## Key trade-offs to consider

### Rate limiting with GraphQL

REST rate limiting is straightforward: count requests per endpoint. GraphQL requires query-cost
analysis because one query can fan out into hundreds of resolver calls. You'd need to implement
query complexity scoring (e.g., `graphql-query-complexity` or a custom cost calculator) and reject
queries above a threshold. This is non-trivial.

### Auth middleware

Auth middleware typically maps well to GraphQL. A single middleware on the `/graphql` endpoint
handles authentication. Authorization moves to resolver-level checks or directive-based guards
(`@auth(role: ADMIN)`). The shift from route-level to field-level authorization is more granular but
requires deliberate design.

### Caching

REST endpoints are trivially cacheable via HTTP caching (ETags, Cache-Control). GraphQL over POST
breaks HTTP caching. You'd need application-level caching (DataLoader for N+1, Redis for response
caching) or adopt persisted queries with GET requests. The dashboard may not need aggressive
caching, but external integrations might rely on it.

### External integration impact

External integrations are the critical constraint. If they're third-party consumers you don't
control, breaking their API is a non-starter without a long deprecation runway. If they're internal
services, coordinated migration is feasible but still costly.

### Schema design overhead

15 REST endpoints likely map to 5-8 GraphQL types with relationships. The schema design work is
moderate but the team needs to learn schema-first design, resolver patterns, and DataLoader for
batching.

## What I'd investigate in the codebase

1. **Endpoint inventory** — list all 15 endpoints, their HTTP methods, request/response shapes, and
   which consumers use which endpoints
2. **Data relationships** — how many endpoints return nested/related data that the dashboard
   currently fetches with multiple requests (this is where GraphQL pays off most)
3. **Auth middleware implementation** — whether it's route-based or can be lifted to a shared layer
4. **Rate limiting strategy** — current implementation (IP-based, token-based, per-endpoint) and
   whether it's reusable
5. **External integration contracts** — who the consumers are, whether there's an API versioning
   strategy, and how tightly coupled they are to current response shapes
6. **Dashboard fetch patterns** — whether the React app makes waterfall requests that GraphQL could
   flatten into single queries
7. **Existing service/repository layer** — whether business logic is cleanly separated from HTTP
   handlers (if yes, GraphQL resolvers can reuse it directly)

## Recommendation

**Approach B: GraphQL for dashboard, keep REST for integrations.**

Rationale:

1. **Risk management.** The biggest risk is breaking external integrations. Keeping REST for them
   eliminates that risk entirely.

2. **Clear value proposition.** GraphQL's benefits (flexible queries, reduced over-fetching, typed
   schema) matter most for the dashboard, which has complex UI state and frequently changing data
   needs. External integrations typically make fixed, predictable requests — REST is fine for them.

3. **Incremental migration.** You can stand up the GraphQL endpoint, migrate one dashboard page at a
   time, and validate the approach before committing fully. If GraphQL doesn't deliver expected
   benefits, you've only invested in one endpoint.

4. **Shared service layer.** Structure the codebase so both REST handlers and GraphQL resolvers call
   the same service/repository layer. This prevents logic duplication and keeps behavior consistent.

5. **Rate limiting stays simple.** REST rate limiting doesn't change. GraphQL rate limiting only
   needs to handle dashboard traffic, which you control — so you can start with simple request-count
   limits and add complexity scoring later if needed.

### Suggested implementation sequence

1. Audit endpoints: categorize by consumer (dashboard-only, integration-only, shared)
2. Extract business logic from REST handlers into a service layer if not already done
3. Design GraphQL schema for dashboard-only endpoints first
4. Implement resolvers that call the service layer, with DataLoader for batching
5. Add auth middleware and field-level authorization
6. Migrate one dashboard page to GraphQL, validate performance and DX
7. Migrate remaining dashboard pages incrementally
8. For shared endpoints, keep REST available and add GraphQL equivalents
9. Monitor and deprecate REST endpoints that no longer have consumers

### When to reconsider

- If external integrations are all internal services you control, Approach C (GraphQL with REST
  facade) becomes viable
- If the team has no GraphQL experience, factor in 2-4 weeks of learning curve before productivity
  matches REST
- If the 15 endpoints are simple CRUD with no complex relationships, GraphQL may be over-engineering
  — consider whether the real problem is just response shaping, which REST can solve with sparse
  fieldsets or JSON:API
