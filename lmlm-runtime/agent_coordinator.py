"""Policy-bound task routing for LMLM.

This module selects specialist perspectives and produces a plan. It does not
invoke tools, execute code, or grant browser/OS capabilities.
"""
from __future__ import annotations

from typing import Any


AGENTS: dict[str, dict[str, str]] = {
    "research": {
        "description": "Evidence gathering, source quality, synthesis, and uncertainty.",
        "instruction": "Identify claims requiring evidence, source-quality checks, and open questions.",
    },
    "engineering": {
        "description": "Software architecture, implementation, debugging, and tests.",
        "instruction": "Break engineering work into small verifiable changes with tests and rollback considerations.",
    },
    "security": {
        "description": "Threat modeling, privacy, permissions, and abuse prevention.",
        "instruction": "Identify trust boundaries, attack surfaces, data exposure, and least-privilege controls.",
    },
    "productivity": {
        "description": "Planning, writing, organization, and practical workflows.",
        "instruction": "Convert the request into an ordered, achievable workflow with clear deliverables.",
    },
}


def route_task(task: str) -> dict[str, Any]:
    text = task.casefold()
    selected: list[str] = []
    groups = {
        "engineering": ("code", "build", "implement", "debug", "test", "architecture", "api", "runtime"),
        "security": ("security", "privacy", "permission", "threat", "vulnerability", "secret", "auth"),
        "research": ("research", "compare", "evidence", "source", "latest", "investigate", "summarize"),
        "productivity": ("plan", "write", "organize", "workflow", "schedule", "draft"),
    }
    for name, keywords in groups.items():
        if any(keyword in text for keyword in keywords):
            selected.append(name)
    if not selected:
        selected = ["productivity"]
    if "security" not in selected:
        selected.append("security")
    return {
        "task": task[:4000],
        "coordinator": "lmlm",
        "selected_agents": [
            {
                "id": name,
                "description": AGENTS[name]["description"],
                "instruction": AGENTS[name]["instruction"],
            }
            for name in selected
        ],
        "execution_mode": "plan_only",
        "requires_user_approval_for_actions": True,
        "tools_invoked": [],
    }
