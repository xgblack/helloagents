/**
 * 测试辅助：临时主目录与命令行上下文。
 * 通过 HELLOAGENTS_HOME 环境变量实现隔离，测试之间互不影响。
 */
import { chmodSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJson, writeTextAtomic } from '../../src/kernel/fsx.mjs'
import { createTranslator } from '../../src/kernel/i18n.mjs'
import { appDir } from '../../src/kernel/paths.mjs'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const pkg = /** @type {{ version: string }} */ (readJson(join(REPO_ROOT, 'package.json')))
export const PACKAGE_VERSION = pkg.version

/** 创建临时主目录，并把 HELLOAGENTS_HOME 指向它。 */
export function makeFakeHome() {
  const home = mkdtempSync(join(tmpdir(), 'helloagents-test-'))
  const previous = process.env.HELLOAGENTS_HOME
  process.env.HELLOAGENTS_HOME = home
  return {
    home,
    cleanup() {
      if (previous === undefined) delete process.env.HELLOAGENTS_HOME
      else process.env.HELLOAGENTS_HOME = previous
      rmSync(home, { recursive: true, force: true })
    },
  }
}

/**
 * 构造命令行上下文；log 输出收集到数组便于断言。
 * @param {string} home
 */
export function makeCtx(home) {
  /** @type {string[]} */
  const lines = []
  return {
    ctx: {
      home,
      app: appDir(home),
      packageRoot: REPO_ROOT,
      version: PACKAGE_VERSION,
      t: createTranslator('cn'),
      log: (/** @type {string} */ line) => {
        lines.push(line)
      },
    },
    lines,
  }
}

/**
 * Create a deterministic OMP command stub for integration tests. It models the
 * native plugin manager contract used by helloagents without requiring OMP to
 * be installed on the test runner.
 */
export function makeFakeOmp() {
  const root = mkdtempSync(join(tmpdir(), 'helloagents-omp-'))
  const executable = join(root, 'omp.mjs')
  const source = `#!/usr/bin/env node
import { existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
if (args[0] === '--version') {
  console.log('omp/18.1.20')
  process.exit(0)
}
if (args[0] !== 'plugin') process.exit(2)
const action = args[1]
const scope = args.find((value) => value.startsWith('--scope='))?.slice('--scope='.length) || 'user'
const home = process.env.HOME
const rootDir = scope === 'project' ? join(process.cwd(), '.omp', 'plugins') : join(home, '.omp', 'plugins')
const target = join(rootDir, 'node_modules', 'helloagents')
if (action === 'link') {
  const appDir = resolve(args.at(-1))
  mkdirSync(join(rootDir, 'node_modules'), { recursive: true })
  if (existsSync(target)) rmSync(target, { recursive: true, force: true })
  symlinkSync(appDir, target, 'dir')
  process.exit(0)
}
if (action === 'list') {
  console.log(JSON.stringify(existsSync(target) ? [{ name: 'helloagents', path: target }] : []))
  process.exit(0)
}
if (action === 'uninstall') {
  rmSync(target, { recursive: true, force: true })
  process.exit(0)
}
process.exit(2)
`
  writeTextAtomic(executable, source)
  chmodSync(executable, 0o755)
  return {
    executable,
    cleanup() {
      rmSync(root, { recursive: true, force: true })
    },
  }
}
