#!/usr/bin/env python3
"""CLI for science adapters. JSON on stdout. No model calls."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if not argv or argv[0] in {"-h", "--help"}:
        sys.stdout.write(
            "usage:\n"
            "  python cli.py self-check\n"
            "  python cli.py run-program --cwd DIR [--code-file F | --code STR] [--output PATH]\n"
            "  python cli.py note --cwd DIR --key K [--name N] [--text T] [--vals 1,2]\n"
            "  python cli.py prepare-action --ui-json STR --action-json STR\n"
            "  python cli.py dw-self-check\n"
        )
        return 0
    cmd = argv[0]
    if cmd == "self-check":
        from measurement import oldest_key, outlier_name, record_measure

        mem = {}
        record_measure(mem, key="1", name="sample-a", vals=[0.4, 0.4])
        record_measure(mem, key="2", name="sample-b", vals=[0.9, 0.1])
        record_measure(mem, key="3", name="sample-c", vals=[0.41, 0.39])
        assert outlier_name(mem) == "sample-b", outlier_name(mem)
        record_measure(mem, key="9", name="old", text="age: 1200")
        assert oldest_key(mem) == "9"
        from measurement import nums_from_text
        assert nums_from_text("reading = 3.5 units") == [3.5]
        record_measure(mem, key="c1", name="bad", text="sample contaminated by reagent", vals=[0.1])
        assert mem.get("contaminated_uuid") == "c1"
        print("measurement self-check ok")
        from code_loop import looks_like_python, try_run

        assert looks_like_python("print(1)\n" * 8)
        assert not looks_like_python("<tool_call>")
        import tempfile, os
        with tempfile.TemporaryDirectory() as td:
            rec = try_run(
                "from pathlib import Path\nPath('out.txt').write_text('ok')\n",
                cwd=td,
                output_path="out.txt",
                timeout=10,
            )
            assert rec.get("success") == 1, rec
            rec2 = try_run("print('hi')\n", cwd=td, output_path="missing.txt", timeout=10)
            assert rec2.get("success") == 0 and rec2.get("ran"), rec2
            rec3 = try_run("import definitely_not_a_real_pkg_xyz\n", cwd=td, timeout=10)
            assert rec3.get("success") == 0
            assert "pandas" in str(rec3.get("repair_hint") or "").lower() or "no module" in str(rec3.get("error") or "").lower()
            rec4 = try_run("print('hi')\n", cwd=td, timeout=10)
            assert rec4.get("success") == 1, rec4
        print("code-loop self-check ok")
        import io
        with tempfile.TemporaryDirectory() as td:
            note_cwd = Path(td)
            captured = io.StringIO()
            old_out = sys.stdout
            sys.stdout = captured
            try:
                assert main(["note", "--cwd", str(note_cwd), "--key", "1", "--name", "sample-a", "--vals", "0.4,0.4"]) == 0
                assert main(["note", "--cwd", str(note_cwd), "--key", "2", "--name", "sample-b", "--vals", "0.9,0.1"]) == 0
                assert main(["note", "--cwd", str(note_cwd), "--key", "3", "--name", "sample-c", "--vals", "0.41,0.39"]) == 0
                last = json.loads(captured.getvalue().strip().splitlines()[-1])
            finally:
                sys.stdout = old_out
            assert last.get("outlier") == "sample-b", last
            assert last.get("ok") is True
        print("note self-check ok")
        ui = {
            "inventoryObjects": [{"uuid": 7, "name": "brass key"}],
            "accessibleEnvironmentObjects": [{"uuid": 8, "name": "oak door"}],
        }
        captured = io.StringIO()
        old_out = sys.stdout
        sys.stdout = captured
        try:
            assert main([
                "prepare-action",
                "--ui-json",
                json.dumps(ui),
                "--action-json",
                json.dumps({"action": "USE", "arg1": 7}),
            ]) == 0
        finally:
            sys.stdout = old_out
        prepared = json.loads(captured.getvalue().strip().splitlines()[-1])
        assert prepared["action"]["action"] == "OPEN", prepared
        print("prepare-action self-check ok")
        return 0
    if cmd == "run-program":
        from code_loop import main as run_main
        return run_main(argv[1:])
    if cmd == "note":
        from measurement import oldest_key, outlier_name, record_measure
        import argparse

        p = argparse.ArgumentParser(prog="science-note")
        p.add_argument("--cwd", required=True)
        p.add_argument("--key", required=True)
        p.add_argument("--name", default="")
        p.add_argument("--text", default="")
        p.add_argument("--vals", default="")
        a = p.parse_args(argv[1:])
        path = Path(a.cwd) / ".pi" / "research" / "measurements.jsonl"
        path.parent.mkdir(parents=True, exist_ok=True)
        mem: dict = {"measures": {}}
        if path.exists():
            for line in path.read_text(encoding="utf-8").splitlines():
                if not line.strip():
                    continue
                rec = json.loads(line)
                record_measure(
                    mem,
                    key=str(rec.get("key") or ""),
                    name=str(rec.get("name") or ""),
                    text=str(rec.get("text") or ""),
                    vals=rec.get("vals"),
                )
        vals = [float(x) for x in a.vals.replace(",", " ").split() if x]
        recorded = record_measure(
            mem,
            key=a.key,
            name=a.name,
            text=a.text,
            vals=vals or None,
        )
        row = {"key": a.key, **recorded}
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")
        json.dump(
            {
                "ok": True,
                "path": str(path),
                "recorded": row,
                "oldest": oldest_key(mem),
                "outlier": outlier_name(mem),
                "contaminated": mem.get("contaminated_uuid"),
            },
            sys.stdout,
            ensure_ascii=False,
        )
        sys.stdout.write("\n")
        return 0
    if cmd == "prepare-action":
        from dw_session import fill_use
        import argparse

        p = argparse.ArgumentParser(prog="science-prepare-action")
        p.add_argument("--ui-json", required=True)
        p.add_argument("--action-json", required=True)
        a = p.parse_args(argv[1:])
        ui = json.loads(a.ui_json)
        action = json.loads(a.action_json)
        prepared = fill_use(action, ui)
        json.dump({"ok": True, "action": prepared}, sys.stdout, ensure_ascii=False)
        sys.stdout.write("\n")
        return 0
    if cmd == "dw-self-check":
        from dw_session import self_check
        self_check()
        return 0
    sys.stderr.write(f"unknown command: {cmd}\n")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
