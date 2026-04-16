from __future__ import annotations

import json
import random
import time
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, ValidationError, model_validator

from core.gemini import GEMINI_FLASH, client


class _FirestoreAwareJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder that handles Firestore DatetimeWithNanoseconds and other non-serializable types."""

    def default(self, o: Any) -> Any:
        # Handle Firestore DatetimeWithNanoseconds
        if hasattr(o, "rfc3339") or type(o).__name__ == "DatetimeWithNanoseconds":
            return o.isoformat() if hasattr(o, "isoformat") else str(o)
        # Handle other datetime objects
        if isinstance(o, datetime):
            return o.isoformat()
        # Handle any other objects with __dict__ by converting to str
        if hasattr(o, "__dict__"):
            return str(o)
        return super().default(o)

ALLOWED_TOOLS = {
    "dashboard",
    "insights",
    "zones",
    "terrain",
    "missions",
    "volunteers",
    "alerts",
    "inventory",
    "collaboration",
    "settings",
}

HEURISTIC_KEYWORDS: list[tuple[str, list[str]]] = [
    ("dashboard", ["dashboard", "summary", "overview", "metrics", "stats"]),
    ("insights", ["insight", "insights", "gemini insight", "gemini insights", "latest insight"]),
    ("zones", ["zone", "zones", "risk zone", "high risk", "high-risk", "risky"]),
    ("terrain", ["terrain", "map", "heatmap"]),
    ("missions", ["mission", "missions", "dispatch", "assign"]),
    ("volunteers", ["volunteer", "volunteers", "fieldworker", "responder", "coverage"]),
    ("alerts", ["alert", "alerts", "drift", "escalat", "critical"]),
    ("inventory", ["inventory", "warehouse", "stock", "supplies"]),
    ("collaboration", ["collaboration", "partner", "partnership"]),
    ("settings", ["settings", "profile", "organization", "org"]),
]

COPILOT_SYSTEM_PROMPT = """
You are Nexus Copilot for NGO coordinators.

You are an AI planner first:
- Understand user query.
- Choose tools in order.
- Use tool outputs as grounded context.
- Produce natural, professional, human-like responses.

Scope and boundaries:
- In scope: dashboard, insights, zones, terrain, missions, volunteers, alerts, inventory, collaboration, settings.
- Out of scope: politely explain boundary and offer in-scope alternatives.
- Never fabricate metrics or actions.
- If context is ambiguous, ask one concise clarification question.

Tone policy:
- Calm, concise, collaborator tone.
- Crisis/urgent requests should sound direct and reassuring.
- No markdown tables, no JSON in user-facing responses.

