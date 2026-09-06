# Decision Log

> **This file is a pointer.** Decisions are logged as per-milestone shards under
> [`decisions/`](decisions/), written by `.gq-spec/log-decision.sh`. This file explains
> where to find them and how to log — it holds no entries itself.

## Find a decision

- **Browse:** [`decisions/INDEX.md`](decisions/INDEX.md) — one scannable line per decision
  (`date · id · stage · summary`), grouped by milestone.
- **By milestone:** open `decisions/M<NN>.md` (e.g. `decisions/M14.md`). A comment that says
  *"see DECISION.md for the M14 fix"* points here → open that shard.
- **By id / keyword:** `grep -r <uuid-or-term> decisions/`.

## Layout

```
decisions/
  INDEX.md         one line per decision (rebuild: node .gq-spec/reindex-decisions.mjs)
  design.md        Stage = design (roadmap / planning)
  M01.md, M02.md…  one file per milestone (build:MNN / review:MNN / design:MNN fold in)
  misc.md          onboard / cleanup / unspecified
```

## Log a decision

Use `.gq-spec/log-decision.sh` (env vars in, prints the new id). It routes the entry to the
correct shard from its `GQ_STAGE` and refreshes `INDEX.md`:

```sh
GQ_SUMMARY="…" GQ_DECISION="…" GQ_WHY="…" GQ_STAGE="build:M01" bash .gq-spec/log-decision.sh
```
