/**
 * Host half of the subagent model switcher.
 *
 * Stores one optional `{provider, model, reasoningEffort}` per subagent tool in
 * `$DSH_HOME/subagent-models.json`, serves it to the page through a loopback
 * route, and installs the stored selection on every child agent created by a
 * matching delegation provider. The child is identified from the persisted
 * `subagent/descriptor` event, which the runtime appends before the agent is
 * announced, so the selection is in place before the child's first turn.
 *
 * Only APIs shipped by the running Harness are imported: the browser settings
 * plane does not expose plugin namespaces, and older profile-side package
 * copies are not the ones this process loads.
 *
 * @module @local/subagent-model-switcher
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { foldSubagentDescriptor } from '@deepseek-ai/dsh-subagent'
import { installModelSelection } from '@deepseek-ai/dsh-agent'

/** Service required before the policy route can be registered. */
export const inject = ['webServer', 'agents']

const ROUTE = '/subagent-model-switcher'
const MAX_BODY_BYTES = 64 * 1024

/** Delegation providers shipped with the Harness and their model-facing tools. */
const TARGETS = [
  { id: 'subagent_worker', provider: 'spawn-worker', label: 'Gentle AI Worker', tool: 'subagent_worker' },
  { id: 'subagent_verify', provider: 'spawn-verify', label: 'Gentle AI Verify', tool: 'subagent_verify' },
  { id: 'subagent_explore', provider: 'spawn-explore', label: 'Gentle AI Explore', tool: 'subagent_explore' },
  { id: 'subagent', provider: 'spawn', label: 'Subagent', tool: 'subagent' },
  { id: 'subagent_fork', provider: 'fork', label: 'Subagent fork', tool: 'subagent_fork' },
]

/** True only when the request reached a loopback listener with a loopback Host. */
function isLoopback(req) {
  const remote = req.socket?.remoteAddress ?? ''
  if (remote !== '127.0.0.1' && remote !== '::1' && remote !== '::ffff:127.0.0.1') return false
  const host = String(req.headers.host ?? '')
  const name = host.startsWith('[') ? host.slice(1, host.indexOf(']')) : host.split(':')[0]
  return name === '127.0.0.1' || name === 'localhost' || name === '::1'
}

/** Write one JSON response. */
function json(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  })
  res.end(payload)
}

/** Read a bounded JSON request body. */
async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new Error('request body too large')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/** Normalize one stored value into a detached `ModelSelection`, or undefined. */
function toSelection(value) {
  if (value === null || typeof value !== 'object') return undefined
  if (typeof value.provider !== 'string' || value.provider === '') return undefined
  if (typeof value.model !== 'string' || value.model === '') return undefined
  const effort = value.reasoningEffort
  return {
    provider: value.provider,
    model: value.model,
    ...typeof effort === 'string' && effort !== '' ? { reasoningEffort: effort } : {},
  }
}

export function apply(ctx) {
  // A broken local plugin must never be able to fail the whole profile boot:
  // report through the loader log and leave the session untouched instead.
  try {
    install(ctx)
  } catch (error) {
    ctx.logger?.error?.(error)
  }
}

