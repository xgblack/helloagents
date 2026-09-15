/**
 * HelloAGENTS OMP extension.
 * The package root remains the single source for prompts and skills; OMP links
 * this directory through its native plugin manager.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SKILLS_DIR = join(ROOT, 'skills')
const KERNEL_PATH = join(ROOT, 'prompts', 'kernel.md')

function skillNames() {
  try {
    return readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('hello-'))
      .filter((entry) => {
        try { return readFileSync(join(SKILLS_DIR, entry.name, 'SKILL.md'), 'utf8').trim().length > 0 } catch { return false }
      })
      .map((entry) => entry.name)
  } catch {
    return []
  }
}

function routeInput(text, names) {
  const value = String(text || '')
  const match = value.match(/^(~|\/)(hello-[a-z0-9-]+|[a-z0-9-]+)(?:\s+([\s\S]*))?$/i)
  if (!match) return undefined
  const prefix = match[1]
  const requested = String(match[2] || '').toLowerCase()
  if (prefix === '/' && requested === 'plan') return undefined
  // OMP owns /plan and other native commands. Only HelloAGENTS skill names
  // are rewritten, with short aliases expanded to hello-*.
  const name = requested.startsWith('hello-') ? requested : `hello-${requested}`
  if (!names.includes(name)) return undefined
  const args = String(match[3] || '').trim()
  return `/skill:${name}${args ? ` ${args}` : ''}`
}

export default function helloagents(pi) {
  const names = skillNames()
  let kernel = ''
  try { kernel = readFileSync(KERNEL_PATH, 'utf8').trim() } catch { /* doctor reports a missing runtime copy */ }

  pi.on('before_agent_start', (event) => {
    if (!kernel) return undefined
    return { systemPrompt: [...event.systemPrompt, kernel] }
  })

  pi.on('input', (event) => {
    const transformed = routeInput(event.text, names)
    return transformed ? { text: transformed } : undefined
  })
}

export { routeInput, skillNames }