Special behaviors:
- Greeting on open should be warm and brief.
- Clarifications should be one question only.
- Suggestions must be contextual and actionable.
""".strip()


class ToolCall(BaseModel):
    tool: Literal["dashboard", "insights", "zones", "terrain", "missions", "volunteers", "alerts", "inventory", "collaboration", "settings"]
    args: dict[str, Any] = Field(default_factory=dict)
    reason: str = ""


class CopilotPlan(BaseModel):
    plan_summary: str = ""
    requires_clarification: bool = False
    clarification_question: str = ""
    out_of_scope: bool = False
    tool_calls: list[ToolCall] = Field(default_factory=list)

    @model_validator(mode="after")
    def _validate_plan(self) -> "CopilotPlan":
        if self.requires_clarification and not self.clarification_question.strip():
            self.clarification_question = "Could you clarify what you want me to prioritize first?"
        if len(self.tool_calls) > 4:
            self.tool_calls = self.tool_calls[:4]
        return self


class CopilotReply(BaseModel):
    response_text: str
    suggestions: list[str] = Field(default_factory=list)


class PlannerResult(BaseModel):
    plan: CopilotPlan
    raw_text: str = ""
    degraded: bool = False


class RetryPolicy(BaseModel):
    retries: int = 1  # Reduced from 2 to avoid hammering rate-limited API
    base_sleep: float = 1.5  # Increased from 0.35 to be more respectful of rate limits


def _extract_json_block(text: str) -> dict[str, Any] | None:
    cleaned = str(text or "").strip()
    if not cleaned:
        return None
    if cleaned.startswith("```"):
        cleaned = cleaned.replace("```json", "").replace("```JSON", "").strip("`").strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        return json.loads(cleaned[start : end + 1])
    except Exception:
        return None


def generate_text_with_retry(prompt: str, retry_policy: RetryPolicy | None = None) -> str:
    policy = retry_policy or RetryPolicy()
    for attempt in range(policy.retries + 1):
        try:
            response = client.models.generate_content(
                model=GEMINI_FLASH,
                contents=[{"role": "user", "parts": [{"text": prompt}]}],
            )
            return " ".join(str(getattr(response, "text", "") or "").split()).strip()
        except Exception as exc:
            if attempt >= policy.retries:
                return ""
            # Detect rate-limit or service errors that warrant backing off longer
            is_rate_limited = "429" in str(exc) or "Too Many Requests" in str(exc)
            is_service_error = "503" in str(exc) or "unavailable" in str(exc).lower()
            
            if is_rate_limited or is_service_error:
                # Back off much longer for rate limits and service errors
                jitter = random.uniform(0.5, 1.5)
                sleep_for = (policy.base_sleep * (3**attempt)) + jitter  # Cubic backoff for errors
            else:
                # Normal exponential backoff for transient errors
                jitter = random.uniform(0.1, 0.3)
                sleep_for = (policy.base_sleep * (2**attempt)) + jitter
            
            time.sleep(sleep_for)
    return ""


def build_planner_prompt(query: str, memory: list[dict[str, str]], now_iso: str) -> str:
    short_memory = memory[-6:]
    memory_block = "\n".join([f"- user: {turn.get('query','')} | copilot: {turn.get('response','')}" for turn in short_memory])
    return f"""
{COPILOT_SYSTEM_PROMPT}

Current UTC time: {now_iso}
Conversation memory:
{memory_block or '- none'}

Return JSON only with this schema:
{{
  "plan_summary": "short internal summary",
  "requires_clarification": false,
  "clarification_question": "",
  "out_of_scope": false,
  "tool_calls": [
    {{ "tool": "dashboard|insights|zones|terrain|missions|volunteers|alerts|inventory|collaboration|settings", "args": {{}}, "reason": "why" }}
  ]
}}

Rules:
- Use only tools in allowed list.
- Max 4 tool calls.
- If unclear and not out_of_scope, set requires_clarification true and no tool calls.
- If out_of_scope, set out_of_scope true and no tool calls.
- Prefer precise, minimal tool sequence.

User query: {query}
""".strip()


def build_reply_prompt(
    query: str,
    plan: CopilotPlan,
    grounded_context: dict[str, Any],
    memory: list[dict[str, str]],
    fallback_suggestions: list[str],
) -> str:
    memory_block = "\n".join([f"- user: {turn.get('query','')} | copilot: {turn.get('response','')}" for turn in memory[-6:]])
    return f"""
{COPILOT_SYSTEM_PROMPT}

Use grounded context only.

Query: {query}
Plan summary: {plan.plan_summary}
Out of scope: {plan.out_of_scope}
Needs clarification: {plan.requires_clarification}
Clarification question: {plan.clarification_question}
Grounded context JSON: {json.dumps(grounded_context, cls=_FirestoreAwareJSONEncoder, ensure_ascii=True)}
Recent memory:
{memory_block or '- none'}

Return JSON only:
{{
  "response_text": "human response",
  "suggestions": ["short suggestion", "short suggestion", "short suggestion"]
}}

