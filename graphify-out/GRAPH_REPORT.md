# Graph Report - abu-184-tighten-cape-skills-routing-and-cli-from-the-opus-48-audit  (2026-07-02)

## Corpus Check
- 163 files · ~72,044 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 815 nodes · 1431 edges · 75 communities (71 shown, 4 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 34 edges (avg confidence: 0.51)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `696b17d1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 17 edges
2. `main` - 16 edges
3. `scripts` - 15 edges
4. `HookService` - 14 edges
5. `spyConsole()` - 12 edges
6. `preToolUseBash()` - 11 edges
7. `stubCommitLayer` - 11 edges
8. `stubValidateLayer` - 11 edges
9. `stubConformLayer` - 11 edges
10. `dieWithError()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `readFile()` --calls--> `tryReadFileUtf8()`  [EXTRACTED]
  cli/src/services/hookLive.ts → cli/src/utils/fs.ts
- `readFile()` --calls--> `readFileUtf8()`  [EXTRACTED]
  cli/src/services/prLive.ts → cli/src/utils/fs.ts
- `hasNodeDep()` --calls--> `check`  [INFERRED]
  cli/src/services/detect.ts → cli/src/commands/check.ts
- `parseRuleFile()` --calls--> `splitFrontmatter()`  [EXTRACTED]
  cli/src/services/conform.ts → cli/src/utils/frontmatter.ts
- `discoverRules()` --calls--> `parseRuleFile()`  [EXTRACTED]
  cli/src/services/conformLive.ts → cli/src/services/conform.ts

## Import Cycles
- None detected.

## Communities (75 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (64): hookRun, readCache(), run, trackerPath(), logEvent(), pluginRoot(), DenyEntry, denyTable (+56 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (36): check, buildSourceTestMap(), CONFIG_PATTERNS, detectEcosystems(), Detector, detectors, detectPython(), detectTypescript() (+28 more)

### Community 2 - "Community 2"
Cohesion: 0.10
Nodes (28): agentNameFromPath(), skillNameFromPath(), run, validate, validateByType(), validTypes, checkAgentReferences(), checkDuplicateTags() (+20 more)

### Community 3 - "Community 3"
Cohesion: 0.13
Nodes (24): cacheEpic, cacheStatus, cacheTasks, TrackerCache, CachedIssueStatusUpdate, issueLabels(), issueProject(), issueStateType() (+16 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (29): devDependencies, fallow, oxfmt, oxlint, tsx, @types/node, typescript, vite-plus (+21 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (13): REPO_ROOT, BINARY, cape(), capeCmd(), cleanupTestRepo(), GIT_ENV, gitInRepo(), initTestRepo() (+5 more)

### Community 6 - "Community 6"
Cohesion: 0.12
Nodes (14): commit, commandLayers, run, commitNoEdit(), CommitResult, CommitService, detectSensitiveFiles(), sensitivePatterns (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.13
Nodes (18): CheckCommand, CheckResult, formatCommands, lintCommands, nodeExecutor(), nodeTestCommand(), resolveCheckCommands(), testCommands (+10 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (19): Bug, Epic — Full, Epic — Light (default), Linear issue templates, Task, Automated (done), Manual steps (run in the Linear UI), Workspace setup (+11 more)

### Community 9 - "Community 9"
Cohesion: 0.15
Nodes (7): flowPhaseEntry(), flowPhaseEntryForIssue(), flowPhaseFile(), run, stateFile(), trackerCacheFile(), trackerGateFiles()

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (18): compilerOptions, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution (+10 more)

### Community 11 - "Community 11"
Cohesion: 0.11
Nodes (18): [1.0.0] - 2026-03-06, [1.1.0] - 2026-03-25, [1.2.0] - 2026-03-26, [1.3.0] - 2026-03-26, Added, Added, Added, Added (+10 more)

### Community 12 - "Community 12"
Cohesion: 0.12
Nodes (16): bin, cape, dependencies, effect, @effect/platform-node, smol-toml, devDependencies, tsdown (+8 more)

### Community 13 - "Community 13"
Cohesion: 0.18
Nodes (10): makeHookLayer(), makeLayers(), run, run, main, stubPrLayer, stubValidateLayer, base (+2 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (8): HookServiceLive, readFile(), mockExecFileSync, mockExistsSync, mockMkdirSync, mockReadFileSync, mockRmSync, mockWriteFileSync

### Community 15 - "Community 15"
Cohesion: 0.17
Nodes (9): run, composeLabels(), HerdrService, phaseIcon(), phaseIcons, shortTitle(), WorkspaceLabels, WorkspacePhase (+1 more)

### Community 16 - "Community 16"
Cohesion: 0.13
Nodes (13): Cape, Conventions, Development, Agents, Cape, Contributing, Inline review with hunk (optional), Installation (+5 more)

### Community 17 - "Community 17"
Cohesion: 0.15
Nodes (11): git, hook, pr, tracker, workspace, workspacePhase, validPhases, worktree (+3 more)

### Community 18 - "Community 18"
Cohesion: 0.16
Nodes (7): run, testLayers, run, GitContext, GitService, stubCheckLayer, stubConformLayer

### Community 19 - "Community 19"
Cohesion: 0.16
Nodes (5): detectMainBranch(), git(), GitServiceLive, mockExecFileSync, tryGit()

### Community 20 - "Community 20"
Cohesion: 0.22
Nodes (11): prCreate, prTemplate, prValidate, defaultContent, extractPrSections(), extractUncheckedBoxes(), findTemplate(), PrService (+3 more)

### Community 21 - "Community 21"
Cohesion: 0.22
Nodes (7): commandLayers, run, CheckService, DetectService, stubGitLayer, stubHerdrLayer, stubHookLayer

### Community 22 - "Community 22"
Cohesion: 0.23
Nodes (9): gitContext, gitCreateBranch, gitDiff, BRANCH_PREFIXES, BranchCreation, BranchValidation, getCreateBranch(), getGitContext (+1 more)

### Community 23 - "Community 23"
Cohesion: 0.27
Nodes (8): discoverRules(), readFiles(), mockGitRoot, mockGlobSync, mockHomedir, mockTryReadFileUtf8, tryReadFileUtf8(), gitRoot()

### Community 24 - "Community 24"
Cohesion: 0.17
Nodes (7): PrServiceLive, readFile(), mockExecFileSync, mockExistsSync, mockGitRoot, mockReadFileSync, mockReadFileUtf8

### Community 25 - "Community 25"
Cohesion: 0.24
Nodes (6): conform, ConformInput, DIFF_SCOPES, DiffScope, getGitDiff(), catchAndDie()

### Community 26 - "Community 26"
Cohesion: 0.20
Nodes (9): catalogByKey, formatActiveEntry(), formatTtlRemaining(), state, STATE_KEY_CATALOG, stateClear, stateList, stateReset (+1 more)

### Community 27 - "Community 27"
Cohesion: 0.29
Nodes (6): ValidateService, mockGitRoot, mockGlobSync, mockReadFileUtf8, ValidateServiceLive, readFileUtf8()

### Community 28 - "Community 28"
Cohesion: 0.18
Nodes (10): Dispatch `cape:code-reviewer` when:, Dispatch `cape:codebase-investigator` when:, Dispatch `cape:fact-checker` when:, Load `cape:test-driven-development` with the Skill tool when:, Load `cape:tracker` with the Skill tool when:, Step 1: Orient from tracker cache, Step 2: Expand in session, Step 3: Implement and verify (+2 more)

### Community 29 - "Community 29"
Cohesion: 0.18
Nodes (10): Dispatch `cape:code-reviewer` when:, Dispatch `cape:test-runner` when:, Load `cape:commit` with the Skill tool when:, Load `cape:review` with the Skill tool when:, Load `cape:tracker` with the Skill tool when:, Step 1: Confirm completion from cache, Step 2: Audit acceptance criteria, Step 3: Run final verification (+2 more)

### Community 30 - "Community 30"
Cohesion: 0.29
Nodes (7): run, ChangedFile, ConformService, extractChangedPaths(), parseGlobs(), parseRuleFile(), RuleFile

### Community 31 - "Community 31"
Cohesion: 0.20
Nodes (9): `cape:fact-checker` protocol (model: sonnet, Step 4):, CHECKPOINT: Present approaches for discussion, CHECKPOINT: Present research summary, Divergent mode — 3 parallel design sub-agents:, Research protocol:, Step 1: Research and understand, Step 2: Propose approaches, Step 3: Audit assumptions (+1 more)

### Community 32 - "Community 32"
Cohesion: 0.20
Nodes (9): Load `cape:commit` with the Skill tool when:, Load `cape:fix-bug` with the Skill tool when:, Load `cape:test-driven-development` with the Skill tool when:, Load the global `stop-slop` skill with the Skill tool when:, Step 1: Resolve the PR and fetch threads and review summaries, Step 2: Triage validity, Step 4: Apply accepted fixes, Step 5: Commit, respond, and resolve (+1 more)

### Community 33 - "Community 33"
Cohesion: 0.22
Nodes (8): audit, deadCodeBaseline, dupesBaseline, gate, healthBaseline, production, dupes, $schema

### Community 34 - "Community 34"
Cohesion: 0.25
Nodes (6): readJsonInput(), readStdin(), dieWithError(), UserError, getCheckResults(), getDetectResult

### Community 35 - "Community 35"
Cohesion: 0.22
Nodes (3): repoTemplate, run, stubDetectLayer

### Community 36 - "Community 36"
Cohesion: 0.22
Nodes (8): Dispatch `cape:code-reviewer` when:, Dispatch `cape:codebase-investigator` bug-tracer mode when:, Load `cape:test-driven-development` with the Skill tool when:, Load `cape:tracker` with the Skill tool when:, Step 1: Diagnose and track, Step 2: Reproduce and start, Step 3: Fix with TDD, Step 4: Verify and close

### Community 37 - "Community 37"
Cohesion: 0.22
Nodes (8): Load `cape:tracker` with the Skill tool when:, Step 1: Determine scope, Step 2: Build structural context, Step 3: Check documented conventions, Step 4: Review the changes, Step 5: Present report, Step 6: Annotate a live hunk session, Step 7: Optional tracking

### Community 38 - "Community 38"
Cohesion: 0.25
Nodes (4): defaultCreateResult, defaultValidation, run, stubCommitLayer

### Community 39 - "Community 39"
Cohesion: 0.25
Nodes (7): Step 1: Detect PR template, Step 2: Validate prerequisites, Step 3: Prepare branch, Step 4: Check contribution requirements, Step 5: Create PR description, Step 7: Finalize, STOP — Step 6: Present, approve, execute, create (OUTPUT GATE)

### Community 40 - "Community 40"
Cohesion: 0.25
Nodes (7): Load `cape:execute-plan` with the Skill tool when:, Load `cape:write-plan` with the Skill tool when:, Step 1: Identify the epic, Step 2: Derive the branch slug, Step 3: Ensure the grove worktree, Step 4: Stamp cape context, Step 5: Start focused work

### Community 41 - "Community 41"
Cohesion: 0.29
Nodes (6): AppLayer, args, cmd, cmdSegments, skipCommands, ConformServiceLive

### Community 42 - "Community 42"
Cohesion: 0.33
Nodes (5): Dispatch `cape:agent-name` when:, Load `cape:skill-name` with the Skill tool when:, Step 1: [Title], Step 2: [Title], Step 3: [Title]

### Community 43 - "Community 43"
Cohesion: 0.29
Nodes (6): Load `cape:tracker` with the Skill tool when:, Load `cape:write-plan` with the Skill tool when:, Step 1: Orient from the tracker cache, Step 2: Interview the approach, Step 3: Render the draft, Step 4: Open the draft for launch

### Community 44 - "Community 44"
Cohesion: 0.33
Nodes (5): Step 1: Gather context, Step 2: Analyze the diff, Step 3: Propose staging and message, Step 5: Execute, STOP — Step 4: Confirm

### Community 45 - "Community 45"
Cohesion: 0.33
Nodes (5): `cape:test-runner` protocol (model: haiku):, Step 1: Confirm you can lean on tests, Step 2: Drive the next behavior with a failing test, Step 3: Make it pass, then decide whether cleanup helps, The batching failure mode

### Community 46 - "Community 46"
Cohesion: 0.40
Nodes (4): Format, Pull request template, Section guidelines, Test plan format

### Community 47 - "Community 47"
Cohesion: 0.50
Nodes (3): Investigation approach, Scale by scope, Skepticism calibration

### Community 48 - "Community 48"
Cohesion: 0.50
Nodes (3): Investigation approach, Modes, Scale by scope

### Community 49 - "Community 49"
Cohesion: 0.50
Nodes (3): Investigation approach, Quote extraction, Source tiers

### Community 50 - "Community 50"
Cohesion: 0.50
Nodes (3): Investigation approach, Report format, Scale by scope

### Community 51 - "Community 51"
Cohesion: 0.50
Nodes (3): Step 1: Route the request, Step 2: Follow the chain, Step 3: Use skills correctly

## Knowledge Gaps
- **330 isolated node(s):** `$schema`, `gate`, `deadCodeBaseline`, `healthBaseline`, `dupesBaseline` (+325 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HookService` connect `Community 15` to `Community 0`, `Community 35`, `Community 9`, `Community 13`, `Community 14`, `Community 20`, `Community 21`, `Community 26`, `Community 30`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `main` connect `Community 13` to `Community 0`, `Community 2`, `Community 35`, `Community 5`, `Community 38`, `Community 6`, `Community 9`, `Community 41`, `Community 15`, `Community 17`, `Community 18`, `Community 21`, `Community 30`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `logEvent()` connect `Community 0` to `Community 9`, `Community 41`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `$schema`, `gate`, `deadCodeBaseline` to the rest of the system?**
  _330 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.055176890619928594 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06560283687943262 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.10241820768136557 - nodes in this community are weakly interconnected._