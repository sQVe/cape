# Graph Report - ABU-72  (2026-06-25)

## Corpus Check
- 159 files · ~67,374 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 801 nodes · 1404 edges · 74 communities (70 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5d586021`
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
- `runChecks()` --calls--> `resolveCheckCommands()`  [EXTRACTED]
  cli/src/services/checkLive.ts → cli/src/services/check.ts
- `parseRuleFile()` --calls--> `splitFrontmatter()`  [EXTRACTED]
  cli/src/services/conform.ts → cli/src/utils/frontmatter.ts
- `discoverRules()` --calls--> `parseRuleFile()`  [EXTRACTED]
  cli/src/services/conformLive.ts → cli/src/services/conform.ts

## Import Cycles
- None detected.

## Communities (74 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (57): hookRun, DenyEntry, denyTable, DenyTier, continuePatterns, detectBugReport(), detectExecutePlan(), detectTrackerSkill() (+49 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (34): cacheEpic, cacheStatus, cacheTasks, readJsonInput(), readStdin(), tracker, validPhases, worktree (+26 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (19): git, gitContext, gitCreateBranch, gitDiff, BRANCH_PREFIXES, BranchCreation, BranchValidation, DIFF_SCOPES (+11 more)

### Community 3 - "Community 3"
Cohesion: 0.10
Nodes (25): run, validate, validateByType(), validTypes, checkAgentReferences(), checkDuplicateTags(), checkTagOrdering(), CommandValidateOptions (+17 more)

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
Nodes (13): run, testLayers, defaultCreateResult, defaultValidation, run, run, DetectService, GitContext (+5 more)

### Community 8 - "Community 8"
Cohesion: 0.14
Nodes (15): CONFIG_PATTERNS, Detector, detectors, detectTypescript(), detectTypescriptFormatter(), detectTypescriptLinter(), detectTypescriptTestFramework(), hasNodeDep() (+7 more)

### Community 9 - "Community 9"
Cohesion: 0.14
Nodes (11): run, workspace, workspacePhase, composeLabels(), HerdrService, phaseIcon(), phaseIcons, shortTitle() (+3 more)

### Community 10 - "Community 10"
Cohesion: 0.11
Nodes (18): compilerOptions, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleResolution (+10 more)

### Community 11 - "Community 11"
Cohesion: 0.11
Nodes (17): [1.0.0] - 2026-03-06, [1.1.0] - 2026-03-25, [1.2.0] - 2026-03-26, [1.3.0] - 2026-03-26, Added, Added, Added, Added (+9 more)

### Community 12 - "Community 12"
Cohesion: 0.12
Nodes (16): bin, cape, dependencies, effect, @effect/platform-node, smol-toml, devDependencies, tsdown (+8 more)

### Community 13 - "Community 13"
Cohesion: 0.15
Nodes (7): flowPhaseEntry(), flowPhaseEntryForIssue(), flowPhaseFile(), run, stateFile(), trackerCacheFile(), trackerGateFiles()

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (8): HookServiceLive, readFile(), mockExecFileSync, mockExistsSync, mockMkdirSync, mockReadFileSync, mockRmSync, mockWriteFileSync

### Community 15 - "Community 15"
Cohesion: 0.13
Nodes (13): Bug, Epic, Linear issue templates, Task, Automated (done), Manual steps (run in the Linear UI), Workspace setup, Agent contract (+5 more)

### Community 16 - "Community 16"
Cohesion: 0.13
Nodes (13): Cape, Conventions, Development, Agents, Cape, Contributing, Inline review with hunk (optional), Installation (+5 more)

### Community 17 - "Community 17"
Cohesion: 0.20
Nodes (12): pr, prCreate, prTemplate, prValidate, defaultContent, extractPrSections(), extractUncheckedBoxes(), findTemplate() (+4 more)

### Community 18 - "Community 18"
Cohesion: 0.20
Nodes (13): check, CheckCommand, CheckResult, formatCommands, getCheckResults(), lintCommands, nodeExecutor(), nodeTestCommand() (+5 more)

### Community 19 - "Community 19"
Cohesion: 0.19
Nodes (9): hook, makeHookLayer(), makeLayers(), run, run, HookService, main, stubConformLayer (+1 more)

### Community 20 - "Community 20"
Cohesion: 0.22
Nodes (9): conform, run, ChangedFile, ConformInput, ConformService, extractChangedPaths(), parseGlobs(), parseRuleFile() (+1 more)

### Community 21 - "Community 21"
Cohesion: 0.25
Nodes (9): ConformServiceLive, discoverRules(), readFiles(), mockGitRoot, mockGlobSync, mockHomedir, mockTryReadFileUtf8, tryReadFileUtf8() (+1 more)

### Community 22 - "Community 22"
Cohesion: 0.17
Nodes (7): PrServiceLive, readFile(), mockExecFileSync, mockExistsSync, mockGitRoot, mockReadFileSync, mockReadFileUtf8

### Community 23 - "Community 23"
Cohesion: 0.20
Nodes (8): CheckServiceLive, fileProbe, runChecks(), mockExistsSync, mockSpawnSync, checkPackageManager(), detectPackageManager(), DetectResult

### Community 24 - "Community 24"
Cohesion: 0.20
Nodes (9): catalogByKey, formatActiveEntry(), formatTtlRemaining(), state, STATE_KEY_CATALOG, stateClear, stateList, stateReset (+1 more)

### Community 25 - "Community 25"
Cohesion: 0.24
Nodes (7): readCache(), run, trackerPath(), base, baseCommandLayers, makeTestCommandLayers(), spyConsole()

### Community 26 - "Community 26"
Cohesion: 0.18
Nodes (10): Dispatch `cape:code-reviewer` when:, Dispatch `cape:codebase-investigator` when:, Dispatch `cape:fact-checker` when:, Load `cape:test-driven-development` with the Skill tool when:, Load `cape:tracker` with the Skill tool when:, Step 1: Orient From Tracker Cache, Step 2: Expand In Session, Step 3: Implement And Verify (+2 more)

### Community 27 - "Community 27"
Cohesion: 0.18
Nodes (10): Dispatch `cape:code-reviewer` when:, Dispatch `cape:test-runner` when:, Load `cape:commit` with the Skill tool when:, Load `cape:review` with the Skill tool when:, Load `cape:tracker` with the Skill tool when:, Step 1: Confirm Completion From Cache, Step 2: Audit Success Criteria, Step 3: Run Final Verification (+2 more)

### Community 28 - "Community 28"
Cohesion: 0.24
Nodes (9): buildSourceTestMap(), detectEcosystems(), DirectoryProbe, resolveTestPath(), detect(), findWorkspaceRoot(), lockfiles, mapDirectory() (+1 more)

### Community 29 - "Community 29"
Cohesion: 0.29
Nodes (6): ValidateService, mockGitRoot, mockGlobSync, mockReadFileUtf8, ValidateServiceLive, readFileUtf8()

### Community 30 - "Community 30"
Cohesion: 0.20
Nodes (9): `cape:fact-checker` protocol (model: sonnet, Step 4):, CHECKPOINT: Present approaches for discussion, CHECKPOINT: Present research summary, Divergent mode — 3 parallel design sub-agents:, Research protocol:, Step 1: Research and understand, Step 2: Propose approaches, Step 3: Audit assumptions (+1 more)

### Community 31 - "Community 31"
Cohesion: 0.22
Nodes (4): commandLayers, run, CheckService, stubHerdrLayer

### Community 32 - "Community 32"
Cohesion: 0.22
Nodes (3): repoTemplate, run, stubHookLayer

### Community 33 - "Community 33"
Cohesion: 0.22
Nodes (8): audit, deadCodeBaseline, dupesBaseline, gate, healthBaseline, production, dupes, $schema

### Community 34 - "Community 34"
Cohesion: 0.22
Nodes (8): Dispatch `cape:code-reviewer` when:, Dispatch `cape:codebase-investigator` bug-tracer mode when:, Load `cape:test-driven-development` with the Skill tool when:, Load `cape:tracker` with the Skill tool when:, Step 1: Diagnose And Track, Step 2: Reproduce And Start, Step 3: Fix With TDD, Step 4: Verify And Close

### Community 35 - "Community 35"
Cohesion: 0.22
Nodes (8): Load `cape:tracker` with the Skill tool when:, Step 1: Determine Scope, Step 2: Build Structural Context, Step 3: Check Documented Conventions, Step 4: Review The Changes, Step 5: Present Report, Step 6: Annotate A Live hunk Session, Step 7: Optional Tracking

### Community 36 - "Community 36"
Cohesion: 0.22
Nodes (5): DetectServiceLive, mockExistsSync, mockReaddirSync, mockReadFileUtf8, _mockStatSync

### Community 37 - "Community 37"
Cohesion: 0.25
Nodes (6): UserError, AppLayer, args, cmd, cmdSegments, skipCommands

### Community 38 - "Community 38"
Cohesion: 0.25
Nodes (7): Step 1: Detect PR template, Step 2: Validate prerequisites, Step 3: Prepare branch, Step 4: Check contribution requirements, Step 5: Create PR description, Step 7: Finalize, STOP — Step 6: Present, approve, execute, create (OUTPUT GATE)

### Community 39 - "Community 39"
Cohesion: 0.29
Nodes (6): Load `cape:tracker` with the Skill tool when:, Load `cape:write-plan` with the Skill tool when:, Step 1: Orient from the tracker cache, Step 2: Interview the approach, Step 3: Render the draft, Step 4: Open the draft for launch

### Community 40 - "Community 40"
Cohesion: 0.29
Nodes (6): Load `cape:execute-plan` with the Skill tool when:, Load `cape:write-plan` with the Skill tool when:, Step 1: Identify the epic, Step 2: Ensure the grove worktree, Step 3: Stamp cape context, Step 4: Start focused work

### Community 41 - "Community 41"
Cohesion: 0.33
Nodes (5): Step 1: Gather context, Step 2: Analyze the diff, Step 3: Propose staging and message, Step 5: Execute, STOP — Step 4: Confirm

### Community 42 - "Community 42"
Cohesion: 0.33
Nodes (5): Dispatch `cape:agent-name` when:, Load `cape:skill-name` with the Skill tool when:, Step 1: [Title], Step 2: [Title], Step 3: [Title]

### Community 43 - "Community 43"
Cohesion: 0.40
Nodes (6): detectPython(), hasPyDep(), hasRuff(), isRecord(), isStringArray(), createProbe()

### Community 44 - "Community 44"
Cohesion: 0.33
Nodes (5): `cape:test-runner` protocol (model: haiku):, Step 1: Confirm you can lean on tests, Step 2: Drive the next behavior with a failing test, Step 3: Make it pass, then decide whether cleanup helps, The batching failure mode

### Community 45 - "Community 45"
Cohesion: 0.33
Nodes (5): Load `cape:tracker` with the Skill tool when:, Step 1: Verify Design Context, Step 2: Refine Into Epic Contract, Step 3: Create Linear Epic And First Task, Step 4: Present And Stop

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
Nodes (3): Step 1: Route The Request, Step 2: Follow The Chain, Step 3: Use Skills Correctly

## Knowledge Gaps
- **318 isolated node(s):** `$schema`, `gate`, `deadCodeBaseline`, `healthBaseline`, `dupesBaseline` (+313 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HookService` connect `Community 19` to `Community 32`, `Community 0`, `Community 7`, `Community 9`, `Community 13`, `Community 14`, `Community 17`, `Community 20`, `Community 24`, `Community 25`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `main` connect `Community 19` to `Community 32`, `Community 3`, `Community 5`, `Community 6`, `Community 7`, `Community 37`, `Community 9`, `Community 13`, `Community 20`, `Community 25`, `Community 31`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `logEvent()` connect `Community 0` to `Community 37`, `Community 13`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `$schema`, `gate`, `deadCodeBaseline` to the rest of the system?**
  _318 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06540825285338016 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07188160676532769 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.0915915915915916 - nodes in this community are weakly interconnected._