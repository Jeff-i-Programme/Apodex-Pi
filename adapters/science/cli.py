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
            "  python cli.py dw-self-check\n"
        )
        return 0
    cmd = argv[0]
    if cmd == "self-check":
        from measurement import oldest_key, outlier_name, record_measure

        mem = {}
        record_measure(mem, key="1", name="echo", vals=[0.4, 0.4])
        record_measure(mem, key="2", name="vorti", vals=[0.9, 0.1])
        record_measure(mem, key="3", name="anima", vals=[0.41, 0.39])
        assert outlier_name(mem) == "vorti", outlier_name(mem)
        record_measure(mem, key="9", name="old", vals=[1200.0], text="1200 years")
        assert oldest_key(mem) == "9"
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
        print("code-loop self-check ok")
        return 0
    if cmd == "run-program":
        from code_loop import main as run_main
        return run_main(argv[1:])
    if cmd == "dw-self-check":
        from dw_session import self_check
        self_check()
        return 0
    sys.stderr.write(f"unknown command: {cmd}\n")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
