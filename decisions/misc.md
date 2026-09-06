# Decisions — misc

> Auto-routed shard of the decision log (see `../DECISION.md`). New entries
> appended by `.gq-spec/log-decision.sh`. Find any decision via
> `decisions/INDEX.md` or `grep -r <term> decisions/`.

## HeroUI OSS only — this repo is open source
- **ID:** 2f31cd1c-3da8-42f8-811c-d1a826994860
- **Date:** 2026-09-06T09:10:32Z
- **Stage:** onboard
- **Decision:** Use @heroui/react (OSS) only. Never install @heroui-pro/react or any @heroui-pro/* package. Process 0200 Step 3a (heroui-pro MCP hard gate) does not apply in this repo. Use OSS HeroUI docs/skills. New interactive UI stays on OSS primitives plus existing Tailwind tokens.
- **Why:** Uniform Order is an open-source product. Pro is a paid licence and must not ship in this codebase. George confirmed this as a standing project exception so agents stop recommending Pro.
- **Alternatives:** Follow the default app-process hard gate (heroui-pro MCP + @heroui-pro/react); keep OSS in app and Pro only in private forks.
- **Pros:** Licence-safe for public GitHub; agents stop re-asking; matches current package.json.
- **Cons:** No Pro components (charts, advanced forms). Default process 0200 Step 3a must be overridden in AGENTS.md/CLAUDE.md.
- **Risks / known issues:** A 0000 rerun refreshes the managed block and re-states the Pro MCP line; the override section after the managed block must stay. Agents that only read the managed block could still try Pro.
- **Links:** AGENTS.md (Project exception + override); CLAUDE.md (same); apps/web/package.json (@heroui/react, no @heroui-pro/react)

