/**
 * Browser half of the subagent model switcher.
 *
 * Registers one component in the shell overlay slot. The component owns the
 * Alt+K shortcut, reads the model catalogue through the runtime's Remote
 * namespaces (`remote.session.modelCatalog`, the same source the composer
 * picker uses), and reads/writes the per-target policy through this plugin's
 * own loopback route. It renders no prompt content.
 */
window.__ModuleLoader__.load({
  id: 'dsh-subagent-model-switcher',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const ROUTE = '/subagent-model-switcher'

    const CSS = `
.sams-mask{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;
  background:var(--dsw-alias-bg-mask-3,rgba(0,0,0,.55));pointer-events:auto;padding:24px}
.sams-card{width:min(680px,100%);max-height:min(84vh,760px);display:flex;flex-direction:column;
  background:var(--dsw-alias-bg-layer-2,#1c1c1f);color:var(--dsw-alias-label-primary,#ececf1);
  border:1px solid var(--dsw-alias-border-l3,rgba(255,255,255,.14));border-radius:16px;
  box-shadow:0 24px 70px rgba(0,0,0,.55);overflow:hidden;font-size:13px;line-height:1.5}
.sams-head{display:flex;align-items:flex-start;gap:16px;padding:20px 22px 14px}
.sams-head h2{margin:0;font-size:16px;font-weight:600;letter-spacing:-.01em}
.sams-head p{margin:6px 0 0;color:var(--dsw-alias-label-secondary,#b7b7c0);font-size:12.5px;line-height:1.55;max-width:56ch}
.sams-x{margin-left:auto;flex:none;background:transparent;border:0;color:var(--dsw-alias-label-tertiary,#8e8e99);
  font-size:20px;line-height:1;cursor:pointer;padding:4px 8px;border-radius:8px}
.sams-x:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#ececf1)}
.sams-body{padding:2px 22px 18px;overflow:auto;display:flex;flex-direction:column;gap:12px}
.sams-row{border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));border-radius:12px;padding:14px 16px;
  background:var(--dsw-alias-bg-layer-1,rgba(255,255,255,.025))}
.sams-rowhead{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.sams-name{font-weight:600;font-size:13.5px}
.sams-tool{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;padding:2px 7px;border-radius:6px;
  background:var(--dsw-alias-markdown-code-block,rgba(255,255,255,.07));color:var(--dsw-alias-label-secondary,#b7b7c0)}
.sams-toggle{margin-left:auto;display:flex;align-items:center;gap:7px;color:var(--dsw-alias-label-secondary,#b7b7c0);
  font-size:12px;cursor:pointer;user-select:none}
.sams-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.sams-field{display:flex;flex-direction:column;gap:5px;min-width:0}
.sams-field span{color:var(--dsw-alias-label-tertiary,#8e8e99);font-size:11px;letter-spacing:.01em}
.sams-field select{width:100%;background:var(--dsw-alias-bg-layer-3,#26262b);
  color:var(--dsw-alias-label-primary,#ececf1);border:1px solid var(--dsw-alias-border-l3,rgba(255,255,255,.16));
  border-radius:9px;padding:8px 10px;font-size:12.5px;outline:none}
.sams-field select:focus{border-color:var(--dsw-alias-brand-primary,#4c8dff)}
.sams-field select:disabled{opacity:.45;cursor:not-allowed}
.sams-note{color:var(--dsw-alias-label-tertiary,#8e8e99);font-size:12px;margin-top:10px}
.sams-error{margin:0 22px 12px;padding:9px 12px;border-radius:9px;font-size:12px;line-height:1.5;
  background:rgba(220,60,60,.14);border:1px solid rgba(220,60,60,.45);color:#ffb4b4}
.sams-warn{margin:0 22px 12px;padding:9px 12px;border-radius:9px;font-size:12px;
  background:rgba(230,160,40,.12);border:1px solid rgba(230,160,40,.35);color:#f0c987}
.sams-foot{display:flex;align-items:center;gap:10px;padding:14px 22px;
  border-top:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.1));background:var(--dsw-alias-bg-layer-1,rgba(255,255,255,.02))}
.sams-foot small{color:var(--dsw-alias-label-tertiary,#8e8e99);font-size:11px;line-height:1.45;margin-right:auto;max-width:42ch}
.sams-btn{appearance:none;border-radius:9px;padding:8px 16px;font-size:12.5px;cursor:pointer;
  border:1px solid var(--dsw-alias-border-l3,rgba(255,255,255,.16));background:transparent;color:var(--dsw-alias-label-primary,#ececf1)}
.sams-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}
.sams-btn[data-primary]{background:var(--dsw-alias-button-primary-fill,#3f6cd6);border-color:transparent;color:#fff}
.sams-btn[data-primary]:hover{filter:brightness(1.08)}
.sams-btn[data-primary]:disabled{opacity:.5;cursor:default;filter:none}
.sams-meta{display:flex;align-items:center;gap:8px;margin:0 22px 8px;color:var(--dsw-alias-label-tertiary,#8e8e99);font-size:11.5px}
.sams-link{background:none;border:0;padding:0;color:var(--dsw-alias-brand-primary,#4c8dff);font-size:11.5px;cursor:pointer}
.sams-link:disabled{opacity:.5;cursor:default}
.sams-warn-inline{margin-top:8px;font-size:11.5px;color:#f0c987}
.sams-empty{padding:26px 18px;text-align:center;color:var(--dsw-alias-label-tertiary,#8e8e99);font-size:12.5px}
.sams-kbd{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10.5px;padding:1px 5px;border-radius:4px;
  border:1px solid var(--dsw-alias-border-l2,rgba(255,255,255,.14));color:var(--dsw-alias-label-tertiary,#8e8e99)}
`

    /** One JSON round trip against this plugin's own route. */
    async function request(url, options) {
      const response = await fetch(url, { cache: 'no-store', ...options })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error ?? `request failed (${response.status})`)
      return body
    }

    /** Build the draft row for one target from its stored override. */
    function rowOf(selection) {
      const stored = selection !== undefined && selection !== null && typeof selection === 'object' ? selection : undefined
      return {
        on: stored !== undefined,
        provider: typeof stored?.provider === 'string' ? stored.provider : '',
        model: typeof stored?.model === 'string' ? stored.model : '',
        effort: typeof stored?.reasoningEffort === 'string' ? stored.reasoningEffort : '',
      }
    }

    /** Find one exact model entry across the catalogue groups. */
    function modelEntry(groups, provider, model) {
      const group = groups.find((candidate) => candidate.id === provider)
      return group?.models?.find((candidate) => candidate.id === model)
    }

    const CATALOG_CACHE_KEY = 'dsh.subagent-model-switcher.catalog'

    /** Last good catalogue, used only when the live read fails. */
    function readCatalogCache() {
      try {
        const parsed = JSON.parse(localStorage.getItem(CATALOG_CACHE_KEY) ?? 'null')
        if (!Array.isArray(parsed?.groups) || typeof parsed?.fetchedAt !== 'number') return undefined
        return parsed
      } catch {
        return undefined
      }
    }

    let injectedCtx = null

    function View() {
      const ctx = injectedCtx
      const [open, setOpen] = React.useState(false)
      const [loading, setLoading] = React.useState(false)
      const [error, setError] = React.useState(null)
      const [catalogError, setCatalogError] = React.useState(null)
      const [saving, setSaving] = React.useState(false)
      const [targets, setTargets] = React.useState([])
      const [groups, setGroups] = React.useState([])
      const [catalogAt, setCatalogAt] = React.useState(null)
      const [catalogStale, setCatalogStale] = React.useState(false)
      const [draft, setDraft] = React.useState({})

      React.useEffect(() => {
        function onKey(event) {
          if (!event.altKey || event.ctrlKey || event.metaKey) return
          if (event.key !== 'k' && event.key !== 'K') return
          event.preventDefault()
          setOpen((value) => !value)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [])

      const load = React.useCallback(async (refresh = false) => {
        setLoading(true)
        setError(null)
        setCatalogError(null)
        const policy = await request(ROUTE, { method: 'GET' }).catch((cause) => {
          setError(cause instanceof Error ? cause.message : String(cause))
          return null
        })
        if (policy !== null) {
          const nextTargets = Array.isArray(policy.targets) ? policy.targets : []
          setTargets(nextTargets)
          setDraft(Object.fromEntries(nextTargets.map((target) => [target.id, rowOf(policy.selections?.[target.id])])))
        }
        try {
          const catalog = await ctx.remote.session.modelCatalog()
          if (!catalog.ok) throw new Error(`${catalog.error.code}: ${catalog.error.message}`)
          const groups = Array.isArray(catalog.value?.groups) ? catalog.value.groups : []
          setGroups(groups)
          try {
            localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ groups, fetchedAt: Date.now() }))
          } catch {
            // a storage failure must not break the modal
          }
          setCatalogAt(Date.now())
          setCatalogStale(false)
          const failed = Array.isArray(catalog.value?.failures) ? catalog.value.failures : []
          if (failed.length > 0) {
            setCatalogError('Some providers did not answer: ' + failed.map((failure) => failure.id).join(', '))
          }
        } catch (cause) {
          const cached = readCatalogCache()
          if (cached !== undefined) {
            setGroups(cached.groups)
            setCatalogAt(cached.fetchedAt)
            setCatalogStale(true)
            setCatalogError('Using the cached catalogue: ' + (cause instanceof Error ? cause.message : String(cause)))
          } else {
            setCatalogError(cause instanceof Error ? cause.message : String(cause))
          }
        }
        setLoading(false)
      }, [ctx])

      React.useEffect(() => {
        if (open) void load()
      }, [open, load])

      React.useEffect(() => {
        if (!open) return
        function onKey(event) {
          if (event.key === 'Escape') setOpen(false)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [open])

      const patchRow = (id, patch) => {
        setDraft((previous) => ({ ...previous, [id]: { ...previous[id], ...patch } }))
      }

      const save = async () => {
        setSaving(true)
        setError(null)
        try {
          const unavailable = targets.filter((target) => {
            const row = draft[target.id]
            return row !== undefined && row.on && row.provider !== '' && row.model !== '' &&
              modelEntry(groups, row.provider, row.model) === undefined
          })
          if (unavailable.length > 0) {
            throw new Error(
              'These models are no longer advertised: ' + unavailable.map((target) => target.id).join(', ') +
              '. Clear or change them before saving.',
            )
          }
          const payload = {}
          for (const target of targets) {
            const row = draft[target.id]
            if (row === undefined || !row.on || row.provider === '' || row.model === '') {
              payload[target.id] = null
              continue
            }
            const value = { provider: row.provider, model: row.model }
            if (row.effort !== '') value.reasoningEffort = row.effort
            payload[target.id] = value
          }
          await request(ROUTE, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ selections: payload }),
          })
          setOpen(false)
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        } finally {
          setSaving(false)
        }
      }

      const rows = targets.map((target) => {
        const row = draft[target.id] ?? { on: false, provider: '', model: '', effort: '' }
        const entry = modelEntry(groups, row.provider, row.model)
        const efforts = entry?.reasoning?.efforts ?? []
        const modelValue = row.provider !== '' && row.model !== '' ? `${row.provider}\u0000${row.model}` : ''
        const unknownModel = row.on && modelValue !== '' && entry === undefined
        return h(
          'div',
          { className: 'sams-row', key: target.id },
          h(
            'div',
            { className: 'sams-rowhead' },
            h('span', { className: 'sams-name' }, target.label ?? target.id),
            h('code', { className: 'sams-tool' }, target.id),
            h(
              'label',
              { className: 'sams-toggle' },
              h('input', {
                type: 'checkbox',
                checked: row.on,
                onChange: (event) => {
                  const on = event.target.checked
                  if (!on) {
                    patchRow(target.id, { on, provider: '', model: '', effort: '' })
                    return
                  }
                  const first = groups[0]
                  const firstModel = first?.models?.[0]
                  patchRow(target.id, {
                    on,
                    provider: first?.id ?? '',
                    model: firstModel?.id ?? '',
                    effort: '',
                  })
                },
              }),
              'Override',
            ),
          ),
          h(
            'div',
            { className: 'sams-grid' },
            h(
              'label',
              { className: 'sams-field' },
              h('span', null, 'Model'),
              h(
                'select',
                {
                  disabled: !row.on,
                  value: modelValue,
                  onChange: (event) => {
                    const [provider, model] = event.target.value.split('\u0000')
                    patchRow(target.id, { provider: provider ?? '', model: model ?? '', effort: '' })
                  },
                },
                row.on && modelValue === '' ? h('option', { value: '' }, 'Select model') : null,
                unknownModel ? h('option', { value: modelValue }, `${row.model} (not advertised)`) : null,
                groups.map((group) =>
                  h(
                    'optgroup',
                    { label: group.name ?? group.id, key: group.id },
                    (group.models ?? []).map((model) =>
                      h(
                        'option',
                        { value: `${group.id}\u0000${model.id}`, key: `${group.id}\u0000${model.id}` },
                        model.name ?? model.id,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            h(
              'label',
              { className: 'sams-field' },
              h('span', null, 'Reasoning effort'),
              h(
                'select',
                {
                  disabled: !row.on || modelValue === '' || efforts.length === 0,
                  value: row.effort,
                  onChange: (event) => patchRow(target.id, { effort: event.target.value }),
                },
                h('option', { value: '' }, efforts.length === 0 ? 'Default' : 'Adapter default'),
                efforts.map((effort) => h('option', { value: effort.id, key: effort.id }, effort.name ?? effort.id)),
              ),
            ),
          ),
          row.on ? null : h('div', { className: 'sams-note' }, "Inherits the parent session's model."),
          unknownModel
            ? h(
                'div',
                { className: 'sams-warn-inline' },
                'This model is no longer advertised. Pick another one or clear the override.',
              )
            : null,
        )
      })

      return h(
        React.Fragment,
        null,
        h('style', { key: 'style' }, CSS),
        open
          ? h(
              'div',
              {
                className: 'sams-mask',
                onMouseDown: (event) => {
                  if (event.target === event.currentTarget) setOpen(false)
                },
              },
              h(
                'div',
                { className: 'sams-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Subagent models' },
                h(
                  'div',
                  { className: 'sams-head' },
                  h(
                    'div',
                    null,
                    h('h2', null, 'Subagent models'),
                    h(
                      'p',
                      null,
                      'Choose the model and reasoning effort each subagent tool uses when it starts a child. Unset rows inherit the parent session.',
                    ),
                  ),
                  h('button', { className: 'sams-x', 'aria-label': 'Close', onClick: () => setOpen(false) }, '\u00d7'),
                ),
                catalogAt !== null
                  ? h(
                      'div',
                      { className: 'sams-meta' },
                      h(
                        'span',
                        null,
                        catalogStale ? 'Cached catalogue from ' : 'Catalogue updated ',
                        new Date(catalogAt).toLocaleTimeString(),
                      ),
                      h(
                        'button',
                        { className: 'sams-link', onClick: () => void load(true), disabled: loading },
                        'Refresh',
                      ),
                    )
                  : null,
                error ? h('div', { className: 'sams-error' }, error) : null,
                catalogError
                  ? h('div', { className: 'sams-warn' }, `Model catalogue unavailable: ${catalogError}`)
                  : null,
                h(
                  'div',
                  { className: 'sams-body' },
                  loading ? h('div', { className: 'sams-empty' }, 'Loading catalogue…') : null,
                  !loading && rows.length === 0
                    ? h(
                        'div',
                        { className: 'sams-empty' },
                        error ? 'The host did not answer the policy request.' : 'No configurable subagent tools.',
                      )
                    : null,
                  rows,
                ),
                h(
                  'div',
                  { className: 'sams-foot' },
                  h(
                    'small',
                    null,
                    'Applies to children started after saving. External providers are not configurable here. ',
                    h('span', { className: 'sams-kbd' }, 'Alt'),
                    ' + ',
                    h('span', { className: 'sams-kbd' }, 'K'),
                  ),
                  h('button', { className: 'sams-btn', onClick: () => setOpen(false) }, 'Cancel'),
                  h(
                    'button',
                    { className: 'sams-btn', 'data-primary': true, disabled: saving || loading, onClick: save },
                    saving ? 'Saving…' : 'Save',
                  ),
                ),
              ),
            )
          : null,
      )
    }

    return {
      name: '@local/subagent-model-switcher',
      inject: ['slots', 'remote', 'remote.session'],
      apply(ctx) {
        injectedCtx = ctx
        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register({ name: 'shell.overlay', id: 'subagent-model-switcher', order: 20 }, View),
        )
      },
    }
  },
})
