---
name: traces-typed-action
description: Use in typed-action scientific environments (executable-world / DiscoveryWorld): hidden truth, budgeted actions, instruments and samples, then a concrete submission. Do not use for ordinary coding in a git repo.
---

# Typed-action scientific environments

You cannot see the full world. Act only through legal actions. Observation alone scores nothing.

## Scientific objective

Finish the **science problem**: run the discriminating measurement, keep the reading, and submit or mark the conclusion those readings support.

Embodied moves (walk, open, hand an item) exist only so the experiment can happen. Do not optimize for touring the map.

## Executable World

- Spend free actions before paid ones. Prefer an action that splits several hypotheses.
- Error replies are not fatal; fix the call and continue.
- Decoys are empirical: hash-repeating mirrors, never-repeating honeypots, junk that trips a contamination gate, misleading fields. Verify before relying.
- Submit a concrete executable result. Explore, then land a submission while budget remains; do not spend the episode only looking.
- Do not submit at the first opportunity if you still lack a validity check; do not wait until the last step either.

## DiscoveryWorld / instrument worlds

- After every environment action the world must tick. If a helper CLI exists (`adapters/science/cli.py dw-act`), use it so tick and USE-filling are not skipped.
- USE is instrument → sample (two ids). Pick up the instrument, go to the sample, then USE. Do not teleport to an instrument already in inventory.
- Keep a measurement notebook: what was measured, numeric readings, and labels such as oldest / outlier / contaminated. Choose the next target from those labels, not from a memorized scene name.
- Locked doors: matching key then OPEN. Do not USE a key.
- Give an item: teleport to the person then PUT, even if you already talked.
- If the task names a place in backticks, interact there. Drop a flag only at a matching place.
- `means X` in the task is an object alias. Parse it; do not hard-code character names.

Prefer `adapters/science/cli.py` when present so observations stay slim (task, reachable, inventory, last reading) instead of dumping the full JSON world.
