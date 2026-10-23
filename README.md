# dsh-subagent-model-switcher

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin.
Press **Alt+K** to open a modal that sets the model and reasoning effort each
subagent delegation tool uses when it starts a child, with a live model
catalogue, a last-good cache, and a guard against models that have disappeared.

It also ships seven ported **Gentle AI** roles as native Harness presets and
tools: the working roles `subagent_worker`, `subagent_verify`, and
`subagent_explore`, plus the four read-only review lenses `subagent_review_risk`,
`subagent_review_readability`, `subagent_review_reliability`, and
`subagent_review_resilience`.

## Features

- **One row per delegation tool**, with an `Override` switch per row. Unset rows
  keep the Harness default (the child inherits the parent session's model).
- **Model + reasoning effort**, limited to the efforts the selected model's
  adapter actually advertises.
- **Live catalogue**: every open reads the same session catalogue the composer
  model picker uses. The last good copy is cached in `localStorage`, the modal
  shows when it was updated, and a Refresh action forces a new read.
- **No silent 404s**: a saved model that is no longer advertised is flagged in
  its row and Save is blocked until it is changed or cleared.
- **Keyboard first**: `Alt+K` toggles, `Escape` closes.

## Requirements

- DeepSeek Harness **0.2.1-rc.2** (verified against the desktop app). The plugin
  uses `session.snapshotEvents()`, `foldSubagentDescriptor`,
  `installModelSelection`, `ctx.remote.session.modelCatalog()`, and
  `ctx.webServer.register`; a different Harness line may change them.
- The package must live **inside the profile tree**, because its
  `@deepseek-ai/*` imports resolve from there.

## Install

The repository root is the plugin package (a bundle: its `package.json` declares
`dsh.bundle.patch`).

```powershell
git clone https://github.com/diegoquinfa/dsh-subagent-model-switcher.git
```

1. Copy the package into your profile's plugin directory:

   ```powershell
   $dst = "$env:USERPROFILE\.dsh\profiles\desktop\plugins\dsh-subagent-model-switcher"
   Copy-Item .\dsh-subagent-model-switcher $dst -Recurse
   ```

2. Make it resolvable from the profile (a junction avoids a package-manager
   round trip; `dsh plugin --profile desktop add <path>` does the same through
   pnpm):

   ```powershell
   New-Item -ItemType Junction `
     -Path "$env:USERPROFILE\.dsh\profiles\node_modules\dsh-subagent-model-switcher" `
     -Target $dst
   ```

3. Select the bundle in the profile's `package.json`:

   ```json
   {
     "dsh": {
       "profile": {
         "bundles": [
           "@deepseek-ai/dsh-base",
           "@deepseek-ai/dsh-web-app",
           "dsh-subagent-model-switcher"
         ]
       }
     }
   }
   ```

4. Restart the Harness. The host module and the Client module graph are
   composed at boot.

Then press **Alt+K**.

### Update

```powershell
git pull
Copy-Item .\dsh-subagent-model-switcher\* $dst -Recurse -Force
```

Restart afterwards: the host half is an ES module cached per process.

### Uninstall

Remove `dsh-subagent-model-switcher` from `dsh.profile.bundles`, delete the
junction and the plugin directory, then restart. Selections are stored in
`$DSH_HOME/subagent-models.json`; delete that file to reset them.

## Configuration

The plugin row accepts an optional `targets` array. Without it, these five are
used:

```yaml
- id: subagent-model-switcher
  name: 'dsh-subagent-model-switcher'
  config:
    targets:
      - { id: subagent_worker,  provider: spawn-worker,  label: Gentle AI Worker,  tool: subagent_worker }
      - { id: subagent_verify,  provider: spawn-verify,  label: Gentle AI Verify,  tool: subagent_verify }
      - { id: subagent_explore, provider: spawn-explore, label: Gentle AI Explore, tool: subagent_explore }
      - { id: review_risk,          provider: spawn-review-risk,          label: Review Risk (R1),          tool: subagent_review_risk }
      - { id: review_readability,   provider: spawn-review-readability,   label: Review Readability (R2),   tool: subagent_review_readability }
      - { id: review_reliability,   provider: spawn-review-reliability,   label: Review Reliability (R3),   tool: subagent_review_reliability }
      - { id: review_resilience,    provider: spawn-review-resilience,    label: Review Resilience (R4),    tool: subagent_review_resilience }
      - { id: subagent,         provider: spawn,         label: Subagent,         tool: subagent }
      - { id: subagent_fork,    provider: fork,          label: Subagent fork,    tool: subagent_fork }
```

- `provider` must match the `providerName` of a mounted
  `@deepseek-ai/dsh-subagent-spawn-in-process` (or the fork provider). The plugin
  identifies the child through the `provider` recorded in its persisted
  `subagent/descriptor`.
- `id` is the settings key and the modal row identity.
- `tool` is the model-facing tool name, shown in the row.

### Keep only the modal

The bundle patch inserts the roles as well. To keep only the modal, delete the
`subagent-spawn-*`, `preset-gentle-*`, `preset-review-*`, and `tool-subagent-*`
rows from `cordis.patch.yml` (and the matching `targets` entries if you like). The modal
then covers whatever delegation tools your profile already mounts.

## Included roles

| Role | Tool | Provider | Preset | Tools it owns |
|---|---|---|---|---|
| Worker | `subagent_worker` | `spawn-worker` | `gentle-worker` | fs (read/write/edit), search, shell, skill, todo |
| Verify | `subagent_verify` | `spawn-verify` | `gentle-verify` | read-only fs, search, shell, todo |
| Explore | `subagent_explore` | `spawn-explore` | `gentle-explore` | read-only fs, search, todo |
| Risk (R1) | `subagent_review_risk` | `spawn-review-risk` | `review-risk` | read-only fs, search, todo |
| Readability (R2) | `subagent_review_readability` | `spawn-review-readability` | `review-readability` | read-only fs, search, todo |
| Reliability (R3) | `subagent_review_reliability` | `spawn-review-reliability` | `review-reliability` | read-only fs, search, todo |
| Resilience (R4) | `subagent_review_resilience` | `spawn-review-resilience` | `review-resilience` | read-only fs, search, todo |

Each role gets its own provider so the child's durable descriptor names the role,
which is what lets the modal address it separately. The personas are adapted
from the Gentle AI agent definitions and are inlined in `cordis.patch.yml`; no
external files are required.

## How it works

- **Host** (`index.js`): stores the selections in
  `$DSH_HOME/subagent-models.json`, serves them to the page at
  `GET/POST /subagent-model-switcher` (loopback socket and `Host` header checked
  by the handler itself), and on `agent/created` folds the child's
  `subagent/descriptor` to find its role, then installs the selection with
  `installModelSelection` before the child's first turn.
- **Client** (`client.js`): one component in the `shell.overlay` slot, registered
  through `ctx.slots.inject` / `ctx.slots.register`, with theme-token styling and
  no build step.

The browser settings plane only exposes a fixed namespace allowlist, which is
why the policy travels over the plugin's own loopback route instead.

## Troubleshooting

- The host writes a trace to `$DSH_HOME/subagent-models.log`:
  `apply`, `wrapper target`, `created <id>: descriptor=<provider>`,
  `installed <id>: <role> -> <provider>/<model>`, and `fold failed ...`.
- If the modal opens but a row is empty, check that the provider in `targets`
  matches a mounted provider row.
- If a saved model is flagged, pick another model or clear the override; Save is
  blocked on purpose.

## License

`UNLICENSED` — all rights reserved until the author chooses a license. The role
personas are adapted from the Gentle AI agent definitions; keep their
attribution if you redistribute them.
