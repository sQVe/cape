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

const hasNodeDep = (probe: DirectoryProbe, name: string, fallback?: DirectoryProbe) => {
  const check = (p: DirectoryProbe) => {
    const pkg = p.readConfig('package.json');
    if (pkg == null) return false;
    const deps = pkg['dependencies'];
    const devDeps = pkg['devDependencies'];
    return (isRecord(deps) && deps[name] != null) || (isRecord(devDeps) && devDeps[name] != null);
  };

  return check(probe) || (fallback != null && check(fallback));
};

const isTypescript = (probe: DirectoryProbe) => {
  if (probe.fileExists('tsconfig.json')) return true;
  return hasNodeDep(probe, 'typescript');
};

const detectTypescriptTestFramework = (probe: DirectoryProbe, fallback?: DirectoryProbe) => {
  if (hasNodeDep(probe, 'vite-plus', fallback)) return 'vite-plus';
  if (hasNodeDep(probe, 'vitest', fallback)) return 'vitest';
  if (hasNodeDep(probe, 'jest', fallback)) return 'jest';
  return null;
};

const detectTypescriptLinter = (probe: DirectoryProbe, fallback?: DirectoryProbe) => {
  if (probe.fileExists('.oxlintrc.json')) return 'oxlint';
  if (hasNodeDep(probe, 'oxlint', fallback)) return 'oxlint';
  if (hasNodeDep(probe, 'eslint', fallback)) return 'eslint';
  return null;
};

const detectTypescriptFormatter = (probe: DirectoryProbe, fallback?: DirectoryProbe) => {
  if (probe.fileExists('.oxfmtrc.json')) return 'oxfmt';
  if (hasNodeDep(probe, 'oxfmt', fallback)) return 'oxfmt';
  if (hasNodeDep(probe, 'prettier', fallback)) return 'prettier';
  return null;
};

const detectTypescript = (probe: DirectoryProbe, fallback?: DirectoryProbe) => ({
  language: 'typescript',
  testFramework: detectTypescriptTestFramework(probe, fallback),
  linter: detectTypescriptLinter(probe, fallback),
  formatter: detectTypescriptFormatter(probe, fallback),
});

type Detector = (probe: DirectoryProbe, fallback?: DirectoryProbe) => DetectResult | null;

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

  return {
    language: 'rust',
    testFramework: 'cargo-test',
    linter: 'clippy',
    formatter: 'rustfmt',
  };
};

