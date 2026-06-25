#!/usr/bin/env python3
"""One-shot wrapper: run exactly one harness iteration and exit."""
import importlib.util
import sys
from pathlib import Path

scripts_dir = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("run_server", scripts_dir / "run-server.py")
mod = importlib.util.module_from_spec(spec)
sys.modules["run_server"] = mod
spec.loader.exec_module(mod)

mod.ITERATIONS_DIR.mkdir(parents=True, exist_ok=True)
n = mod.next_iteration_number()
print(f"[one-shot] starting iteration {n}")
mod.run_iteration(n)
print(f"[one-shot] iteration {n} done")