function install(ctx) {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  const file = join(home, 'subagent-models.json')

  const read = () => {
    try {
      const parsed = JSON.parse(readFileSync(file, 'utf8'))
      const raw = parsed?.selections
      if (raw === null || typeof raw !== 'object') return {}
      const result = {}
      for (const target of TARGETS) {
        const selection = toSelection(raw[target.id])
        if (selection !== undefined) result[target.id] = selection
      }
      return result
    } catch {
      return {}
    }
  }

  let selections = read()

  const traceFile = join(home, 'subagent-models.log')
  const trace = (line) => {
    try {
      appendFileSync(traceFile, `${new Date().toISOString()} ${line}\n`, 'utf8')
    } catch {
      // diagnostics must never break agent creation
    }
  }

  const write = (next) => {
    mkdirSync(dirname(file), { recursive: true })
    const temp = `${file}.${process.pid}.tmp`
    writeFileSync(temp, `${JSON.stringify({ selections: next }, null, 2)}\n`, 'utf8')
    renameSync(temp, file)
    selections = next
  }

  trace(`apply: targets=${TARGETS.map((t) => t.id).join(',')} selections=${JSON.stringify(selections)}`)

  const handled = new WeakSet()

  const installFor = (agent) => {
    if (handled.has(agent)) return
    handled.add(agent)
    let descriptor
    try {
      const events = typeof agent.session?.snapshotEvents === 'function'
        ? agent.session.snapshotEvents()
        : agent.session?.events ?? []
      descriptor = foldSubagentDescriptor(events)
    } catch (error) {
      trace(`fold failed for ${agent.id}: ${error instanceof Error ? error.message : String(error)}`)
      return
    }
    trace(`created ${agent.id}: descriptor=${descriptor === undefined ? 'none' : descriptor.provider}`)
    if (descriptor === undefined) return
    const target = TARGETS.find((candidate) => candidate.provider === descriptor.provider)
    if (target === undefined) return
    const selection = toSelection(selections[target.id])
    if (selection === undefined) {
      trace(`created ${agent.id}: no selection for ${target.id}`)
      return
    }
    agent.ctx.effect(
      () => installModelSelection(agent.ctx, { current: selection, assembled: undefined }),
      `subagent-model-switcher: ${target.id} selection`,
    )
    trace(`installed ${agent.id}: ${target.id} -> ${selection.provider}/${selection.model}${selection.reasoningEffort ? ` (${selection.reasoningEffort})` : ''}`)
    ctx.logger?.info?.(
      `subagent-model-switcher: ${target.id} -> ${selection.provider}/${selection.model}${selection.reasoningEffort ? ` (${selection.reasoningEffort})` : ''}`,
    )
  }

  // A host-context listener does not observe agents composed inside an agent
  // preset: the preset owns a detached scope tree. Wrapping the registry method
  // every entry point goes through is scope-independent. `create()` resolves
  // after setup (the subagent descriptor is appended there) and the caller
  // starts the first turn afterwards, so the selection still precedes prompt
  // assembly.
  const registry = ctx.agents
  const prototype = Object.getPrototypeOf(registry)
  const prototypeCreate = prototype?.create
  const instanceCreate = registry.create
  trace(`wrapper target: prototype=${typeof prototypeCreate === 'function'} instance=${typeof instanceCreate === 'function'}`)
  const patchedCreate = async function patchedCreate(...args) {
    const handle = await (typeof prototypeCreate === 'function' ? prototypeCreate : instanceCreate).apply(this, args)
    try {
      installFor(handle.agent)
    } catch (error) {
      ctx.logger?.warn?.(error)
    }
    return handle
  }
  ctx.effect(() => {
    if (typeof prototypeCreate === 'function') {
      prototype.create = patchedCreate
      return () => {
        if (prototype.create === patchedCreate) prototype.create = prototypeCreate
      }
    }
    registry.create = patchedCreate
    return () => {
      if (registry.create === patchedCreate) registry.create = instanceCreate
    }
  }, 'subagent-model-switcher: child selection hook')

  ctx.on('agent/created', ({ agent }) => {
    trace(`event: created ${agent.id}`)
    try {
      installFor(agent)
    } catch (error) {
      ctx.logger?.warn?.(error)
    }
  })

  const route = (req, res) => {
    if (!isLoopback(req)) {
      json(res, 403, { error: 'loopback only' })
      return
    }
    if (req.method === 'GET') {
      selections = read()
      json(res, 200, {
        targets: TARGETS.map((target) => ({ ...target })),
        selections,
      })
      return
    }
    if (req.method !== 'POST') {
      json(res, 405, { error: 'GET or POST' })
      return
    }
    void (async () => {
      try {
        const body = await readJson(req)
        const incoming = body?.selections
        if (incoming === null || typeof incoming !== 'object') throw new Error('expected { selections }')
        const next = { ...selections }
        for (const target of TARGETS) {
          if (!(target.id in incoming)) continue
          const value = incoming[target.id]
          if (value === null || value === undefined) {
            delete next[target.id]
            continue
          }
          const selection = toSelection(value)
          if (selection === undefined) throw new Error(`invalid selection for "${target.id}"`)
          next[target.id] = selection
        }
        write(next)
        json(res, 200, { targets: TARGETS.length, selections })
      } catch (error) {
        json(res, 400, { error: error instanceof Error ? error.message : String(error) })
      }
    })()
  }

  ctx.effect(
    () => ctx.webServer.register({ kind: 'exact', path: ROUTE, handler: route }),
    'subagent-model-switcher: route',
  )
  ctx.logger?.info?.(
    `subagent-model-switcher: ${TARGETS.map((target) => `${target.id}(${target.provider})`).join(', ')} on ${ROUTE}; store ${existsSync(file) ? file : `${file} (new)`}`,
  )
}
