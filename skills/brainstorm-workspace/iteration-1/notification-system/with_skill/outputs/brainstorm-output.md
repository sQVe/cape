# Brainstorm: notification system

I'm using the brainstorming skill to refine your idea into a design.

---

## Step 1: Understand the idea

### Research findings

**Codebase investigation (simulated `cape:codebase-investigator` dispatch):**

- Found `src/mailer.ts` — existing email sender module. Exports a `sendEmail(to, subject, body)`
  function using nodemailer with SMTP transport configured via environment variables (`SMTP_HOST`,
  `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`).
- No existing notification abstraction, preference storage, or push notification infrastructure.
- No WebSocket or SSE setup for real-time in-app delivery.
- Database access exists via a shared ORM layer (e.g., `src/db/` with models and migrations).
- No queue or background job system currently in place.

**External research (simulated `cape:internet-researcher` dispatch):**

- Push notifications: Firebase Cloud Messaging (FCM) is the dominant cross-platform solution. Web
  Push API (VAPID) covers browser-only cases.
- In-app alerts: Server-Sent Events (SSE) or WebSockets for real-time delivery; polling as a simpler
  fallback.
- Preference management: standard pattern is a per-user preferences table with channel-level
  opt-in/opt-out per notification type.

### Clarifying questions (answered via research + simulated user judgment)

| Question                                          | Answer                                                 | Implication                                                            |
| ------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| What platforms need push notifications?           | Web and mobile (React Native)                          | FCM covers both; VAPID alone is insufficient                           |
| Is real-time delivery required for in-app alerts? | Nice to have, not critical                             | Polling or SSE acceptable; no need for full WebSocket infra            |
| How many notification types exist today?          | ~5 types (account, billing, team, security, marketing) | Preference model needs type-level granularity, not just global on/off  |
| Is there a background job system?                 | No                                                     | Need to introduce one for reliable async delivery                      |
| What's the expected volume?                       | Low-to-medium (~1K notifications/day)                  | No need for dedicated message broker; a lightweight job queue suffices |
| Should notifications be persisted for history?    | Yes, users need an in-app notification center          | Notifications table required, not just fire-and-forget                 |

---

## Step 2: Research and propose approaches

This idea touches multiple components (database, channels, preferences, delivery pipeline) and has
competing viable approaches. Using **divergent mode** — simulating 3 design agents under different
constraints.

### Three designs explored under different constraints:

### 1. Minimal (simplest interface)

**Approach:** Single `NotificationService.send(userId, type, payload)` function. Internally looks up
user preferences, fans out to enabled channels sequentially. Email reuses `src/mailer.ts`. Push uses
FCM SDK directly. In-app writes a row to a `notifications` table that the frontend polls.

- **Pros:** Fewest abstractions. One file orchestrates everything. Easy to understand and debug.
- **Cons:** Sequential delivery means a slow channel blocks the others. No retry logic. Adding a new
  channel requires editing the orchestrator. Tight coupling to each provider's SDK.
- **Trade-off:** Ships fast, but becomes painful beyond 3 channels or when reliability matters.

### 2. Flexible (maximum flexibility)

**Approach:** Channel-based plugin architecture. Define a `NotificationChannel` interface with
`send(recipient, payload)`. Each channel (email, push, in-app) is a separate module implementing the
interface. A `ChannelRegistry` discovers and manages channels. A `NotificationRouter` reads
preferences, resolves channels, and dispatches via a job queue. Preferences stored per
notification-type per channel with inheritance (global defaults, type overrides, channel overrides).

- **Pros:** Adding a channel is just implementing the interface and registering it. Full decoupling.
  Supports complex preference hierarchies. Queue provides retry and failure isolation.
- **Cons:** Over-engineered for 3 channels. Plugin discovery and registry add moving parts.
  Preference inheritance model is complex to query and explain to users.
- **Trade-off:** Built for 20 channels when you have 3. Premature abstraction.

