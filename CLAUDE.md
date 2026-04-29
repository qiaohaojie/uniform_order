# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`uniform-order` is a pnpm monorepo whose only current package is `apps/web`: a Next.js 16 / React 19 demo of a multi-tenant school-uniform ordering app. There is no backend — all data lives in `apps/web/src/lib/data.ts` and the cart persists to `localStorage`. Two demo tenants (`nsbh`, `rgsh`) and one demo parent (`PARENT`) are hard-coded.

## Commands

Run from the repo root (workspace = `apps/*`):

- `pnpm install` — installs deps. The root `package.json` declares `pnpm.onlyBuiltDependencies` (`heroui-pro`, `@heroui-pro/react`, `@tailwindcss/oxide`, `sharp`, `unrs-resolver`); without that allowlist pnpm blocks their postinstall scripts and HeroUI Pro / Tailwind v4 will silently produce no styles.
- `pnpm dev:web` — Next dev server (`apps/web`, default port 3000).
- `pnpm build:web` / `pnpm start:web` — production build / start.
- `pnpm check-types` — recursive `tsc --noEmit` across the workspace. `pnpm check-types:web` for just the web app.

There is no test runner, no ESLint, and no formatter wired up. "Done" is verified by `check-types` + a manual run of the dev server.

## HeroUI v3 conventions (load-bearing)

The project uses **two** HeroUI packages side by side: `@heroui/react` (OSS base components) and `@heroui-pro/react` (Pro components). Both CSS bundles are imported in `src/index.css`. Rules:

- Tailwind **v4 only** — v3 silently produces no HeroUI styles.
- **No Provider.** v3 components work without wrapping the tree.
- Use `onPress`, not `onClick`, on HeroUI interactive elements.
- Compound component patterns (e.g. `Sheet.Trigger` / `Sheet.Content`) — never guess the structure; consult the MCP.
- Two MCP servers cover docs: `heroui-react` for base components, `heroui-pro` for Pro. The `heroui-react`, `heroui-react-pro`, and `heroui-pro-design-taste` skills are installed locally — invoke them before authoring HeroUI UI.

The full install rationale lives in `my_doc/HeroUI/heroui-install.md`. Treat its "Decision" callouts as already-made.

## Design source of truth

`my_doc/UI_prototypes/project/` contains the original HTML/JSX prototypes exported from Claude Design (parent flow, operator flow, superadmin flow, design system). The folder's `README.md` is explicit: read the prototype source — don't render or screenshot it — and recreate the visuals; do not blindly copy the prototype's internal structure into the React app. `my_doc/HeroUI/design/` has supporting `data.jsx` / `primitives.jsx` references.
