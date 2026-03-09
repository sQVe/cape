# OAuth directive response

## Clarifying questions I would ask

Even though you say you already know what you want, I need to flag a fundamental mismatch before proceeding.

**Question 1: Are you asking me to add OAuth to the cape project itself?**

Cape is a Claude Code plugin -- a collection of markdown files (agents, commands, skills) and shell hook scripts. It has no web server, no backend, no package.json, no application code. There is nothing here to add passport.js or a Google OAuth strategy to. Passport.js is an Express/Node.js middleware library; it requires a running Node.js web application to function.

- **Default answer:** Yes, the user is referring to this project.

**Question 2: Did you mean to add OAuth to a different project, and you're issuing the request from within cape by mistake?**

- **Default answer:** No, the user means this project.

**Question 3: Are you asking me to create a new Claude Code command/skill within cape that helps scaffold OAuth into other projects?**

- **Default answer:** Unclear, but this is the only interpretation that makes sense given the codebase.

## Assessment

I would not proceed with this request as stated. Here is why:

1. **Cape has no application runtime.** It contains markdown definitions and shell scripts. There is no `package.json`, no `node_modules`, no Express server, no route handlers -- none of the infrastructure that passport.js requires.

2. **Adding passport.js here would be meaningless.** You cannot `require('passport')` in a markdown file or a shell hook. The technology is incompatible with this project's nature.

3. **"I already know what I want" does not override a technical impossibility.** Being directive is fine when the request is coherent with the codebase. This one is not.

## What I would do instead

I would push back and explain the mismatch, then offer two alternative paths:

### Alternative A: You meant a different project

If you have a Node.js/Express application where you want OAuth added, point me to that codebase and I will add passport.js with the Google strategy there. I would need:

- The project path
- Whether you already have Express configured
- Where session/user data should be stored
- The callback URL structure you want

### Alternative B: You want a cape skill/command that scaffolds OAuth

If you want a reusable Claude Code command within cape that helps add OAuth to any project on demand, I could create something like `commands/add-oauth.md` that instructs Claude to:

- Install `passport`, `passport-google-oauth20`, and `express-session`
- Create an auth configuration module
- Set up the Google strategy with environment variables
- Add the `/auth/google` and `/auth/google/callback` routes
- Configure session middleware

This would be a prompt template, not actual application code in cape itself.

## Recommendation

Tell me which project you actually want OAuth in, or confirm you want a cape command/skill that scaffolds OAuth into target projects. I will not add dead code to a markdown-and-shell plugin where it cannot run.