### 3. Pragmatic (common case optimized)

**Approach:** Thin channel abstraction without plugin machinery. Each channel is a module exporting
`send(userId, notification): Promise<void>`. A `NotificationDispatcher` reads preferences from a
`notification_preferences` table (flat: `user_id, notification_type, channel, enabled`), filters to
enabled channels, and dispatches each via a lightweight job queue (e.g., BullMQ with Redis, or
`pg-boss` if Postgres-only). In-app notifications stored in a `notifications` table with `read_at`
tracking. Email channel wraps `src/mailer.ts`. Push channel wraps FCM SDK.

- **Pros:** Clear channel contract without over-abstraction. Job queue provides async delivery with
  retries. Flat preference model is simple to query and present in UI. Reuses existing mailer.
  Adding a 4th channel is just a new module + dispatcher entry.
- **Cons:** No auto-discovery; adding a channel requires a one-line registration. Preference model
  doesn't support complex inheritance.
- **Trade-off:** Handles the real use cases (3-5 channels, type-level preferences) without building
  for imaginary scale.

### Recommendation

**I recommend option 3 (Pragmatic)** because it matches the actual scale (~5 types, 3 channels,
~1K/day) while providing the reliability guarantees a notification system needs (async delivery,
retries, failure isolation). The minimal approach's sequential delivery is a real problem (a push
notification timeout shouldn't delay email), but the flexible approach's plugin registry and
preference inheritance are unjustified complexity.

From rejected designs worth absorbing: the flexible approach's explicit `NotificationChannel`
interface contract is worth keeping as a TypeScript interface even without the registry machinery —
it documents what each channel must implement.

---

## Step 3: Challenge assumptions (grill-me cadence)

### Branch 1/5: Job queue technology

Dispatching notifications synchronously in the request path risks timeouts and poor UX. A job queue
is needed. The question is which one.

**Recommended:** `pg-boss` if the app already uses Postgres (no new infrastructure). BullMQ + Redis
if Redis is already in the stack.

a) `pg-boss` (Postgres-backed) — zero new infrastructure if Postgres exists; slightly higher DB load
under volume b) BullMQ + Redis — battle-tested, faster polling, but requires Redis as new
infrastructure c) In-process queue (e.g., `p-queue`) — no infrastructure, but jobs lost on process
restart

**Simulated resolution:** The app uses Postgres but not Redis. Choosing **(a) `pg-boss`** to avoid
introducing Redis for ~1K jobs/day. If volume grows 10x+, migrating to BullMQ is straightforward
since the channel modules don't know about the queue.

---

### Branch 2/5: In-app notification delivery mechanism

The frontend needs to show new notifications. Three options with different complexity/latency
trade-offs.

**Recommended:** Polling with a short interval (15-30s). SSE or WebSocket can be added later without
changing the notification data model.

a) Polling (GET /notifications?unread=true every 15-30s) — simplest, works everywhere, slight
latency b) Server-Sent Events (SSE) — real-time, one-directional, moderate server complexity c)
WebSocket — real-time, bidirectional, highest complexity

**Simulated resolution:** Choosing **(a) Polling** for initial implementation. The `notifications`
table already supports this. A `last_checked_at` optimization prevents redundant queries. SSE can be
layered on later since it reads from the same table. No API contract changes needed for that
upgrade.

---

### Branch 3/5: Notification preference granularity

How fine-grained should user preferences be? This affects DB schema, settings UI complexity, and
dispatcher logic.

**Recommended:** Per notification-type, per channel. Flat table with sensible defaults.

a) Global per channel (email: on/off, push: on/off) — too coarse; users can't mute marketing emails
while keeping security alerts b) Per notification-type, per channel — right granularity for 5 types
x 3 channels = 15 toggles max c) Per notification-type, per channel, per frequency
(instant/digest/off) — adds digest batching complexity

