---
name: science-code-loop
description: Use when the task is a scientific data program that must write a specified output file from a given dataset path. Do not use for ordinary project scripts, tests, or research notes.
---

# Science code loop

Completion is a **runnable program plus the required output artifact**, not a sketch or a printout.

## Method

1. Read the task, domain notes, and dataset tree. All inputs live under the given dataset path (typically `benchmark/datasets/<first-folder>/`).
2. Write one complete Python program in a ```python fence. No `!pip`, magics, tool-call XML, or shell wrappers.
3. Create parent directories and write the **exact** output path the task names. Printing tables is not success.
4. Run it (prefer `adapters/science/cli.py run-program` when that adapter is on disk). Feed stderr back and revise.
5. If a heavy package is missing (`torch`, `scanpy`, `cartopy`, `deepchem`, `rasterio`, `anndata`), rewrite with pandas / numpy / sklearn / matplotlib / h5py / PIL / rdkit. Do not pretend to pip-install those heavy stacks.
6. Wrong path → reread the dataset tree. Timeout → smaller sample, no nested full scans.
7. Empty extract or non-Python reply → one complete fence only, then stop explaining.

A program that exits 0 but does not create the named output file has failed.
