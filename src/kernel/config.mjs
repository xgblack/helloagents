/**
 * 用户配置与安装状态。
 * config.json：用户可手工编辑的少量偏好。
 * install.json：由 CLI 维护的安装事实，是 doctor 的比对基准。
 */
import { readJson, writeJsonAtomic } from './fsx.mjs'
import { installStatePath, userConfigPath } from './paths.mjs'

export const STATE_VERSION = 5

/** @typedef {{type: 'npm'} | {type: 'git', url: string, branch: string, path: string}} InstallSource */

/**
 * @typedef {Object} UserConfig
 * @property {'cn' | 'en' | null} language 界面语言；null 表示跟随系统。
 * @property {{ sound: boolean, desktop: boolean }} notify 通知开关。
 */

/**
 * @typedef {Object} HostInstall
 * @property {'standard' | 'global'} mode 兼容字段；OMP 之外仍表示安装方式
 * @property {'native-plugin' | 'context-file'} [integration]
 * @property {'user' | 'project'} [scope]
 * @property {boolean} [omp]
 * @property {string} version
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} InstallState
 * @property {number} version
 * @property {Record<string, HostInstall>} hosts
 * @property {{ guard: string[], notify: string[] }} addons
 * @property {InstallSource} [source]
 */

/**
 * @param {string} home
 * @returns {UserConfig}
 */
export function readUserConfig(home) {
  const raw = /** @type {Partial<UserConfig> & { notify?: Partial<UserConfig['notify']> } | null} */ (
    readJson(userConfigPath(home))
  )
  return {
    language: raw?.language === 'cn' || raw?.language === 'en' ? raw.language : null,
    notify: {
      sound: raw?.notify?.sound !== false,
      desktop: raw?.notify?.desktop === true,
    },
  }
}

/**
 * @param {string} home
 * @returns {InstallState}
 */
export function readInstallState(home) {
  const raw = /** @type {Partial<InstallState> | null} */ (readJson(installStatePath(home)))
  const rawHosts = raw && typeof raw.hosts === 'object' && raw.hosts ? raw.hosts : {}
  /** @type {Record<string, HostInstall>} */
  const hosts = {}
  for (const [id, value] of Object.entries(rawHosts)) {
    if (!value || typeof value !== 'object') continue
    const entry = /** @type {Partial<HostInstall>} */ (value)
    const mode = entry.mode === 'standard' ? 'standard' : 'global'
    const integration = entry.integration === 'context-file' || entry.integration === 'native-plugin'
      ? entry.integration
      : (mode === 'standard' ? 'context-file' : 'native-plugin')
    const scope = entry.scope === 'project' ? 'project' : 'user'
    hosts[id] = {
      mode,
      integration,
      scope,
      ...(entry.omp === true ? { omp: true } : {}),
      version: typeof entry.version === 'string' ? entry.version : '',
      updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : '',
    }
  }
  const addons = raw && typeof raw.addons === 'object' && raw.addons ? raw.addons : {}
  const source = raw?.source
  if (source !== undefined && (!source || typeof source !== 'object' ||
    (source.type !== 'npm' && source.type !== 'git') ||
    (source.type === 'git' && [source.url, source.branch, source.path].some((value) => typeof value !== 'string' || !value.trim())))) {
    throw new Error('Invalid installation source in install.json')
  }
  return {
    version: STATE_VERSION,
    hosts,
    ...(source ? { source } : {}),
    addons: {
      guard: Array.isArray(/** @type {{guard?: unknown}} */ (addons).guard)
        ? /** @type {string[]} */ (/** @type {{guard?: unknown}} */ (addons).guard)
        : [],
      notify: Array.isArray(/** @type {{notify?: unknown}} */ (addons).notify)
        ? /** @type {string[]} */ (/** @type {{notify?: unknown}} */ (addons).notify)
        : [],
    },
  }
}

/**
 * @param {string} home
 * @param {InstallState} state
 */
export function writeInstallState(home, state) {
  writeJsonAtomic(installStatePath(home), state)
}