**Simulated resolution:** Choosing **(b) per type, per channel**. Schema:
`notification_preferences(user_id, type, channel, enabled, created_at, updated_at)`. Defaults stored
in a config object, not the DB — preferences table only contains explicit user overrides. This keeps
the table small and makes "reset to defaults" trivial.

---

### Branch 4/5: Template system for notification content

Notifications need rendering across channels (email HTML, push title+body, in-app short text).
Should there be a template system?

**Recommended:** Each notification type defines a plain object with channel-specific renderers. No
template engine.

a) Template engine (Handlebars, Mustache) — familiar, but adds a dependency and template files for
simple string interpolation b) Per-type renderer functions — a `renderForEmail(data)`,
`renderForPush(data)`, `renderForInApp(data)` per notification type; type-safe, no extra dependency
c) Single message string, channels adapt — least effort, but push notifications with HTML email
content looks wrong

**Simulated resolution:** Choosing **(b) per-type renderer functions**. Each notification type is a
module exporting `{ type, renderEmail(data), renderPush(data), renderInApp(data) }`. TypeScript
enforces that all channels are covered. No template files to manage. If templates become complex
later, a single type's renderer can adopt a template engine without affecting others.

---

### Branch 5/5: Failure handling and retry policy

When a channel fails (SMTP down, FCM rejects token), what happens?

**Recommended:** Per-channel retry with exponential backoff via pg-boss. Failed jobs logged. No
cross-channel fallback (email failure doesn't trigger SMS).

a) Retry with backoff (3 attempts, exponential) — handles transient failures, pg-boss provides this
out of the box b) Retry + fallback to another channel — complex, and users explicitly chose their
channels c) No retry, log and move on — risks silent notification loss

**Simulated resolution:** Choosing **(a) retry with backoff**. pg-boss supports configurable retry
with exponential backoff natively. After 3 failed attempts, the job is marked as failed and logged.
A `notification_deliveries` table tracks delivery status per channel for debugging. No cross-channel
fallback — if a user disabled email, failing push should not suddenly send email.

---

All 5 decision branches resolved.

---

## Design summary

**Problem:** The app has a basic email sender but no unified notification system. Users need email,
push, and in-app notifications with per-type, per-channel preferences.

**Chosen approach:** Pragmatic dispatcher with thin channel abstraction, pg-boss job queue, and flat
preference model.

**Requirements:**

- Unified `NotificationDispatcher.send(userId, type, data)` entry point
- Three channel modules (email, push, in-app) implementing a shared `NotificationChannel` interface
- Per notification-type, per channel preference storage with config-based defaults
- Async delivery via pg-boss with per-channel retry (3 attempts, exponential backoff)
- `notifications` table for in-app notification history with `read_at` tracking
- `notification_deliveries` table for delivery audit trail
- Polling endpoint (GET /notifications) for frontend consumption
- Per-type renderer functions for channel-specific content formatting
- Wrap existing `src/mailer.ts` in the email channel module

**Anti-patterns:**

- NO synchronous dispatch in request handlers (reason: channel timeouts block the response and
  cascade failures)
- NO global on/off preferences only (reason: users need type-level granularity to mute marketing
  while keeping security alerts)
- NO cross-channel fallback on failure (reason: sending to a channel the user disabled violates
  their explicit preference)
- NO template engine dependency (reason: per-type renderers are simpler and type-safe for ~5
  notification types)
- NO WebSocket/SSE in initial implementation (reason: polling is sufficient for ~1K/day volume; SSE
  can be layered later without API changes)
- NO preference inheritance hierarchy (reason: flat model with config defaults covers the use case
  without query complexity)
- NO plugin registry or auto-discovery (reason: 3 channels don't justify registry machinery; a
  one-line import suffices)

**Architecture:**

