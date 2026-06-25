#!/usr/bin/env python3
"""Resume harness iteration 3 from build step (ideation+commit already done)."""
import importlib.util
import sys
from pathlib import Path

scripts_dir = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("run_server", scripts_dir / "run-server.py")
mod = importlib.util.module_from_spec(spec)
sys.modules["run_server"] = mod
spec.loader.exec_module(mod)

ROOT = mod.ROOT
ITERATIONS_DIR = mod.ITERATIONS_DIR

iter_dir = ITERATIONS_DIR / "3-20260625_200034"
iter_id = "3-20260625_200034"
requirement_path = iter_dir / "requirement.md"
report_path = iter_dir / "check-report.json"

# previous iteration for progress comparison
prev_iter = ITERATIONS_DIR / "1-20260624_130645"

print(f"[resume] build step for iter {iter_id}")
pre_build_head = mod.git_head()
rc = mod.run_claude(
    mod.build_prompt(requirement_path),
    iter_dir / "build.log",
    mod.TIMEOUT_BUILD_SEC,
)
print(f"[resume] build done, exit={rc}")

print(f"[resume] check step")
pre_head = mod.git_head()
mod.run_claude(
    mod.check_prompt(iter_dir, iter_id, report_path, prev_iter),
    iter_dir / "check.log",
    mod.TIMEOUT_CHECK_SEC,
)

ok, with_m, without_m = mod.verify_marker(pre_head, f"iter-id: {iter_id}")
print(f"[resume] check marker ok={ok}, commits={len(with_m)+len(without_m)}")

status = mod.read_check_status(report_path)
print(f"[resume] check status={status}")

if status == "fail":
    print(f"[resume] rolling back to {pre_build_head[:10]}")
    mod.run_claude(
        mod.rollback_prompt(iter_dir, iter_id, pre_build_head),
        iter_dir / "rollback.log",
        mod.TIMEOUT_ROLLBACK_SEC,
    )
    print("[resume] rollback done")
    sys.exit(1)

print("[resume] iteration 3 complete")
