"""
Shared utilities for agentinc scripts.
"""

import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional


def find_project_root() -> Path:
    """.git 디렉토리가 존재하는 폴더를 만날 때까지 위로 이동하여 프로젝트 루트를 반환."""
    current = Path(__file__).resolve().parent
    while current != current.parent:
        if (current / ".git").exists():
            return current
        current = current.parent
    raise RuntimeError("Could not find project root (no .git directory found)")


def resolve_claude_bin() -> str:
    """실행할 claude CLI 바이너리 경로를 해석한다 (CLAUDE_BIN 환경변수가 최우선).

    Windows: `shutil.which("claude")` 는 npm 배치 shim `claude.CMD` 를 돌려준다.
    이 shim 은 내부적으로 cmd.exe `%*` 로 인자를 재파싱하는데, 여러 줄 프롬프트를
    argv 로 넘기면 **첫 줄 이후가 잘린다**(헤드리스 세션이 작업 본문을 못 받음).
    그래서 shim 이 감싸는 실제 `claude.exe` 를 직접 가리켜 cmd.exe 를 우회한다.
    macOS/Linux: `which` 가 셸 shim/바이너리를 직접 주며 여러 줄 argv 도 문제없다.
    """
    override = os.environ.get("CLAUDE_BIN")
    if override:
        return override
    found = shutil.which("claude")
    if found and found.lower().endswith(".cmd"):
        exe = (Path(found).resolve().parent
               / "node_modules" / "@anthropic-ai" / "claude-code" / "bin" / "claude.exe")
        if exe.exists():
            return str(exe)
    return found or "claude"


# ---------------------------------------------------------------------------
# GitHub environment utilities
# ---------------------------------------------------------------------------

_gh_cache: dict = {"gh_user": None, "token": None, "name": None, "email": None, "expires_at": 0}


def resolve_gh_env(gh_user: Optional[str]) -> dict[str, str]:
    """Resolve GitHub profile for gh_user and return environment variables.

    Args:
        gh_user: gh CLI에 등록된 GitHub 계정명. None이면 빈 dict 반환.

    Returns:
        GH_TOKEN, GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL, GIT_COMMITTER_NAME, GIT_COMMITTER_EMAIL을 포함한 dict.
        gh_user가 None이면 빈 dict.
    """
    if gh_user is None:
        return {}

    global _gh_cache

    # Check cache
    if (
        _gh_cache["gh_user"] == gh_user
        and time.time() < _gh_cache["expires_at"]
    ):
        return {
            "GH_TOKEN": _gh_cache["token"],
            "GIT_AUTHOR_NAME": _gh_cache["name"],
            "GIT_AUTHOR_EMAIL": _gh_cache["email"],
            "GIT_COMMITTER_NAME": _gh_cache["name"],
            "GIT_COMMITTER_EMAIL": _gh_cache["email"],
        }

    # Cache miss: resolve token
    result = subprocess.run(
        ["gh", "auth", "token", "--user", gh_user],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"ERROR: gh auth token failed for user '{gh_user}'. Run 'gh auth login' first.")
        sys.exit(1)
    token = result.stdout.strip()

    # Resolve name
    result = subprocess.run(
        ["gh", "api", "/user", "--jq", ".name"],
        env={**os.environ, "GH_TOKEN": token},
        capture_output=True,
        text=True,
    )
    name = result.stdout.strip() if result.returncode == 0 else ""

    # Resolve email
    result = subprocess.run(
        ["gh", "api", "/user", "--jq", ".email"],
        env={**os.environ, "GH_TOKEN": token},
        capture_output=True,
        text=True,
    )
    email = result.stdout.strip() if result.returncode == 0 else ""

    # Update cache
    _gh_cache.update(
        gh_user=gh_user,
        token=token,
        name=name,
        email=email,
        expires_at=time.time() + 900,
    )

    return {
        "GH_TOKEN": token,
        "GIT_AUTHOR_NAME": name,
        "GIT_AUTHOR_EMAIL": email,
        "GIT_COMMITTER_NAME": name,
        "GIT_COMMITTER_EMAIL": email,
    }
