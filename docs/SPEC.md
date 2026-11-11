# Hound: Spec

## Dashboard
Active applications table: company, role, stage, next action, applied date, last updated. Sortable, filterable by stage, searchable. Inline stage change.

## Companies
List of all companies. Company page shows overview, notes, and all applications to that company (multiple per company is normal). Companies are auto-created on first use, with autocomplete to prevent duplicates.

## Application detail
- Overview: company overview, role, location, work mode (internship / full-time), source, posting URL, applied date, status, resume used
- Rounds and timeline (below)
- Outcome: offer package, joining date, rejection reason, technical topics asked

## Rounds and timeline
Ordered rounds per application (Aptitude OA, DSA OA, Technical, LLD, HLD, Managerial, HR, Custom). Each has: date, status, next action, resume used, prep notes (Markdown), interview notes (Markdown). Markdown editor with a toggle to rendered view.

## Next action
Typed manually OR derived from the nearest upcoming round / follow-up due. Manual value overrides derived.

## Reminders and quick access
- Job boards list with check frequency and last-checked time; native reminders when due
- Auto follow-up reminder 7 days after applying
- Global hotkey quick-add (Ctrl+Shift+J), tray, launch on login

## Platform
Electron desktop app, local only, single user, installable on Windows (macOS config optional). Renderer is a React web app.