const detectors: Detector[] = [
  (probe, fallback) => (isTypescript(probe) ? detectTypescript(probe, fallback) : null),
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

export const detectEcosystems = (probe: DirectoryProbe, fallback?: DirectoryProbe) =>
  detectors.reduce<DetectResult[]>((results, detector) => {
    const result = detector(probe, fallback);
    if (result != null) results.push(result);
    return results;
  }, []);

export const isTestFile = (language: string, filePath: string) => {
  if (language === 'typescript') {
    return /\.(test|spec)\.(ts|tsx)$/.test(filePath);
  }
  if (language === 'go') {
    return filePath.endsWith('_test.go');
  }
  if (language === 'lua') {
    return filePath.endsWith('_spec.lua');
  }
  if (language === 'python') {
    const fileName = filePath.split('/').pop() ?? '';
    return fileName.startsWith('test_') || fileName.endsWith('_test.py');
  }
  return false;
};

export const resolveTestPath = (language: string, sourcePath: string) => {
  if (language === 'typescript') {
    const ext = sourcePath.endsWith('.tsx') ? '.tsx' : '.ts';
    return sourcePath.replace(new RegExp(`\\${ext}$`), `.test${ext}`);
  }
  if (language === 'go') {
    return sourcePath.replace(/\.go$/, '_test.go');
  }
  if (language === 'lua') {
    return sourcePath.replace(/^lua\//, 'tests/').replace(/\.lua$/, '_spec.lua');
  }
  if (language === 'python') {
    const parts = sourcePath.split('/');
    const fileName = parts.pop() ?? '';
    const dir = parts.join('/').replace(/^src/, 'tests');
    return `${dir}/test_${fileName}`;
  }
  if (language === 'rust') {
    return sourcePath;
  }
  return null;
};

const languageExtensions: Record<string, string[]> = {
  typescript: ['.ts', '.tsx'],
  go: ['.go'],
  lua: ['.lua'],
  python: ['.py'],
  rust: ['.rs'],
};

const fileMatchesLanguage = (filePath: string, language: string) => {
  const extensions = languageExtensions[language];
  return extensions?.some((ext) => filePath.endsWith(ext)) ?? false;
};

export const buildSourceTestMap = (ecosystems: DetectResult[], files: string[]) => {
  const map: Record<string, string | null> = {};

  for (const file of files) {
    const ecosystem = ecosystems.find(
      (e) => fileMatchesLanguage(file, e.language) && !isTestFile(e.language, file),
    );
    if (ecosystem != null) {
      map[file] = resolveTestPath(ecosystem.language, file);
    } else if (!ecosystems.some((e) => isTestFile(e.language, file))) {
      map[file] = null;
    }
  }

  return map;
};

const CONFIG_PATTERNS = [
  /^\.?\w*rc(\.\w+)?$/,
  /\.config\.\w+$/,
  /^tsconfig(\.\w+)?\.json$/,
  /^jest\.config\.\w+$/,
  /^vite\.config\.\w+$/,
  /^vitest\.config\.\w+$/,
  /^rollup\.config\.\w+$/,
  /^webpack\.config\.\w+$/,
  /^tailwind\.config\.\w+$/,
  /^postcss\.config\.\w+$/,
  /^\.eslintrc/,
  /^\.prettierrc/,
];

const isConfigFile = (filePath: string) => {
  const fileName = filePath.split('/').pop() ?? '';
  return CONFIG_PATTERNS.some((pattern) => pattern.test(fileName));
};

const isTypeOnlyContent = (content: string) => {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('//') && !line.startsWith('/*'));

  if (lines.length === 0) return false;

  const hasExportedType = lines.some(
    (line) =>
      line.startsWith('export type ') ||
      line.startsWith('export interface ') ||
      line.startsWith('import type '),
  );

  if (!hasExportedType) return false;

  const hasLogic = lines.some(
    (line) =>
      (line.startsWith('export const ') ||
        line.startsWith('export function ') ||
        line.startsWith('export default ') ||
        line.startsWith('export class ') ||
        line.startsWith('const ') ||
        line.startsWith('let ') ||
        line.startsWith('function ')) &&
      !line.startsWith('export type ') &&
      !line.startsWith('export interface '),
  );

  return !hasLogic;
};

const isBarrelExport = (content: string) => {
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('//'));

  if (lines.length === 0) return false;

  return lines.every(
    (line) =>
      line.startsWith('export {') ||
      line.startsWith('export *') ||
      line.startsWith('export type {') ||
      line.startsWith('}'),
  );
};

export const isTrivialFile = (filePath: string, content: string) => {
  if (isConfigFile(filePath)) return true;
  if (isTypeOnlyContent(content)) return true;
  if (isBarrelExport(content)) return true;
  return false;
};

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

const checkPackageManager = (p: DirectoryProbe): PackageManager | null => {
  if (p.fileExists('pnpm-lock.yaml')) return 'pnpm';
  if (p.fileExists('yarn.lock')) return 'yarn';
  if (p.fileExists('bun.lockb')) return 'bun';
  if (p.fileExists('package-lock.json')) return 'npm';
  return null;
};

export const detectPackageManager = (
  probe: DirectoryProbe,
  fallback?: DirectoryProbe,
): PackageManager | null => {
  return checkPackageManager(probe) ?? (fallback != null ? checkPackageManager(fallback) : null);
};

export class DetectService extends ServiceMap.Service<
  DetectService,
  {
    readonly detect: () => Effect.Effect<DetectResult[], Error>;
    readonly mapDirectory: (
      directory: string,
    ) => Effect.Effect<Record<string, string | null>, Error>;
    readonly packageManager: () => Effect.Effect<PackageManager | null>;
  }
>()('DetectService') {}

export const getDetectResult = Effect.gen(function* () {
  const service = yield* DetectService;

  return yield* service.detect();
});

export const getPackageManager = Effect.gen(function* () {
  const service = yield* DetectService;
  return yield* service.packageManager();
});