Suggestion rules:
- suggestions must be concise action requests and in-scope only
- keep 3 to 5 items
- prefer contextual suggestions from grounded context
- if out of scope, suggestions must redirect to in-scope operations like {', '.join(fallback_suggestions)}
""".strip()


def _heuristic_plan(query: str) -> CopilotPlan:
    normalized = " ".join(str(query or "").lower().split())
    matched_tools: list[str] = []

    for tool_name, keywords in HEURISTIC_KEYWORDS:
        if any(keyword in normalized for keyword in keywords):
            matched_tools.append(tool_name)

    if not matched_tools:
        return CopilotPlan(
            plan_summary="No reliable in-scope match from heuristic router",
            requires_clarification=False,
            out_of_scope=True,
            tool_calls=[],
        )

    tool_calls: list[ToolCall] = []
    for tool_name in matched_tools[:4]:
        args: dict[str, Any] = {}
        if tool_name in {"zones", "terrain"} and any(term in normalized for term in ["high risk", "high-risk", "risky", "critical"]):
            args["risk_filter"] = "high-risk"
        if tool_name == "insights" and any(word in normalized for word in ["latest", "recent", "insight", "gemini"]):
            args["limit"] = 8
        if tool_name == "missions":
            if "active" in normalized or "ongoing" in normalized:
                args["status"] = "dispatched"
        if tool_name == "volunteers":
            if "available" in normalized:
                args["search"] = "available"
        if tool_name == "alerts":
            if any(word in normalized for word in ["critical", "urgent", "severe"]):
                args["severity"] = "critical"
        tool_calls.append(ToolCall(tool=tool_name, args=args, reason="heuristic in-scope routing"))

    if "show" in normalized or "open" in normalized or "give" in normalized or "display" in normalized:
        summary = f"Heuristic route for {', '.join(matched_tools[:3])}"
    else:
        summary = f"Heuristic in-scope route for {', '.join(matched_tools[:3])}"

    return CopilotPlan(plan_summary=summary, tool_calls=tool_calls, out_of_scope=False)


def generate_plan(query: str, memory: list[dict[str, str]]) -> PlannerResult:
    now_iso = datetime.utcnow().isoformat()
    prompt = build_planner_prompt(query=query, memory=memory, now_iso=now_iso)
    raw = generate_text_with_retry(prompt)
    parsed = _extract_json_block(raw)
    if not parsed:
        fallback = _heuristic_plan(query)
        return PlannerResult(plan=fallback, raw_text=raw, degraded=True)

    try:
        plan = CopilotPlan.model_validate(parsed)
        plan.tool_calls = [call for call in plan.tool_calls if call.tool in ALLOWED_TOOLS]

        heuristic = _heuristic_plan(query)
        if heuristic.tool_calls and (plan.out_of_scope or not plan.tool_calls):
            # Prefer a deterministic in-scope route when the model rejects an obviously in-scope request.
            if not plan.requires_clarification:
                plan = heuristic

        if plan.out_of_scope and heuristic.tool_calls:
            plan = heuristic

        if not plan.out_of_scope and not plan.tool_calls:
            plan = heuristic if heuristic.tool_calls else plan

        return PlannerResult(plan=plan, raw_text=raw, degraded=False)
    except ValidationError:
        fallback = _heuristic_plan(query)
        return PlannerResult(plan=fallback, raw_text=raw, degraded=True)


def generate_reply(
    query: str,
    plan: CopilotPlan,
    grounded_context: dict[str, Any],
    memory: list[dict[str, str]],
    fallback_suggestions: list[str],
) -> CopilotReply:
    prompt = build_reply_prompt(
        query=query,
        plan=plan,
        grounded_context=grounded_context,
        memory=memory,
        fallback_suggestions=fallback_suggestions,
    )
    raw = generate_text_with_retry(prompt)
    parsed = _extract_json_block(raw)
    if not parsed:
        if plan.requires_clarification and plan.clarification_question:
            return CopilotReply(response_text=plan.clarification_question, suggestions=fallback_suggestions[:3])
        if plan.out_of_scope:
            return CopilotReply(
                response_text="I can only help with NGO coordinator operations in this workspace right now. I can still help quickly if you choose one of the in-scope options.",
                suggestions=fallback_suggestions[:3],
            )
        return CopilotReply(
            response_text="The AI provider is temporarily unavailable. Please retry in a moment.",
            suggestions=fallback_suggestions[:3],
        )

    try:
        reply = CopilotReply.model_validate(parsed)
        if not reply.suggestions:
            reply.suggestions = fallback_suggestions[:3]
        if len(reply.suggestions) > 6:
            reply.suggestions = reply.suggestions[:6]
        return reply
    except ValidationError:
        return CopilotReply(
            response_text="The AI provider is temporarily unavailable. Please retry in a moment.",
            suggestions=fallback_suggestions[:3],
        )
