# AGENTS.md

Project notes for AI coding agents working in this repository. Prefer reading the referenced files over trusting fixed details here — this document points at where information lives, not what it currently says.

`CLAUDE.md` at the repository root is a symlink to this file, so tools looking for either name resolve to the same content.

## Project

Desktop flashing utility for LISTENAI CSK series chips (CSK6, LS26). Tauri 2 app: Vue 3 + Naive UI frontend, Rust backend, with the upstream [`cskburn`](https://github.com/LISTENAI/cskburn) CLI bundled as a sidecar binary.

## Commands & toolchain

- Scripts live in [package.json](package.json) under `scripts` — check there for the current `dev` / `build` / `lint` / `tauri` entry points rather than memorizing them.
- Rust side: `cargo check` / `cargo clippy` inside [src-tauri/](src-tauri/) for fast feedback. There is no separate test suite.
- Supported targets (and bundled sidecar triples) are listed in [src-tauri/cskburn-cli/update.sh](src-tauri/cskburn-cli/update.sh); that script is also how you bump the bundled cskburn binary to a new upstream release.

## Architecture

### Two flashing paths, one UI

The app supports two transports; they share the partition UI and the `useFlashSession` state machine but talk to different backends:

- **Serial** — spawns the bundled `cskburn` sidecar and parses its stdout line-by-line to emit progress events. See [src/utils/cskburn.ts](src/utils/cskburn.ts). The parser is coupled to cskburn's human-readable log format, so updating the bundled binary can require adjusting regexes here.
- **ADB** — used when a device is in recovery mode. Shells out to system `adb` for `info` / `push` / `md5sum` / `reboot`. See [src/utils/adb.ts](src/utils/adb.ts).

The top-level [src/App.vue](src/App.vue) chooses between them based on the selected port type and wires both into `useFlashSession`.

### Image formats → partitions

User-dropped files become `IFlashImage` entries, which flatten to `IPartition`s handed to the flasher. Supported formats and the extension-routing logic are in [src/utils/images.ts](src/utils/images.ts); the flattening is in [src/composables/partitions.ts](src/composables/partitions.ts). Container formats (`.lpk`, `.hex`) are parsed in Rust (see below) and their payloads are extracted into the app cache dir as `TmpFile`s — see [src/utils/file.ts](src/utils/file.ts).

Chip name normalization (marketing name ↔ cskburn `--chip` value) lives in [src/utils/model.ts](src/utils/model.ts); dropping an `.lpk` with a chip tag auto-selects the chip through this map.

### Rust backend

The Rust side is intentionally thin — the actual flash protocol lives in the cskburn sidecar, not here. For the current list of `#[tauri::command]`s registered with the app, read the `invoke_handler!` block in [src-tauri/src/main.rs](src-tauri/src/main.rs); each module file there (`cmds_*.rs`) implements one area (hex/lpk parsing, serialport enumeration + watcher, md5, Windows code-page decode).

### State management

No Pinia/Vuex. Shared state is exposed through composables in [src/composables/](src/composables/). The key one is [useFlashSession.ts](src/composables/useFlashSession.ts), which owns the flash status machine, output log, chip/flash info, and the `AbortController` backing the stop button. Both transports funnel into its `handleFlashSuccess` / `handleFlashError`, passing their own error classes so the session can distinguish "user stopped" from "process crashed".

### Tauri capabilities

Any new Rust command, shell sidecar, or FS path needs an entry in [src-tauri/capabilities/main.json](src-tauri/capabilities/main.json) — the `shell:allow-spawn` / `shell:allow-execute` allowlists are narrow on purpose.

## Conventions

- Path alias `@/` → `src/` (see [vite.config.ts](vite.config.ts) and [tsconfig.json](tsconfig.json)). Prefer it over relative imports.
- UI strings are in Simplified Chinese.
- Lint rules live in [eslint.config.js](eslint.config.js) — notably `eqeqeq` is configured with `null: 'ignore'`, so `==`/`!=` is reserved for null/undefined checks.
- File-descriptor classes in [src/utils/file.ts](src/utils/file.ts) use `class-transformer` + `reflect-metadata`; when adding fields, remember the `@Type` decorator for non-primitives.

## Git & commits

Match the existing history's style (`git log` is authoritative — check it before making assumptions):

- **Granularity.** Commit per logical change, not per file and not per session. A bug fix and an unrelated refactor belong in separate commits.
- **Auto-commit.** Commit changes promptly after each completed task without waiting for explicit instruction, so work is never left uncommitted at the end of a session. If changes span multiple logical units, split them into separate commits.
- **Subject line.** Imperative mood, capitalized, no trailing period, kept short (aim for ≤72 chars). Examples in `git log`: `Fix filtering of serial ports on Mac`, `Extract useFlashSession composable from App.vue`.
- **Body (when useful).** Explain *why* / non-obvious *how*, wrapped at ~72 cols. Skip it for trivial changes.
- **Trailers.** Every commit must include `Signed-off-by:` — always pass `git commit -s`. When an AI agent authored or co-authored the change, also add a `Co-Authored-By:` trailer naming the **current model and version** (e.g. `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`). Do not copy a stale model name from a previous commit — use the model actually running now.
- **Do not** amend or force-push published commits, skip hooks (`--no-verify`), or bypass signing without explicit user approval.
