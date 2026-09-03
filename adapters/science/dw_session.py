"""DiscoveryWorld session helper: tick after every action, fill USE, slim observe.

Generic primitives only. No named-scene scripts.
"""
from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional

from measurement import oldest_key, outlier_name, record_measure

INSTRUMENT_WORDS = (
    "spectrometer", "microscope", "thermometer", "densitometer",
    "phmeter", "ph meter", "radiation", "nutrient meter", "soil nutrient",
    "proteomics", "radiocarbon", "radioisotope",
)


def _name_of(o: Dict[str, Any]) -> str:
    return str(o.get("name") or "")


def _blob(o: Dict[str, Any]) -> str:
    return f"{_name_of(o)} {o.get('description') or ''}".lower()


def _inv(ui: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [o for o in (ui.get("inventoryObjects") or []) if isinstance(o, dict)]


def _env(ui: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [o for o in (ui.get("accessibleEnvironmentObjects") or []) if isinstance(o, dict)]


def _is_instrument(o: Dict[str, Any]) -> bool:
    return any(w in _blob(o) for w in INSTRUMENT_WORDS)


def _is_door(o: Dict[str, Any]) -> bool:
    return "door" in _blob(o)


def fill_use(action: Dict[str, Any], ui: Dict[str, Any]) -> Dict[str, Any]:
    if str(action.get("action")) != "USE":
        return action
    objs = _inv(ui) + _env(ui)
    tools = [o for o in objs if _is_instrument(o)]
    a1 = action.get("arg1")
    a2 = action.get("arg2")
    if a2 is not None:
        o1 = next((o for o in objs if o.get("uuid") == a1), None)
        if o1 and not _is_instrument(o1) and tools:
            action["arg1"], action["arg2"] = tools[0]["uuid"], a1
        return action
    o1 = next((o for o in objs if o.get("uuid") == a1), None)
    others = [o for o in objs if o.get("uuid") != a1 and not _is_door(o) and "table" not in _name_of(o).lower()]
    if o1 and _is_instrument(o1):
        other = next((o for o in others if not _is_instrument(o)), None)
        if other:
            action["arg2"] = other["uuid"]
    elif o1 and tools:
        action["arg1"] = tools[0]["uuid"]
        action["arg2"] = a1
    elif tools:
        other = next((o for o in others if not _is_instrument(o)), None)
        action["arg1"] = tools[0]["uuid"]
        if other:
            action["arg2"] = other["uuid"]
    return action


def slim_observe(ui: Dict[str, Any], memory: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    memory = memory or {}
    task = ui.get("taskProgress") or []
    brief_task = []
    if isinstance(task, list):
        for t in task[:4]:
            if isinstance(t, dict):
                brief_task.append({
                    "taskName": t.get("taskName"),
                    "description": str(t.get("description") or "")[:400],
                    "completed": t.get("completed"),
                })
    def brief(objs, n=12):
        rows = []
        for o in (objs or [])[:n]:
            if isinstance(o, dict):
                rows.append({
                    "uuid": o.get("uuid"),
                    "name": o.get("name"),
                    "description": str(o.get("description") or "")[:80],
                })
        return rows
    return {
        "task": brief_task,
        "inventory": brief(_inv(ui)),
        "reachable": brief(_env(ui)),
        "lastMessage": str(ui.get("lastActionMessage") or "")[:400],
        "measures": [
            {"name": v.get("name"), "vals": v.get("vals")}
            for v in (memory.get("measures") or {}).values()
        ],
        "oldest": oldest_key(memory),
        "outlier": outlier_name(memory),
        "contaminated": memory.get("contaminated_uuid"),
    }


class DwSession:
    def __init__(self, api: Any, memory: Optional[Dict[str, Any]] = None):
        self.api = api
        self.memory: Dict[str, Any] = memory or {"measures": {}}

    def ui(self) -> Dict[str, Any]:
        raw = getattr(self.api, "ui", None)
        if isinstance(raw, list) and raw:
            obj = raw[0]
            if isinstance(obj, dict):
                return obj
            return {
                "taskProgress": getattr(obj, "taskProgress", None),
                "inventoryObjects": getattr(obj, "inventoryObjects", None),
                "accessibleEnvironmentObjects": getattr(obj, "accessibleEnvironmentObjects", None),
                "lastActionMessage": getattr(obj, "lastActionMessage", None),
                "extended_action_message": getattr(obj, "extended_action_message", None),
                "dialog_box": getattr(obj, "dialog_box", None),
            }
        return raw if isinstance(raw, dict) else {}

    def observe(self) -> Dict[str, Any]:
        return slim_observe(self.ui(), self.memory)

    def act(self, action: Dict[str, Any]) -> Dict[str, Any]:
        ui = self.ui()
        action = fill_use(dict(action or {}), ui)
        last = self.api.performAgentAction(agentIdx=0, actionJSON=action)
        try:
            self.api.tick()
        except Exception:
            pass
        high = str(ui.get("extended_action_message") or "") or str(
            getattr(self.api, "ui", [{}])
        )
        if str(action.get("action")) == "USE" and isinstance(last, dict) and last.get("success"):
            a2 = action.get("arg2")
            rec_ui = self.ui()
            obj = next((o for o in _inv(rec_ui) + _env(rec_ui) if o.get("uuid") == a2), None)
            record_measure(
                self.memory,
                key=str(a2),
                name=_name_of(obj) if obj else "",
                text=str(rec_ui.get("extended_action_message") or rec_ui.get("lastActionMessage") or high),
            )
        return {"last": last, "observe": self.observe(), "action": action}


def self_check() -> None:
    ui = {
        "inventoryObjects": [{"uuid": 2, "name": "radiocarbon meter", "description": "a radiocarbon meter"}],
        "accessibleEnvironmentObjects": [{"uuid": 1, "name": "sample", "description": "a rock"}],
        "taskProgress": [{"description": "date the sample"}],
    }
    filled = fill_use({"action": "USE", "arg1": 2}, ui)
    assert filled.get("arg1") == 2 and filled.get("arg2") == 1, filled
    mem: Dict[str, Any] = {}
    record_measure(mem, key="1", name="a", vals=[100.0], text="100 years")
    record_measure(mem, key="2", name="b", vals=[10.0], text="10 years")
    assert oldest_key(mem) == "1"
    print("dw-session self-check ok")


if __name__ == "__main__":
    self_check()
