---
name: scientific-loop
description: How this agent finishes a scientific question in any setting: hidden typed-action worlds, instrument measurements, or a program that must write a named result. Not a separate mode. Ignore clauses that the current observation does not support.
---

# Scientific loop

One agent. The Research Pi contract still owns hypotheses, evidence, and Project memory. This skill is the **same method** when the instrument is an environment action or a program. It rewrites the old strategy loop (cheap probes, stall/failure recovery, submit-then-refine) and the embodied primitives (approach then act, matching key then open, instrument then sample). It is not a second agent and not a folder router.

Completion is a **decision plus a verifiable artifact**: a submitted pick, a placed marker, a required output file, or a recorded measurement that actually updates the claim. Looking, touring, or printing is not completion.

## When the world is hidden and actions are typed

Act only through legal actions the environment lists. Observation alone scores nothing.

**Spend, split, recover**

- Spend free or cheap probes before paid ones. Prefer the listed action that splits several hypotheses at once when costs are equal.
- An error is not fatal. Read it, fix the call, continue. Do not invent a second protocol.
- If the same error or the same observation repeats three times, change the probe. Repeating the identical call is not progress.
- Do not dump large logs or jsonl into the conversation. Write a short driver, run it, keep the brief plus recent results.

**Validity is empirical**

Treat traps as tests, not as a memorized catalog. Before trusting a source, field, or sample:

- Duplicate content across sources has no unique value; do not pay for both.
- A generator that never repeats on re-sample is not a stable source; exclude it.
- A stated junk/spam/contamination limit is a hard gate: the rest of the plan scores nothing until the landed fraction is under that limit.
- Anything you rely on must be checked or declared. A confident answer over unchecked data fails even when the number is right.
- If a scored result is zero or names a failed gate/constraint, and submits remain, revise. Do not stop on the first submit.

**Submit matches the brief's object, not a synonym**

- If the brief shows `submit(plan)` / `submit(finding)` / `submit(strategy)`, pass that name as the `ep.act` params key: `ep.act("submit", {"plan": obj})` when the brief says `submit(plan)`. Flattening inner fields onto the top level is scored as an empty submission.
- Use the inner field names the brief lists. Do not rename them (a `decoys` list is not `suspected_decoys`; a two-number `interval` is not `lo`/`hi` unless the brief says so).
- Fill every allocation field the brief requires (what to collect, buy, or flag) from observations. Submitting only a count, with nothing allocated, scores nothing.
- Duplicate hashes across sources: keep one, flag the copy; do not collect both. The copy is the source whose hashes were already seen elsewhere. A re-sample that shares no ids is a generator; do not collect it. A source whose judged junk-token share is near the stated gate: do not collect it even if some documents are genuine. Gated useful documents may still be bought in a package.
- Count estimates: wide lo/hi from the sample. A wide interval that covers the truth beats a confident point.

**Finish while budget remains**

- Land a concrete submission early, then refine if the environment returns structured feedback.
- When any budget counter is nearly gone, submit the best checked result. Exploring the whole episode scores nothing.
- Do not submit before a minimum validity check.

**After every environment action**

- Advance the world if the API has a tick/step/pass-through. An opened barrier is not finished until you go through it.
- After a reading, call `science_note_measurement` so oldest / outlier / contaminated stay in the working notebook. Those labels are computed from the numbers and text you recorded, not from scene names.

## Embodied primitives (only if the observation is a body in a world)

Ignore this section unless inventory, reachable objects, or movement exist. Use the verb names the current observation lists; do not invent a second API.

- Do not idle or wander while interactable objects are listed. Interact with an id from reachable, inventory, or nearby.
- Nearby but not reachable: go to that id first, then act.
- Already holding an instrument: do not travel to that instrument. Go to the sample, then use them together. Prefer `science_prepare_action` when the observation is JSON objects.
- Use/apply needs both ids when the API is instrument×sample. One id is incomplete.
- Locked barrier: matching key, then open the barrier. Do not use the key as if it were an instrument.
- After opening a barrier, pass through before opening another.
- Closed container: open it, then take what is inside.
- Give: go to the person, then put/give, even if you already talked. Do not loop the same person id after that conversation finished; find a different one if the task still needs talk.
- Talk: use the dialog options the environment lists. Do not guess option ids that were not shown.
- If the task names a place (quoted, backticked, or `means X`), go there. If it asks to place a marker, pick the marker up if needed, then drop it beside the object that matches oldest / outlier / contaminated / that named place. After the required readings, drop or submit; do not keep measuring.
- If the task names a message feed or board, fetch updates first and follow only the source it names.
- Movement arguments are exactly the words the world uses. Do not invent coordinates.

Choose the next target from labels the instruments actually produced or from a place the **current task** names. Never from a memorized scene, character, or coordinate.

## When the deliverable is a scientific program

- Write one complete program. Run it. The **exact named output file** must exist. Exit 0 without that file is failure. Printing a table is not the deliverable.
- Prefer `science_run_program`. Feed stderr / `repair_hint` back and revise.
- Inputs live under the given dataset path. Create parent directories for the output path.
- No shell magics, pip-installs of missing stacks, or tool-call XML as "code".
- If an import fails, rewrite with libraries that are already available (numeric/scientific stacks such as pandas, numpy, sklearn, matplotlib, h5py, PIL, rdkit when present). Do not pip-install a replacement stack.
- Wrong path → reread the tree. Timeout → smaller sample. Non-Python or empty extract → one complete program, then stop explaining.

## How this sits with Research Pi

- A successful command or a written file is work, not yet evidence. Use `record_experiment` when a reading or run actually changes the research judgment.
- `science_note_measurement` is the working notebook of raw readings; it does not replace `record_experiment`.
- `science_prepare_action` only rewrites the next verb (complete instrument×sample, key→open). You still execute it in the world and tick.
- Codex remains the isolated executor. Pi remains responsible for what the result means and what to do next.
- Research Pi compaction already owns long context. Do not reread the whole workspace to compensate.
