import asyncio
from types import SimpleNamespace
from datetime import datetime

import pytest

from app.agent.planner import (
    CopilotAgentPlanner,
    READ_ONLY_TOOL_NAME,
    UnconfiguredPlanner,
    _approve_read_only_tool,
    _verified_matching_context,
    create_default_planner,
)
from app.models.domain import Task
from app.schemas.responses import Candidate, SuggestionResult
from copilot.generated.session_events import PermissionRequestCustomTool
from copilot.session import PermissionDecisionApproveOnce, PermissionDecisionUserNotAvailable


def _task() -> Task:
    return Task(
        id="task-1",
        farm_id="farm_demo",
        title="복숭아 선별",
        start_at=datetime(2030, 1, 1, 9),
        end_at=datetime(2030, 1, 1, 12),
        required_workers=2,
        required_skills=["선별"],
    )


def _suggestions() -> SuggestionResult:
    return SuggestionResult(
        task_id="task-1",
        required_workers=2,
        active_assignments=0,
        shortage=1,
        shortage_reason="적격 후보가 한 명 부족합니다",
        candidates=[
            Candidate(
                candidate_id="worker-1",
                display_name="일손 하나",
                eligible=True,
                score=100,
                reasons=["가능 시간이 작업 전체를 포함합니다"],
            ),
            Candidate(
                candidate_id="worker-2",
                display_name="일손 둘",
                eligible=False,
                score=0,
                exclusions=["필요한 작업 유형이 없습니다"],
            ),
        ],
    )


def test_agent_context_contains_server_checked_facts_only():
    context = _verified_matching_context(_task(), _suggestions())

    assert context["shortage"] == 1
    assert context["candidates"][0]["eligible"] is True
    assert context["candidates"][1]["exclusions"] == ["필요한 작업 유형이 없습니다"]
    assert "experience" not in context["candidates"][0]
    assert "intro" not in context["candidates"][0]


def test_planner_requires_server_token_for_azure(monkeypatch):
    monkeypatch.setenv("WEBSITE_SITE_NAME", "public-demo")
    monkeypatch.delenv("COPILOT_GITHUB_TOKEN", raising=False)

    assert isinstance(create_default_planner(), UnconfiguredPlanner)


def test_planner_enables_copilot_with_server_token(monkeypatch):
    monkeypatch.setenv("WEBSITE_SITE_NAME", "public-demo")
    monkeypatch.setenv("COPILOT_GITHUB_TOKEN", "test-token")
    monkeypatch.setenv("AI_ENABLED", "true")

    assert isinstance(create_default_planner(), CopilotAgentPlanner)


def test_planner_disabled_by_default(monkeypatch):
    monkeypatch.setenv("COPILOT_GITHUB_TOKEN", "test-token")
    monkeypatch.delenv("AI_ENABLED", raising=False)

    assert isinstance(create_default_planner(), UnconfiguredPlanner)


def test_only_verified_read_only_tool_is_auto_approved():
    request = PermissionRequestCustomTool(tool_name=READ_ONLY_TOOL_NAME, tool_description="")

    assert isinstance(_approve_read_only_tool(request, None), PermissionDecisionApproveOnce)
    assert isinstance(
        _approve_read_only_tool(
            PermissionRequestCustomTool(tool_name="unexpected", tool_description=""),
            None,
        ),
        PermissionDecisionUserNotAvailable,
    )


def test_planner_uses_agent_framework_and_returns_only_eligible_ids(monkeypatch):
    class FakeAgent:
        def __init__(self, **kwargs):
            self.tool = kwargs["tools"][0]
            assert self.tool.name == READ_ONLY_TOOL_NAME
            assert kwargs["default_options"]["on_permission_request"] is _approve_read_only_tool

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_value, traceback):
            return None

        async def run(self, prompt):
            assert "JSON 문자열" in prompt
            await self.tool.invoke(arguments={})
            return SimpleNamespace(text="적격 후보와 부족 인원을 확인했습니다.")

    monkeypatch.setattr("app.agent.planner.GitHubCopilotAgent", FakeAgent)

    result = asyncio.run(CopilotAgentPlanner().plan(_task(), _suggestions(), "배치 결과를 설명해 주세요"))

    assert result.summary == "적격 후보와 부족 인원을 확인했습니다."
    assert result.referenced_worker_ids == ["worker-1"]


def test_planner_rejects_response_without_verified_tool_call(monkeypatch):
    class FakeAgent:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc_value, traceback):
            return None

        async def run(self, prompt):
            return SimpleNamespace(text="근거 없이 생성한 설명")

    monkeypatch.setattr("app.agent.planner.GitHubCopilotAgent", FakeAgent)

    with pytest.raises(ValueError, match="검증 도구를 호출하지 않았습니다"):
        asyncio.run(CopilotAgentPlanner().plan(_task(), _suggestions(), "설명"))
