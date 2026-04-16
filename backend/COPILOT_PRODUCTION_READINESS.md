# Copilot Production Readiness Checklist

## Architecture Contract
- [ ] Planner-first flow is active (`understand -> plan tool calls -> execute tools -> generate reply`).
- [ ] Hardcoded intent-switch path is disabled in production.
- [ ] Tool-call schema validation is enforced before execution.
- [ ] Tool registry is limited to coordinator-safe capabilities only.

## Data Access and Security
- [ ] Copilot reads via centralized `CoordinatorReadLayer` only.
- [ ] Per-tool auth guard validates role and scope before execution.
- [ ] NGO scoping is validated for every tool invocation.
- [ ] Prompt has no direct unrestricted database instructions.

## Reliability and Performance
- [ ] Gemini retries with backoff+jitter are enabled.
- [ ] Request coalescing for repeated queries is enabled.
- [ ] Response cache for repeated asks is enabled.
- [ ] Voice burst coalescing is enabled.
- [ ] Graceful degradation fallback is validated for provider outage.

## Voice and UX
- [ ] Greeting speech on session open is enabled.
- [ ] Interrupt triggers backend cancellation endpoint.
- [ ] Mute controls listening only.
- [ ] Speaker controls output only.
- [ ] Silence-based end-of-query timing is tuned for field usage.

## Quality Gates
- [ ] In-scope E2E scenarios pass.
- [ ] Out-of-scope redirection scenarios pass.
- [ ] Ambiguous query clarification scenarios pass.
- [ ] Crisis tone scenarios pass.
- [ ] Responses are grounded to tool outputs with no fabricated metrics.
- [ ] No hardcoded leakage in normal responses.

## Rollout Flags
- [ ] `COPILOT_PLANNER_ENABLED=true`
- [ ] `COPILOT_CACHE_ENABLED=true`
- [ ] `COPILOT_CACHE_TTL_SECONDS=45` (or tuned value)
- [ ] `COPILOT_VOICE_COALESCE_ENABLED=true`
- [ ] `COPILOT_VOICE_BURST_WINDOW_MS=850` (or tuned value)
