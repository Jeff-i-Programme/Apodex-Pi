"""Portable science-program execute loop (syntax → run → named output)."""
from __future__ import annotations

import ast
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, Optional

HEAVY_PACKAGES = (
    "torch", "scanpy", "cartopy", "deepchem", "rasterio", "anndata",
)

FALLBACK_STACK = "pandas/numpy/sklearn/matplotlib/h5py/PIL/rdkit"


def looks_like_python(code: str) -> bool:
    s = (code or "").strip()
    if len(s) < 20:
        return False
    head = s[:120].lower()
    if s.startswith("<") or "tool_call" in head or head.startswith("find ") or head.startswith("ls "):
        return False
    try:
        ast.parse(s)
        return True
    except SyntaxError:
        return False


def extract_python(text: str) -> str:
    blocks = [b.strip() for b in re.findall(r"```(?:python)?\s*([\s\S]*?)```", text or "", re.I)]
    for code in blocks:
        if looks_like_python(code):
            return code
    fallback = (text or "").strip()
    if looks_like_python(fallback):
        return fallback
    return ""


def dataset_path_from_tree(tree: str) -> str:
    first = (tree or "").split("\n")[0].strip()
    name = re.sub(r"^[|\-\s]+", "", first).strip().strip("/")
    if not name:
        return "benchmark/datasets"
    return "benchmark/datasets/" + name


def repair_hint(error: str, *, dataset_path: str = "", output_path: str = "") -> str:
    el = (error or "").lower()
    parts = []
    if "no module named" in el or any(p in el for p in HEAVY_PACKAGES):
        parts.append(
            f"Do not pip-install heavy packages ({', '.join(HEAVY_PACKAGES)}). "
            f"Rewrite using {FALLBACK_STACK} if those exist."
        )
    if "no such file" in el or "filenotfound" in el:
        if dataset_path:
            parts.append(f"Wrong path. Inputs live under {dataset_path}.")
        if output_path:
            parts.append(f"Create parent dirs and write exactly: {output_path}.")
    if "timeout" in el:
        parts.append("Too slow. Use a smaller sample, avoid nested loops, skip unused plots.")
    if output_path and "missing output" in el:
        parts.append(f"The program did not write {output_path}. Writing/printing is not enough.")
    return "\n".join(parts)


def try_run(
    code: str,
    *,
    cwd: str,
    output_path: str = "",
    timeout: int = 45,
    scratch: Optional[str] = None,
) -> Dict[str, Any]:
    rec: Dict[str, Any] = {"syntax_ok": False, "ran": False, "success": 0}
    if not (code or "").strip():
        rec["error"] = "empty program"
        return rec
    try:
        ast.parse(code)
        rec["syntax_ok"] = True
    except SyntaxError as e:
        rec["error"] = f"SyntaxError: {e}"
        return rec
    root = Path(cwd)
    out = Path(output_path) if output_path else None
    if out is not None and not out.is_absolute():
        out = root / out
    if out is not None:
        try:
            out.parent.mkdir(parents=True, exist_ok=True)
        except OSError:
            pass
    scratch_path = Path(scratch) if scratch else root / "exec_scratch.py"
    scratch_path.write_text(code, encoding="utf-8")
    t0 = time.time()
    env = dict(os.environ)
    env.setdefault("MPLBACKEND", "Agg")
    try:
        r = subprocess.run(
            [sys.executable, str(scratch_path)],
            cwd=str(root),
            capture_output=True,
            text=True,
            timeout=timeout,
            encoding="utf-8",
            errors="replace",
            env=env,
        )
        rec["ran"] = True
        rec["returncode"] = r.returncode
        rec["stderr_tail"] = (r.stderr or "")[-1200:]
        produced = bool(out) and out.exists()
        rec["output_exists"] = produced
        rec["success"] = 1 if r.returncode == 0 and (not output_path or produced) else 0
        if r.returncode != 0:
            rec["error"] = rec["stderr_tail"][:500] or f"exit {r.returncode}"
        elif output_path and not produced:
            rec["error"] = f"ran ok but missing output {output_path}"
            rec["success"] = 0
    except subprocess.TimeoutExpired:
        rec["ran"] = True
        rec["error"] = "Timeout"
    except Exception as e:
        rec["error"] = f"{type(e).__name__}: {e}"
    rec["elapsed_s"] = round(time.time() - t0, 1)
    rec["repair_hint"] = repair_hint(
        str(rec.get("error") or ""),
        dataset_path="",
        output_path=output_path,
    )
    return rec


def main(argv: list[str] | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(prog="science-code-loop")
    p.add_argument("--cwd", required=True)
    p.add_argument("--code-file")
    p.add_argument("--code")
    p.add_argument("--output")
    p.add_argument("--timeout", type=int, default=45)
    p.add_argument("--scratch")
    a = p.parse_args(argv)
    code = a.code or ""
    if a.code_file:
        code = Path(a.code_file).read_text(encoding="utf-8")
    rec = try_run(code, cwd=a.cwd, output_path=a.output or "", timeout=a.timeout, scratch=a.scratch)
    json.dump(rec, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0 if rec.get("success") else 1


if __name__ == "__main__":
    raise SystemExit(main())
