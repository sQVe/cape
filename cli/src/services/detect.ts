import { Effect, ServiceMap } from 'effect';

export interface DirectoryProbe {
  fileExists: (name: string) => boolean;
  directoryExists: (name: string) => boolean;
  readConfig: (name: string) => Record<string, unknown> | null;
}

export interface DetectResult {
  readonly language: string;
  readonly testFramework: string | null;
  readonly linter: string | null;
  readonly formatter: string | null;
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value != null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const hasPyDep = (probe: DirectoryProbe, name: string) => {
  const pyproject = probe.readConfig('pyproject.toml');
  if (pyproject == null) return false;

  const project = pyproject['project'];
  if (!isRecord(project)) return false;

  const deps = project['dependencies'];
  if (isStringArray(deps) && deps.some((d) => d.startsWith(name))) return true;

  const optDeps = project['optional-dependencies'];
  if (isRecord(optDeps)) {
    return Object.values(optDeps).some(
      (group) => isStringArray(group) && group.some((d) => d.startsWith(name)),
    );
  }

  return false;
};

const hasRuff = (probe: DirectoryProbe) => {
  if (probe.fileExists('ruff.toml')) return true;
  const pyproject = probe.readConfig('pyproject.toml');
  if (pyproject == null) return false;
  const tool = pyproject['tool'];
  return isRecord(tool) && tool['ruff'] != null;
};

const detectPython = (probe: DirectoryProbe) => ({
  language: 'python',
  testFramework: hasPyDep(probe, 'pytest') ? 'pytest' : null,
  linter: hasRuff(probe) ? 'ruff' : null,
  formatter: hasRuff(probe) ? 'ruff' : null,
});

const hasNodeDep = (probe: DirectoryProbe, name: string) => {
  const pkg = probe.readConfig('package.json');
  if (pkg == null) return false;

  const deps = pkg['dependencies'];
  const devDeps = pkg['devDependencies'];

  return (isRecord(deps) && deps[name] != null) || (isRecord(devDeps) && devDeps[name] != null);
};

const isTypescript = (probe: DirectoryProbe) => {
  if (probe.fileExists('tsconfig.json')) return true;
  return hasNodeDep(probe, 'typescript');
};

const detectTypescriptTestFramework = (probe: DirectoryProbe) => {
  if (hasNodeDep(probe, 'vitest')) return 'vitest';
  if (hasNodeDep(probe, 'jest')) return 'jest';
  return null;
};

const detectTypescriptLinter = (probe: DirectoryProbe) => {
  if (probe.fileExists('.oxlintrc.json')) return 'oxlint';
  if (hasNodeDep(probe, 'oxlint')) return 'oxlint';
  if (hasNodeDep(probe, 'eslint')) return 'eslint';
  return null;
};

const detectTypescriptFormatter = (probe: DirectoryProbe) => {
  if (probe.fileExists('.oxfmtrc.json')) return 'oxfmt';
  if (hasNodeDep(probe, 'oxfmt')) return 'oxfmt';
  if (hasNodeDep(probe, 'prettier')) return 'prettier';
  return null;
};

const detectTypescript = (probe: DirectoryProbe) => ({
  language: 'typescript',
  testFramework: detectTypescriptTestFramework(probe),
  linter: detectTypescriptLinter(probe),
  formatter: detectTypescriptFormatter(probe),
});

type Detector = (probe: DirectoryProbe) => DetectResult | null;

const detectLua = (probe: DirectoryProbe) => {
  if (
    !probe.fileExists('.stylua.toml') &&
    !probe.fileExists('.luacheckrc') &&
    !probe.fileExists('init.lua')
  ) {
    return null;
  }

  return {
    language: 'lua',
    testFramework: probe.fileExists('.busted') || probe.directoryExists('spec') ? 'busted' : null,
    linter: probe.fileExists('.luacheckrc') ? 'luacheck' : null,
    formatter: probe.fileExists('.stylua.toml') ? 'stylua' : null,
  };
};

const detectGo = (probe: DirectoryProbe) => {
  if (!probe.fileExists('go.mod')) return null;

  return {
    language: 'go',
    testFramework: 'go-test',
    linter:
      probe.fileExists('.golangci.yml') || probe.fileExists('.golangci.yaml')
        ? 'golangci-lint'
        : null,
    formatter: 'gofmt',
  };
};

const detectRust = (probe: DirectoryProbe) => {
  if (!probe.fileExists('Cargo.toml')) return null;

  return { language: 'rust', testFramework: 'cargo-test', linter: 'clippy', formatter: 'rustfmt' };
};

const detectors: Detector[] = [
  (probe) => (isTypescript(probe) ? detectTypescript(probe) : null),
  (probe) =>
    probe.fileExists('pyproject.toml') ||
    probe.fileExists('setup.py') ||
    probe.fileExists('requirements.txt')
      ? detectPython(probe)
      : null,
  detectLua,
  detectGo,
  detectRust,
];

export const detectEcosystems = (probe: DirectoryProbe) =>
  detectors.reduce<DetectResult[]>((results, detector) => {
    const result = detector(probe);
    if (result != null) results.push(result);
    return results;
  }, []);

export class DetectService extends ServiceMap.Service<
  DetectService,
  {
    readonly detect: () => Effect.Effect<DetectResult[], Error>;
  }
>()('DetectService') {}

export const getDetectResult = Effect.gen(function* () {
  const service = yield* DetectService;

  return yield* service.detect();
});
