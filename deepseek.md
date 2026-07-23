# syncstack — DeepSeek Audit

**Date:** 2026-07-13
**Path:** `C:\Users\TATI\Desktop\DEV\syncstack\`
**Stack:** TypeScript / Vite 5 + React 18 + Yjs (CRDT)
**Tier:** 3 — Medium
**Dependencies:** None installed

---

## 🔴 Security Vulnerabilities

| Severity | File | Line(s) | Vulnerability | Exact Fix |
|----------|------|---------|---------------|-----------|
| 🟡 MEDIUM | `src/App.tsx` | — | Input validation exists (`validateInputs` for title/description/assignee with max 50 chars). Good but could be stricter. | Add XSS sanitization: strip HTML tags from user input before rendering. Yjs CRDT can propagate malicious strings. |
| 🟡 MEDIUM | — | — | No auth for real-time collaboration — per-board token auth exists but was noted as incomplete. | Complete per-board token auth implementation. |
| ✅ | — | — | Yjs CRDT architecture is inherently secure for concurrent edits. Good. | — |

---

## 🟡 UI/UX Improvements

| Severity | File | Line(s) | Issue | Exact Fix |
|----------|------|---------|-------|-----------|
| 🟠 HIGH | `src/App.tsx` | — | **No error boundary** — if Yjs connection fails or CRDT merge conflicts, the entire app crashes with white screen. | Add React error boundary: `class ErrorBoundary extends React.Component { ... }` wrapping the entire app. Show "Connection lost — retrying..." UI. |
| 🟡 MEDIUM | `src/App.tsx` | — | No loading indicators for Yjs connection, card creation, sync status. | Add connection status indicator: "Syncing...", "Offline", "Connected" with visual indicator (green/yellow/red dot). |
| 🟡 MEDIUM | `src/App.tsx` | 394 | No `<main>` landmark — content not wrapped in semantic HTML. | Wrap in `<main className="...">`. |
| 🟡 MEDIUM | `src/App.tsx` | 27 | Hardcoded colors (`#3b82f6`, `#10b981`) in COLORS array. | Tokenize to theme object or CSS vars. |
| 🟡 MEDIUM | `src/App.tsx` | 678-680 | Inline validation error shown near form — good pattern, but no `aria-invalid` or `role="alert"` on error text. | Add `aria-invalid="true"` on input and `role="alert"` on error message. |
| 🟡 MEDIUM | — | — | No sonner/toast library — only inline error for validation. No success feedback for card creation/move. | Add sonner `toast.success()` for card created, column added, etc. |

---

## 🔧 Session: 2026-07-14 — Multi-Agent Deep Audit Sweep (Round 1)

**Status:** Not audited in this round. Previously fixed (July 5): auth tokens no longer logged in plaintext in `server.js`. Sweep Round 2 will cover Tier 3.

| Category | Package | Issue | Fix |
|----------|---------|-------|-----|
| 🟡 MEDIUM | `react ^18.2.0` | React 18 — plan migration to React 19. | — |
| 🟡 MEDIUM | `vite ^5.1.6` | Old Vite 5.1 — current is 5.4+. | Upgrade to Vite 5.4. |
| 🟡 MEDIUM | `yjs ^13.6.14` | Pinned-ish — good. | — |
| 🟡 MEDIUM | `react ^18.2.0` + `react-dom ^18.2.0` | Pinned — good. | — |

### Missing Dev Tooling
- **No eslint** — no `.eslintrc` or config
- **No test framework** — no vitest, no jest
- **No test script** — `package.json` has no `"test"` script
- No `.nvmrc`
- No `typecheck` script

---

## 📋 Priority Fix Queue

1. **[HIGH — Error Boundary]** `src/App.tsx` — Add React error boundary wrapping entire app with connection-lost UI.
2. **[MEDIUM — Loading States]** `src/App.tsx` — Add Yjs connection status indicator (green/yellow/red dot).
3. **[MEDIUM — Semantic HTML]** `src/App.tsx:394` — Wrap content in `<main>` landmark.
4. **[MEDIUM — Accessibility]** `src/App.tsx:678-680` — Add `aria-invalid` and `role="alert"` on validation errors.
5. **[MEDIUM — Dev Tooling]** Add eslint, vitest, `.nvmrc`, `typecheck` script. Add `sonner` for toast feedback.
6. **[LOW — Colors]** Tokenize hardcoded COLORS array.
