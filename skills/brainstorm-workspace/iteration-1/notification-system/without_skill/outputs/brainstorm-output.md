# Notification system brainstorm

## Context

Node.js app needs multi-channel notifications (email, push, in-app) driven by user preferences.
Existing asset: `src/mailer.ts` handles basic email sending.

## What I'd investigate first

- **src/mailer.ts** — current interface, transport (Nodemailer? SendGrid SDK?), whether it's a class
  or function, error handling patterns.
- **User model** — where preferences would live, current schema.
- **Existing queue/job infrastructure** — Bull, BullMQ, or nothing yet.
- **Database** — SQL vs. Mongo, since in-app notifications need storage.
- **Auth/session layer** — needed for push subscription management and real-time delivery.

## Approaches

### Approach A: channel strategy pattern (recommended)

Define a `NotificationChannel` interface. Each channel (email, push, in-app) implements it. A
dispatcher reads user preferences and fans out to the relevant channels.

```typescript
interface NotificationChannel {
  send(userId: string, payload: NotificationPayload): Promise<void>;
}
```

Implementations: `EmailChannel` (wraps existing mailer), `PushChannel` (web-push or FCM),
`InAppChannel` (writes to DB, emits via WebSocket).

A `NotificationService.notify(userId, event, data)` method:

1. Looks up user preferences for that event type.
2. Filters to enabled channels.
3. Dispatches to each channel.

**Pros:** Open/closed — add SMS later without touching dispatcher. Each channel is independently
testable. Existing mailer wraps cleanly.

**Cons:** Slightly more upfront abstraction. Need to decide sync vs. async dispatch early.

### Approach B: event-driven with message queue

Publish a `notification.requested` event to a queue (BullMQ, RabbitMQ). Separate workers per channel
consume and deliver. Preference filtering happens either at publish time or in each worker.

**Pros:** Resilient — retries, dead-letter queues, backpressure. Channels scale independently. Email
doesn't block push delivery.

**Cons:** Infrastructure overhead (Redis for BullMQ at minimum). More complex local dev setup.
Harder to debug end-to-end.

### Approach C: simple function dispatch (minimal)

A single `sendNotification` function with a switch/case per channel. Preferences checked inline.

**Pros:** Fast to build. No abstractions to learn.

**Cons:** Grows into a mess quickly. Hard to test channels in isolation. Adding channels means
modifying core function.

## Trade-off analysis

| Concern             | A (Strategy)                   | B (Queue)            | C (Simple)           |
| ------------------- | ------------------------------ | -------------------- | -------------------- |
| Complexity          | Medium                         | High                 | Low                  |
| Scalability         | Good                           | Excellent            | Poor                 |
| Testability         | Excellent                      | Good                 | Fair                 |
| Reliability         | Good (add retries per channel) | Excellent (built-in) | Poor                 |
| Time to implement   | ~2-3 days                      | ~4-5 days            | ~1 day               |
| Adding new channels | Add one class                  | Add one worker       | Modify core function |

## Design recommendation

**Start with Approach A, design it so Approach B is a migration path.**

Concrete structure:

```
src/
  notifications/
    channels/
      email.ts          # wraps src/mailer.ts
      push.ts           # web-push / FCM
      in-app.ts         # DB write + WebSocket emit
    notification-service.ts   # dispatcher
    types.ts            # NotificationPayload, NotificationEvent, ChannelType
    preferences.ts      # reads/writes user notification preferences
```

### Key decisions

**1. Preference model.** Store per-event-type, per-channel booleans. Example schema:

```typescript
interface UserNotificationPreferences {
  userId: string;
  preferences: Record<NotificationEvent, ChannelType[]>;
}
```

Events like `"order.shipped"`, `"comment.reply"` each map to an array of enabled channels. Defaults
to all channels enabled; users opt out.

**2. In-app notification storage.** Needs a `notifications` table/collection:

| Field     | Type      |
| --------- | --------- |
| id        | uuid      |
| userId    | string    |
| event     | string    |
| title     | string    |
| body      | string    |
| read      | boolean   |
| createdAt | timestamp |

Expose via REST (`GET /notifications`, `PATCH /notifications/:id/read`) and real-time via WebSocket
or SSE.

**3. Push notifications.** Use the `web-push` library for browser push. Requires a
`push_subscriptions` table storing endpoint + keys per user/device. For mobile, use FCM via
`firebase-admin`.

**4. Async dispatch.** Even without a full queue, dispatch channels with `Promise.allSettled` so one
channel's failure doesn't block others. Log failures; add retry logic per channel (exponential
backoff with 3 attempts).

**5. Wrap the existing mailer.** `EmailChannel` should delegate to `src/mailer.ts` rather than
reimplementing. If mailer's interface is too narrow, extend it rather than replacing it.

### What to build first (vertical slice)

1. `types.ts` — define `NotificationPayload`, `NotificationEvent`, `ChannelType`.
2. `EmailChannel` — wrap existing mailer.
3. `InAppChannel` — DB write, skip WebSocket initially (poll via REST).
4. `NotificationService` — dispatcher with preference lookup.
5. `PushChannel` — add once the pattern is proven.

### Migration to queues (later)

When you need it, replace direct channel calls in `NotificationService` with queue publishes. Each
channel becomes a worker. The channel interface stays the same — only the dispatch mechanism
changes. This is why Approach A positions you well: the channel implementations don't care how
they're invoked.

## Open questions for the developer

1. What database are you using? This affects in-app notification storage and preference schema.
2. Is there existing WebSocket infrastructure, or would SSE be simpler for real-time in-app
   delivery?
3. Do you need notification templates (HTML emails, structured push payloads), or are plain text
   messages sufficient initially?
4. Should notifications be fire-and-forget, or do you need delivery confirmation/tracking?
5. What scale are we talking about — hundreds of users or hundreds of thousands? This determines
   whether queues are needed now or later.
