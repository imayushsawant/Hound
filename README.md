# Hound 🐾

> **Hound — Your next chapter.**  
> A fast, beautiful, local-first job application tracker built with Electron, React, and SQLite. Zero cloud. Zero tracking. Complete privacy.

---

## ⬇️ Download Hound for Windows

Get the latest official release for Windows (x64):

| Package | Download Link | Type |
| :--- | :--- | :--- |
| **Windows Installer** *(Recommended)* | [**Download Hound-Setup-1.0.0.exe**](https://github.com/imayushsawant/Hound/releases/download/v1.0.0/Hound-Setup-1.0.0.exe) | Standard `.exe` setup wizard with Desktop & Start Menu shortcuts |
| **Portable Version** | [**Download Hound-1.0.0-win.zip**](https://github.com/imayushsawant/Hound/releases/download/v1.0.0/Hound-1.0.0-win.zip) | Standalone portable archive — extract and run without installing |

👉 **[View all releases & changelogs on GitHub](https://github.com/imayushsawant/Hound/releases/latest)**

### Installation Guide

1. **Download the installer**: Click [**Hound-Setup-1.0.0.exe**](https://github.com/imayushsawant/Hound/releases/download/v1.0.0/Hound-Setup-1.0.0.exe).
2. **Run Setup**:
   - Double-click `Hound-Setup-1.0.0.exe`.
   - **Windows SmartScreen Prompt**: Since Hound is a free and open-source project without a paid commercial enterprise certificate, Windows Defender SmartScreen may display a *"Windows protected your PC"* window.
   - Click **More info** → **Run anyway** to launch the installer.
3. **Follow the Wizard**:
   - Choose your preferred installation directory (defaults to your local programs folder).
   - Let the installer automatically create Desktop and Start Menu shortcuts.
4. **Launch Hound**:
   - Open Hound from your Desktop or Start Menu.
   - Press <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>J</kbd> anytime to open the global quick-add window from anywhere on your PC!

---

## Overview

Hound helps you stay organized and keep your momentum during the job search without surrendering your private career data to third-party services.

- **Local-first & private**: All data is stored in a local SQLite database on your device. No accounts, no external tracking, and no cloud dependencies.
- **Single entry point**: Create an application with just company, role, and stage. Companies are automatically discovered or created case-insensitively.
- **One write path**: All mutations pass through a single, transaction-safe SQLite repository layer in the main process, broadcasting real-time `data:changed` events to all windows.
- **Derived single source of truth**: Next actions, company application counts, and technical interview topics are dynamically derived rather than redundantly duplicated.
- **Interview rounds & timeline**: Track interview rounds with auto-advancing application stages, overdue round indicators, and technical topic tagging.
- **CodeMirror Markdown notes**: Full-page prep and interview notes with Markdown formatting, GitHub-flavored markdown preview, debounced autosave, and `.md` export.
- **Opportunity radar**: Schedule recurring check-ins for job boards (LinkedIn, Indeed, etc.) with automatic reminder notifications.
- **Background scheduler & notifications**: Native OS reminders for due boards, overdue interviews, and stale applications needing follow-ups, de-duplicated to fire at most once per item per day.
- **Quick-add window & system tray**: Press <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>J</kbd> from anywhere on your system to bring up a lightweight quick-add dialog. Closing the app hides it to the system tray.
- **Dark mode following OS**: Automatic light and dark themes honoring your operating system settings.
- **Daily SQLite backups**: Automatic daily SQLite snapshots keeping the last 7 backups, plus one-click JSON export and restore.
- **Single-instance lock**: Prevents multiple processes; launching a second instance immediately focuses your active window.

---

## Getting Started

### Prerequisites

- **Node.js** 22 or higher
- **npm** (or pnpm)
- Windows desktop (macOS & Linux supported)

### Development

Install dependencies and start the desktop app:

```sh
# Install dependencies and native SQLite bindings
npm install

# Start development mode with hot-reloading (electron-vite + Electron)
npm run dev

# Or explicitly start desktop:
npm run dev:desktop

# Or launch browser-only preview:
npm run dev:web
```

### Seeding Demo Data

To populate your database with 5 sample companies and 8 applications across various interview stages:

```sh
npm run seed
```

### Running Tests & Verification

```sh
# Run the complete test suite (repository, scheduler, backups, migrations, derivation)
npm test

# Run TypeScript typecheck across all source, desktop, test, and script files
npm run typecheck

# Build the desktop bundles
npm run build
```

---

## Building the Installer Locally

Hound uses `electron-builder` to package standalone desktop installers.

```sh
# Compile app and package Windows NSIS installer & portable distribution
npm run dist:win
```

The resulting installer (`Hound-Setup-1.0.0.exe`) and portable archive (`Hound-1.0.0-win.zip`) will be generated inside the `release/` directory.

### Automated Cloud Releases (GitHub Actions)

This repository includes a ready-to-run GitHub Actions workflow (`.github/workflows/release.yml`):
- Pushing any version tag (e.g., `git tag v1.0.0 && git push origin v1.0.0`) automatically builds `Hound-Setup-1.0.0.exe` on a clean Windows runner and publishes a new GitHub Release with installer binaries attached.
- You can also manually trigger a release from the **Actions** tab on GitHub by clicking **Run workflow**.

---

## Data Storage & Backups

### Database Location

Hound stores all records inside an embedded SQLite database using WAL (Write-Ahead Logging) mode and foreign key constraints:

- **Windows**: `%APPDATA%\Hound\hound.db` (or `nudge.db`)
- **macOS**: `~/Library/Application Support/Hound/hound.db` (or `nudge.db`)
- **Linux**: `~/.config/Hound/hound.db` (or `nudge.db`)

> **Tip**: You can open this directory directly from the app by going to **Settings** → **Open data folder**.

### Automatic Backups

Hound performs an automated SQLite snapshot on startup and during regular 15-minute background maintenance checks:
- Saved to `<userData>/backups/backup-YYYY-MM-DD.db` using transaction-safe SQLite `VACUUM INTO`.
- Automatically retains the last **7 days** of daily backups, pruning older snapshots.
- You can also export or import your entire workspace as a standalone `.json` file from the **Settings** page at any time.

---

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| <kbd>Ctrl</kbd> + <kbd>N</kbd> | Open **Add Application** dialog |
| <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>J</kbd> | Open global **Quick Add** window (works globally across OS) |
| <kbd>Ctrl</kbd> + <kbd>E</kbd> | Toggle Markdown notes between **Edit** and **Preview** |
| <kbd>?</kbd> | Show **Keyboard Shortcuts & Help** dialog |
| <kbd>Esc</kbd> | Close open modals, dropdowns, and notification popovers |
| <kbd>Enter</kbd> | Save and submit modal forms |

---

## Architecture & Code Boundaries

- `electron/main/`: Electron lifecycle, single-instance lock, tray, global shortcuts, IPC handlers, scheduler, and SQLite repository.
- `electron/main/db/`: SQLite connection (`better-sqlite3`), transaction-safe queries, numbered idempotent migrations, and automated backups.
- `electron/preload/`: Context-isolated, narrow typed IPC bridges (`window.houndDesktop`, `window.hound`, and `window.nudge`).
- `src/`: React frontend with full keyboard navigation, CodeMirror 6 markdown editor, dark mode theme styles, and zero direct Node/SQLite access.
- `tests/`: Automated unit tests testing native SQLite behaviors, auto-advancing stages, reminders, and daily backup retention.
