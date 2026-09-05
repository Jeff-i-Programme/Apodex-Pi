"""Measurement notebook: oldest / outlier / contaminated from instrument readings.

Labels come from the numbers and text you recorded, not from scene names.
"""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

_LABELED_NUM = re.compile(r"(?::|=)\s*([-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)")
_ANY_NUM = re.compile(r"(?<![A-Za-z0-9])([-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)")
_CONTAMINATED = re.compile(r"contaminat|adulterat|invalid sample", re.I)


def nums_from_text(text: str) -> List[float]:
    raw = text or ""
    labeled = [float(x) for x in _LABELED_NUM.findall(raw)]
    if labeled:
        return labeled
    return [float(x) for x in _ANY_NUM.findall(raw)][:8]


def record_measure(
    memory: Dict[str, Any],
    *,
    key: str,
    name: str = "",
    text: str = "",
    vals: Optional[List[float]] = None,
) -> Dict[str, Any]:
    nums = list(vals or [])
    if not nums:
        nums = nums_from_text(text or "")
    rec = {"name": name, "vals": nums, "text": (text or "")[:400]}
    memory.setdefault("measures", {})[str(key)] = rec
    if _CONTAMINATED.search(text or "") and key:
        memory["contaminated_uuid"] = key
    return rec


def oldest_key(memory: Dict[str, Any]) -> Optional[str]:
    """Largest numeric reading (age, count, magnitude — not a scene name)."""
    best_k, best_age = None, -1.0
    for k, v in (memory.get("measures") or {}).items():
        vals = v.get("vals") or []
        if not vals:
            continue
        age = max(float(x) for x in vals)
        if age > best_age:
            best_age, best_k = age, k
    return best_k


def outlier_name(memory: Dict[str, Any]) -> Optional[str]:
    by_name: Dict[str, List[float]] = {}
    for rec in (memory.get("measures") or {}).values():
        name = str(rec.get("name") or "").strip()
        vals = rec.get("vals") or []
        if name and vals:
            by_name[name] = [float(x) for x in vals]
    if len(by_name) < 2:
        return None
    dim = min(len(v) for v in by_name.values())
    if dim < 1:
        return None
    names = list(by_name)
    means = [sum(by_name[n][i] for n in names) / len(names) for i in range(dim)]
    best_name, best_d = None, -1.0
    for n in names:
        d = sum((by_name[n][i] - means[i]) ** 2 for i in range(dim))
        if d > best_d:
            best_name, best_d = n, d
    return best_name
