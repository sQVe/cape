import { Effect } from 'effect';

import { logEvent } from '../../eventLog';
import { isTrivialFile } from '../detect';
import {
  countTestBlocks,
  isCodeFile,
  isTestFile,
  MAX_NEW_TEST_BLOCKS,
  parseEditInput,
  parseFilePath,
  parseWriteInput,
} from './parsing';
import { denyWith } from './skillGates';
import {
  HookService,
  readFlowPhase,
  readState,
  readTddState,
  writeTddState,
} from './state';

const checkTestBatching = (newCount: number, existingCount: number) =>
  Effect.gen(function* () {
    const flowPhase = yield* readFlowPhase();
    if (!flowPhase) {
      return null;
    }
    if (flowPhase !== 'executing' && flowPhase !== 'debugging') {
      return null;
    }

    const delta = newCount - existingCount;
    if (delta <= MAX_NEW_TEST_BLOCKS) {
      return null;
    }

    const reason = `TDD violation: adding ${delta} test blocks at once (max ${MAX_NEW_TEST_BLOCKS}). Write one failing test, run it with \`cape test\`, then add the next.`;
    logEvent('hook.PreToolUse', 'tdd-batching-denied');
    return denyWith(reason);
  });

const checkTddGate = (filePath: string, isNewFile: boolean, fileContent: string | null) =>
  Effect.gen(function* () {
    if (!isCodeFile(filePath)) {
      return null;
    }
    if (isTestFile(filePath)) {
      return null;
    }
    if (isNewFile) {
      return null;
    }
    if (fileContent != null && isTrivialFile(filePath, fileContent)) {
      return null;
    }

    const flowPhase = yield* readFlowPhase();
    if (!flowPhase) {
      return null;
    }
    const isActivePhase = flowPhase === 'executing' || flowPhase === 'debugging';
    if (!isActivePhase) {
      return null;
    }

    const state = yield* readTddState();

    if (state == null) {
      return null;
    }

    if (state.phase === 'red' || state.phase === 'green') {
      return null;
    }

    const reason =
      state.phase === 'writing-test'
        ? 'TDD gate: run the test before editing production code. Dispatch cape test-runner first.'
        : 'TDD gate: write a failing test before editing production code. Load cape:test-driven-development.';

    logEvent('hook.PreToolUse.Edit', reason);
    return denyWith(reason);
  });

export const preToolUseEdit = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const input = yield* service.readStdin();
    const filePath = parseFilePath(input);
    if (!filePath) {
      return null;
    }

    if (isTestFile(filePath)) {
      const editInput = parseEditInput(input);
      if (editInput != null) {
        const oldCount = countTestBlocks(editInput.oldString);
        const newCount = countTestBlocks(editInput.newString);
        const batchResult = yield* checkTestBatching(newCount, oldCount);
        if (batchResult != null) {
          return batchResult;
        }
      }
    }

    const fileContent = yield* service.readFile(filePath);
    return yield* checkTddGate(filePath, false, fileContent);
  });

export const preToolUseWrite = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const input = yield* service.readStdin();
    const writeInput = parseWriteInput(input);
    if (!writeInput) {
      return null;
    }

    if (isTestFile(writeInput.filePath)) {
      const existingContent = yield* service.readFile(writeInput.filePath);
      const existingCount = existingContent != null ? countTestBlocks(existingContent) : 0;
      const newCount = countTestBlocks(writeInput.content);
      const batchResult = yield* checkTestBatching(newCount, existingCount);
      if (batchResult != null) {
        return batchResult;
      }
    }

    const exists = yield* service.fileExists(writeInput.filePath);
    return yield* checkTddGate(writeInput.filePath, !exists, writeInput.content);
  });

const tddReminderAfterEdit = (filePath: string, eventName: 'Edit' | 'Write') =>
  Effect.gen(function* () {
    if (!isCodeFile(filePath)) {
      return null;
    }

    const flowPhase = yield* readFlowPhase();
    if (!flowPhase) {
      return null;
    }
    const isActivePhase = flowPhase === 'executing' || flowPhase === 'debugging';
    if (!isActivePhase) {
      return null;
    }

    const state = yield* readTddState();
    const logName = `hook.PostToolUse.${eventName}` as const;

    if (state == null) {
      const rawState = yield* readState();
      const hasStaleOrMalformedState = rawState.tddState != null;
      if (flowPhase === 'debugging' || hasStaleOrMalformedState) {
        logEvent(logName, 'tdd-reminder-stale-state');
        return {
          additionalContext: [
            'TDD reminder: test state is stale or invalid.',
            'Ensure you have a current, valid failing test before continuing.',
          ].join(' '),
        };
      }
      return null;
    }

    if (isTestFile(filePath)) {
      if (state.phase === 'writing-test') {
        logEvent(logName, 'tdd-batching');
        return {
          additionalContext: [
            'TDD batching warning: you are writing another test before running the previous one.',
            'Dispatch cape:test-runner now. One test at a time — write it, run it, then proceed.',
          ].join(' '),
        };
      }
      yield* writeTddState('writing-test');
      return null;
    }

    if (state.phase === 'red') {
      return null;
    }

    logEvent(logName, 'tdd-reminder');
    return {
      additionalContext: [
        'TDD reminder: you are editing production code without a failing test.',
        'Consider writing or updating a test first, then making it fail, before changing this code.',
      ].join(' '),
    };
  });

export const postToolUseEdit = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const input = yield* service.readStdin();
    const filePath = parseFilePath(input);
    if (!filePath) {
      return null;
    }
    return yield* tddReminderAfterEdit(filePath, 'Edit');
  });

export const postToolUseWrite = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const input = yield* service.readStdin();
    const writeInput = parseWriteInput(input);
    if (!writeInput) {
      return null;
    }
    return yield* tddReminderAfterEdit(writeInput.filePath, 'Write');
  });
