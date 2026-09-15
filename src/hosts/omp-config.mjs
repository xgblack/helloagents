/** OMP executable, profile and native path resolution. */
import { existsSync, lstatSync, readdirSync, readlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileExists, readText, removePath } from '../kernel/fsx.mjs'

/** @typedef {{ cwd?: string, env?: Record<string, string | undefined>, timeout?: number }} ProbeOptions */
/** @typedef {{ executable?: string, home?: string, env?: Record<string, string | undefined>, cwd?: string, timeout?: number }} CommandOptions */

export const OMP_MIN_VERSION = '18.1.0'

/** @param {unknown} value */
function versionParts(value) {
  const match = String(value || '').match(/(\d+)\.(\d+)(?:\.(\d+))?/) 
  return match ? [Number(match[1] ?? 0), Number(match[2] ?? 0), Number(match[3] || 0)] : null
}

/** @param {string} a @param {string} b */
export function compareVersions(a, b) {
  const left = versionParts(a) || [0, 0, 0]
  const right = versionParts(b) || [0, 0, 0]
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return (left[i] ?? 0) - (right[i] ?? 0)
  }
  return 0
}

/** Resolve OMP from an explicit override first, then PATH. */
export function resolveOmpExecutable() {
  const explicit = String(process.env.OMP_EXECUTABLE || '').trim()
  if (explicit) return explicit
  const pathValue = process.env.PATH || ''
  for (const dir of pathValue.split(process.platform === 'win32' ? ';' : ':')) {
    if (!dir) continue
    for (const candidate of process.platform === 'win32' ? ['omp.exe', 'omp.cmd', 'omp'] : ['omp']) {
      const path = join(dir, candidate)
      if (existsSync(path)) return path
    }
  }
  return null
}

/** @param {string | null} [executable] @param {ProbeOptions} [options] */
export function detectOmpVersion(executable = resolveOmpExecutable(), options = {}) {
  if (!executable) return { executable: null, version: null, missing: true, ok: false }
  const result = spawnSync(executable, ['--version'], {
    cwd: options.cwd || process.cwd(),
    env: { ...process.env, ...(options.env || {}) },
    encoding: 'utf-8',
    timeout: options.timeout || 10000,
    windowsHide: true,
  })
  if (result.error || result.status !== 0) {
    return { executable, version: null, missing: false, ok: false, output: result.error?.message || `${result.stdout || ''}${result.stderr || ''}` }
  }
  const version = String(result.stdout || result.stderr || '').match(/\d+\.\d+(?:\.\d+)?/)?.[0] || null
  return { executable, version, missing: false, ok: Boolean(version), output: `${result.stdout || ''}${result.stderr || ''}`.trim() }
}

/** OMP uses HOME for its config root; tests pass a fake home explicitly. */
/** @param {string | undefined} home */
export function ompHome(home) {
  return home || String(process.env.HOME || homedir())
}

/** @param {string | undefined} home */
export function resolveOmpProfile(home) {
  const profile = String(process.env.OMP_PROFILE || process.env.PI_PROFILE || '').trim()
  const root = join(ompHome(home), '.omp')
  return profile ? join(root, 'profiles', profile) : root
}

/** @param {string | undefined} home */
export function resolveOmpAgentDir(home) {
  const override = String(process.env.PI_CODING_AGENT_DIR || '').trim()
  if (override) return isAbsolute(override) ? override : resolve(ompHome(home), override)
  return join(resolveOmpProfile(home), 'agent')
}

/** @param {string | undefined} home @param {'user' | 'project'} [scope] @param {string} [cwd] */
export function resolveOmpPluginRoot(home, scope = 'user', cwd = process.cwd()) {
  if (scope === 'project') return join(resolveProjectOmpDir(cwd), 'plugins')
  return join(resolveOmpProfile(home), 'plugins')
}

/** Find the nearest non-empty .omp directory, or create the cwd one. */
/** @param {string} [cwd] */
export function resolveProjectOmpDir(cwd = process.cwd()) {
  let current = resolve(cwd)
  while (true) {
    const candidate = join(current, '.omp')
    if (fileExists(candidate)) {
      try {
        if (readdirSync(candidate).length > 0) return candidate
      } catch { /* continue to the project boundary */ }
    }
    const parent = dirname(current)
    if (parent === current) break
    if (fileExists(join(current, '.git'))) break
    current = parent
  }
  return join(resolve(cwd), '.omp')
}

/** @param {string | undefined} home @param {'user' | 'project'} [scope] @param {string} [cwd] */
export function resolveOmpContextPath(home, scope = 'user', cwd = process.cwd()) {
  return scope === 'project' ? join(resolveProjectOmpDir(cwd), 'AGENTS.md') : join(resolveOmpAgentDir(home), 'AGENTS.md')
}

