# Nudge

A local-only, single-user job application tracker. This is the foundation and
navigation shell only; application tracking features are intentionally not built.

## Development

Use Node.js 22 and npm on a Windows desktop:

```sh
npm install
npm run dev
```

`npm run dev` launches electron-vite and Electron. In Figma Make's hosted
environment (`FIGMA`, `PORT`, or `FIGMA_DEV_SERVER_HOST`), it serves only the React preview.
`npm run dev:desktop` explicitly selects Electron; `npm run dev:web` selects Vite.
The browser preview never opens a database or pretends to have desktop capabilities.

```sh
npm run typecheck
npm test
npm run build
node scripts/test-shell.mjs
npm run build:web
npm run format -- --check
npm run dist:win
```

Windows packaging uses the existing electron-builder dependency and produces an
NSIS installer in `release/`. Build it on Windows; signing and distribution
credentials are not configured. No remote is added and nothing is pushed.

## Boundaries

- `electron/main`: window lifecycle, IPC, and local data access.
- `electron/preload`: a narrow, typed `window.nudge` bridge, never raw IPC.
- `src`: React renderer, with no Node or SQLite access.
- `src/shared/api.ts`: the shared IPC contract.
- `electron.vite.config.ts`: desktop builds; `vite.config.ts`: hosted web preview.

The desktop window uses context isolation, a sandboxed preload, disabled Node
integration, a Content Security Policy, denied permissions, and blocked external
navigation. Features, global shortcuts, tray, notifications, and launch-on-login
are future work, not active shell controls.

## Local database

Electron opens `nudge.db` inside `app.getPath('userData')`. SQLite uses WAL mode and
foreign keys. `electron/main/db/repository.ts` owns the connection and is the only
write boundary; successful transactions broadcast `data:changed` to all windows.
The renderer receives only typed IPC results, never SQL or a database handle.

Add schema changes as new numbered files in `electron/main/db/migrations/` (for
example, `002_add_field.sql`). Migrations are numerically ordered, checksummed,
transactional, recorded in `schema_migrations`, and copied into desktop builds.
Never edit or remove an applied migration. A failed migration rolls back and stops
startup without deleting user data.

The initial schema contains companies, applications, rounds, and boards; there are
no CRUD APIs, seed records, or feature flows yet. Summary counts, company-level
topics, last-updated values, and derived next actions must be queried from source
records when those features are built.

`npm test` uses Electron's Node runtime to test the actual native SQLite binding.
`npm install` rebuilds native modules for Electron through electron-builder.

## Shell

`src/shell/App.tsx` is the active scaffold, using React Router's hash routes so
navigation works with packaged `file://` URLs. The four destinations are
Dashboard, Companies, Boards, and Settings. Tracking actions are intentionally
disabled or absent; the shell does not seed, save, or simulate applications.
`src/shell/useAppInfo.ts` refetches the typed main-process information on every
`data:changed` event. Browser mode has no persistence fallback.

The isolated shell stylesheet owns its Tailwind entry and uses system fonts, so
the renderer needs no network access. Other frontend work in the workspace is
preserved and is not mounted by this scaffold.

After building, `node scripts/test-shell.mjs` exercises the compiled Electron app
with a temporary user-data directory. It verifies the preload boundary, routes,
event-driven refetching, narrow layout, and storage-free browser mode. Linux uses
Chromium's headless Ozone platform; the test does not disable the sandbox.
