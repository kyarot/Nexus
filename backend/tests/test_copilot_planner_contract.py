from __future__ import annotations

from services import copilot_planner


def test_generate_plan_schema_valid(monkeypatch):
    raw = (
        '{"plan_summary":"zone risk",'
        '"requires_clarification":false,'
        '"clarification_question":"",'
        '"out_of_scope":false,'
        '"tool_calls":[{"tool":"zones","args":{"risk_filter":"high-risk"},"reason":"risk"}]}'
    )
    monkeypatch.setattr(copilot_planner, "generate_text_with_retry", lambda *_args, **_kwargs: raw)

    result = copilot_planner.generate_plan("show high risk zones", memory=[])

    assert result.degraded is False
    assert result.plan.out_of_scope is False
    assert len(result.plan.tool_calls) == 1
    assert result.plan.tool_calls[0].tool == "zones"


def test_generate_plan_invalid_json_degrades(monkeypatch):
    monkeypatch.setattr(copilot_planner, "generate_text_with_retry", lambda *_args, **_kwargs: "not-json")

    result = copilot_planner.generate_plan("hello", memory=[])

    assert result.degraded is True
    assert result.plan.out_of_scope is True
    assert result.plan.tool_calls == []


def test_generate_reply_uses_fallback_suggestions(monkeypatch):
    raw = '{"response_text":"Here is the status.","suggestions":[]}'
    monkeypatch.setattr(copilot_planner, "generate_text_with_retry", lambda *_args, **_kwargs: raw)

    plan = copilot_planner.CopilotPlan(plan_summary="status", out_of_scope=False, tool_calls=[])
    reply = copilot_planner.generate_reply(
        query="show status",
        plan=plan,
        grounded_context={"dashboard": {"avgScore": 64}},
        memory=[],
        fallback_suggestions=["Show dashboard summary", "Show high-risk zones", "Show missions"],
    )

    assert reply.response_text
    assert len(reply.suggestions) >= 1


def test_generate_plan_overrides_false_out_of_scope_for_insights(monkeypatch):
    bad = '{"plan_summary":"nope","requires_clarification":false,"clarification_question":"","out_of_scope":true,"tool_calls":[]}'
    monkeypatch.setattr(copilot_planner, "generate_text_with_retry", lambda *_args, **_kwargs: bad)

    result = copilot_planner.generate_plan("show me Gemini insights", memory=[])

    assert result.plan.out_of_scope is False
    assert any(call.tool == "insights" for call in result.plan.tool_calls)