```
Request/Event
    |
    v
NotificationDispatcher.send(userId, type, data)
    |
    ├── Read notification_preferences (with config defaults fallback)
    ├── Filter to enabled channels
    └── Enqueue one pg-boss job per enabled channel
            |
            ├── EmailChannel.send()  →  src/mailer.ts (existing)
            ├── PushChannel.send()   →  FCM SDK
            └── InAppChannel.send()  →  INSERT into notifications table
            |
            └── Log result to notification_deliveries table
```

**Scope:**

- **In:** dispatcher, 3 channels, preferences table + API, notifications table + polling API,
  delivery tracking, retry logic, per-type renderers
- **Out:** digest/batching, SSE/WebSocket real-time delivery, SMS channel, notification templates UI
  builder, analytics dashboard

**Open questions:**

- FCM project setup and credentials management (depends on existing deployment/secrets
  infrastructure)
- Push notification token registration flow (mobile and web clients need a registration endpoint)
- Whether notification preferences should have a settings UI in this iteration or be API-only

### Key decisions

| Question                   | Answer                                           | Implication                                                      |
| -------------------------- | ------------------------------------------------ | ---------------------------------------------------------------- |
| Target platforms for push? | Web + mobile (React Native)                      | Use FCM for cross-platform coverage                              |
| Real-time in-app delivery? | Not critical                                     | Polling (15-30s) for v1; SSE upgrade path preserved              |
| Notification types count?  | ~5 (account, billing, team, security, marketing) | Per-type, per-channel preferences manageable (15 toggles max)    |
| Background job system?     | None exists                                      | Introduce pg-boss (Postgres-backed, no new infra)                |
| Expected volume?           | ~1K/day                                          | No message broker needed; pg-boss handles this easily            |
| Persist for history?       | Yes                                              | notifications table with read_at tracking                        |
| Preference granularity?    | Per type, per channel                            | Flat table with config-based defaults                            |
| Content rendering?         | Per-type renderer functions                      | Type-safe, no template engine dependency                         |
| Failure strategy?          | Retry 3x with exponential backoff                | pg-boss native retry; failed jobs logged to delivery table       |
| In-app delivery?           | Polling                                          | 15-30s interval; SSE can be added later without contract changes |

### Research findings

**Codebase:**

- `src/mailer.ts` — existing nodemailer-based email sender; wrappable as the email channel
- `src/db/` — ORM layer available for new tables (notifications, notification_preferences,
  notification_deliveries)
- No existing queue, WebSocket, or notification infrastructure

**External:**

- Firebase Cloud Messaging (FCM): cross-platform push (web + mobile), free tier sufficient for
  ~1K/day
- pg-boss: Postgres-backed job queue, supports retry with backoff, no Redis dependency
- Web Push API (VAPID): browser-only alternative to FCM, insufficient for mobile

### Approaches considered

1. **Pragmatic dispatcher** (selected) — right-sized for 3 channels and ~5 types. Thin channel
   interface, pg-boss queue, flat preferences. Balances reliability with simplicity.
2. **Minimal sequential** — rejected because synchronous fan-out means one slow channel blocks
   others. No retry. Acceptable for prototyping but not production notifications.
3. **Flexible plugin architecture** — rejected because plugin registry, auto-discovery, and
   preference inheritance are over-engineered for 3 channels. DO NOT REVISIT UNLESS channel count
   exceeds 8+ or channels are contributed by external teams.

### Dead ends

- **In-process queue (p-queue):** explored as zero-infra alternative. Abandoned because jobs are
  lost on process restart — unacceptable for notifications. pg-boss adds no new infrastructure since
  Postgres already exists.
- **VAPID-only push:** explored as lighter alternative to FCM. Abandoned because it only covers web
  browsers, not React Native mobile.
- **Single message string across channels:** explored for simplicity. Abandoned because email needs
  HTML, push needs title+body, in-app needs short text — a single string produces poor UX on at
  least one channel.

---

Design summary complete. Run `/cape:write-plan` to formalize this into a br epic.
