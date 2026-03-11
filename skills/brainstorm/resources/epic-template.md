# Epic template

Use this template when creating `br` epics during brainstorming. Every section is required. Populate
from research findings, user decisions, and design validation captured during the brainstorm.

## Template

```
## Requirements (IMMUTABLE)
- [Specific, testable statement]
- [Specific, testable statement]

## Success criteria
- [ ] [Objective, testable criterion]
- [ ] [Objective, testable criterion]
- [ ] All tests passing
- [ ] Pre-commit hooks passing

## Anti-patterns (FORBIDDEN)
- NO [pattern] (reason: [why this is forbidden])
- NO [pattern] (reason: [why this is forbidden])

## Approach
[2-3 paragraph summary of chosen approach, referencing codebase patterns and research findings]

## Architecture
[Key components, data flow, integration points]

## Design rationale

### Problem
[1-2 sentences: what problem this solves, why status quo is insufficient]

### Research findings

**Codebase:**
- [file:line] - [what it does, why relevant]
- [pattern discovered, implications]

**External:**
- [API/library] - [key capability or constraint]
- [doc URL] - [relevant guidance]

### Approaches considered

#### 1. [Chosen approach] (selected)

**What:** [2-3 sentence description]
**Pros:** [benefits with evidence]
**Cons:** [drawbacks and mitigations]
**Chosen because:** [reasoning linking to requirements and codebase patterns]

#### 2. [Rejected approach] (rejected)

**What:** [2-3 sentence description]
**Why explored:** [what made it seem viable]
**Why rejected:** [specific flaw linking to requirements or constraints]
**DO NOT REVISIT UNLESS:** [condition that would change this decision]

### Scope boundaries

**In scope:** [explicit inclusions]
**Out of scope:** [explicit exclusions with reasoning]

### Open questions
- [Uncertainties to resolve during implementation]

## Design discovery

> Preserved context from brainstorming for use during task creation and obstacle handling.

### Key decisions made

| Question | Answer | Implication |
|----------|--------|-------------|
| [Question asked] | [User response] | [Effect on requirements/anti-patterns] |

### Research deep-dives

#### [Topic]
**Question:** [What drove this research?]
**Sources:** [What was consulted, key findings]
**Conclusion:** [How it informed the design]

### Dead-end paths

#### [Path name]
**Why explored:** [What made it worth investigating]
**What found:** [Investigation results]
**Why abandoned:** [Specific reason — prevents re-investigation]

### Open concerns raised
- [Concern] -> [Resolution or deferral]
```

## Worked example

```bash
br create "Epic: OAuth authentication" \
  --type epic \
  --priority 2 \
  --description "## Requirements (IMMUTABLE)
- Users authenticate via Google OAuth2
- Tokens stored in httpOnly cookies (NOT localStorage)
- Session expires after 24h inactivity
- Integrates with existing User model at db/models/user.ts

## Success criteria
- [ ] Login redirects to Google and back
- [ ] Tokens stored in httpOnly cookies
- [ ] Token refresh works automatically
- [ ] Integration tests pass without mocking OAuth
- [ ] All tests passing

## Anti-patterns (FORBIDDEN)
- NO localStorage tokens (reason: httpOnly prevents XSS token theft)
- NO new user model (reason: must use existing db/models/user.ts)
- NO mocking OAuth in integration tests (reason: defeats purpose of testing real flow)
- NO skipping token refresh (reason: explicit requirement from user)

## Approach
Extend existing passport.js setup at auth/passport-config.ts with Google OAuth2 strategy. Use passport-google-oauth20 library. Store tokens in httpOnly cookies via express-session. Integrate with existing User model for profile storage.

## Architecture
- auth/strategies/google.ts - New OAuth strategy
- auth/passport-config.ts - Register strategy (existing)
- db/models/user.ts - Add googleId field (existing)
- routes/auth.ts - OAuth callback routes

## Design rationale

### Problem
Users must create accounts manually. Manual signup has 40% abandonment. Google OAuth reduces friction.

### Research findings

**Codebase:**
- auth/passport-config.ts:1-50 - Existing passport setup, session-based auth
- auth/strategies/local.ts:1-30 - Pattern for adding strategies
- db/models/user.ts:1-80 - User model, already has email field

**External:**
- passport-google-oauth20 - Official Google strategy, 2M weekly downloads
- Google OAuth2 docs - Requires client ID, callback URL, scopes

### Approaches considered

#### 1. Extend passport.js with google-oauth20 (selected)

**What:** Add Google strategy following existing local strategy pattern.
**Pros:** Matches codebase pattern, session handling works, well-documented.
**Cons:** Adds npm dependency.
**Chosen because:** Consistent with auth/strategies/local.ts, minimal changes.

#### 2. Custom JWT-based OAuth (rejected)

**What:** Replace session auth with JWT tokens for OAuth flow.
**Why explored:** User mentioned JWTs might be better.
**Why rejected:** Scope creep — 15 files use req.session, would require full auth rewrite.
**DO NOT REVISIT UNLESS:** Already rewriting entire auth system in separate epic.

#### 3. Auth0 integration (rejected)

**What:** Use Auth0 managed service for OAuth.
**Why explored:** Third-party might reduce implementation complexity.
**Why rejected:** Overkill for single provider, introduces vendor dependency.
**DO NOT REVISIT UNLESS:** Need 3+ OAuth providers AND accept vendor dependency.

### Scope boundaries

**In scope:** Google OAuth login/signup, token storage, profile sync.
**Out of scope:** Other OAuth providers (deferred), account linking (deferred).

### Open questions
- Should failed OAuth create partial user record?
- Token refresh: silent vs prompt?

## Design discovery

### Key decisions made

| Question | Answer | Implication |
|----------|--------|-------------|
| Token storage? | httpOnly cookies | Anti-pattern: NO localStorage |
| New user model? | Use existing db/models/user.ts | Must add googleId, not new table |
| Session duration? | 24h inactive timeout | Need refresh token logic |
| Google OAuth down? | Graceful error message | No fallback auth required |

### Dead-end paths

#### Custom JWT implementation
**Why explored:** User mentioned JWTs might be better.
**What found:** 15 files use req.session, 2 week migration, security complexity.
**Why abandoned:** Scope creep — OAuth feature shouldn't rewrite existing auth.

### Open concerns raised
- Google OAuth down? -> Graceful error message, no fallback auth
- Account linking later? -> Deferred to future epic
- Token refresh behavior? -> Default silent, configurable"
```