/** @param {string[]} args @param {CommandOptions} [options] */
export function runOmpCommand(args, options = {}) {
  const executable = options.executable || resolveOmpExecutable()
  if (!executable) return { ok: false, missing: true, output: '', status: null }
  const env = { ...process.env, HOME: ompHome(options.home), ...(options.env || {}) }
  const result = spawnSync(executable, args, {
    cwd: options.cwd || process.cwd(), env, encoding: 'utf-8', timeout: options.timeout || 60000, windowsHide: true,
  })
  return {
    ok: !result.error && result.status === 0,
    missing: Boolean(result.error && /** @type {{ code?: string }} */ (result.error).code === 'ENOENT'),
    output: `${result.stdout || ''}\n${result.stderr || ''}`.trim(),
    status: result.status,
  }
}

/** @param {string} home @param {string} appDir @param {'user' | 'project'} [scope] @param {string} [cwd] */
export function linkOmpPlugin(home, appDir, scope = 'user', cwd = process.cwd()) {
  const args = ['plugin', 'link', `--scope=${scope}`, appDir]
  return runOmpCommand(args, { home, cwd })
}

/** @param {string} home @param {'user' | 'project'} [scope] @param {string} [cwd] */
export function listOmpPlugins(home, scope = 'user', cwd = process.cwd()) {
  const result = runOmpCommand(['plugin', 'list', '--json', `--scope=${scope}`], { home, cwd })
  if (!result.ok) return { ...result, plugins: null }
  try { return { ...result, plugins: JSON.parse(result.output) } } catch { return { ...result, plugins: null } }
}

/** @param {string} home @param {'user' | 'project'} [scope] @param {string} [cwd] */
export function ompPluginInstalled(home, scope = 'user', cwd = process.cwd()) {
  const listed = listOmpPlugins(home, scope, cwd)
  if (!listed.ok || !listed.plugins) return { ...listed, installed: false }
  const text = JSON.stringify(listed.plugins)
  return { ...listed, installed: /["']?helloagents["']?/.test(text) }
}

/** @param {string} home @param {string} [cwd] */
export function ompDiagnostic(home, cwd = process.cwd()) {
  const detected = detectOmpVersion(resolveOmpExecutable(), { env: { HOME: ompHome(home) }, cwd })
  return {
    ...detected,
    supported: Boolean(detected.version && compareVersions(detected.version, OMP_MIN_VERSION) >= 0),
    profile: resolveOmpProfile(home),
    agentDir: resolveOmpAgentDir(home),
    contextPath: resolveOmpContextPath(home, 'user', cwd),
    pluginRoot: resolveOmpPluginRoot(home, 'user', cwd),
  }
}

/** @param {string} home @param {string} appDir @param {'user' | 'project'} [scope] @param {string} [cwd] */
export function installOmpPlugin(home, appDir, scope = 'user', cwd = process.cwd()) {
  const detected = ompDiagnostic(home, cwd)
  if (!detected.executable) return { ok: false, reason: 'omp executable not found', code: 'omp-executable-missing' }
  if (!detected.supported) return { ok: false, reason: `OMP ${detected.version || 'unknown'} is older than ${OMP_MIN_VERSION}`, code: 'omp-version-unsupported', executable: detected.executable, version: detected.version }
  const linked = linkOmpPlugin(home, appDir, scope, cwd)
  if (!linked.ok) return { ok: false, reason: linked.output || 'omp plugin link failed', code: 'omp-plugin-link-failed', executable: detected.executable, version: detected.version }
  const found = ompPluginInstalled(home, scope, cwd)
  if (!found.ok || !found.installed) return { ok: false, reason: found.output || 'OMP did not discover helloagents plugin', code: 'omp-plugin-missing', executable: detected.executable, version: detected.version }
  return { ok: true, executable: detected.executable, version: detected.version, pluginRoot: resolveOmpPluginRoot(home, scope, cwd) }
}

/** @param {string} home @param {'user' | 'project'} [scope] @param {string} [cwd] */
export function uninstallOmpPlugin(home, scope = 'user', cwd = process.cwd()) {
  const root = resolveOmpPluginRoot(home, scope, cwd)
  const target = join(root, 'node_modules', 'helloagents')
  // `plugin link` has no project-scope support in OMP's CLI. Never run
  // `plugin uninstall --scope=project`: OMP ignores that flag for npm/link
  // packages and would remove a user-scoped plugin instead. Clean up only a
  // legacy project symlink that points at our managed runtime copy.
  if (scope === 'project') {
    try {
      if (lstatSync(target).isSymbolicLink()) {
        const linked = resolve(dirname(target), readlinkSync(target))
        const managed = resolve(home, '.helloagents', 'app')
        if (linked === managed) removePath(target)
      }
    } catch { /* stale or absent legacy link */ }
    return { ok: true }
  }
  const result = runOmpCommand(['plugin', 'uninstall', 'helloagents', `--scope=${scope}`], { home, cwd })
  // Link-only plugins may not be present in package.json; remove only our
  // exact link after asking OMP to clean its lockfile.
  if (fileExists(target)) removePath(target)
  return { ok: result.ok || !result.missing, manualSteps: result.ok ? undefined : `omp plugin uninstall helloagents --scope=${scope}` }
}
