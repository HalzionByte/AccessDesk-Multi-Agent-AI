"""CrewAI execution boundary with deterministic mock mode and safe failures."""

from __future__ import annotations

import json
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, TypeVar

from fastapi import status
from pydantic import BaseModel, ValidationError

from app.config import Settings
from app.errors import AppError

ResultT = TypeVar("ResultT", bound=BaseModel)


@dataclass(frozen=True)
class AgentSpec:
    role: str
    goal: str
    backstory: str


def delimit_untrusted(label: str, value: str) -> str:
    """Wrap untrusted data without allowing it to close its own delimiter."""

    closing = f"</untrusted_{label}>"
    escaped = value.replace(closing, closing.replace("<", "&lt;"))
    return f"<untrusted_{label}>\n{escaped}\n{closing}"


def _is_retryable(exc: Exception) -> bool:
    text = f"{type(exc).__name__}: {exc}".lower()
    return any(
        marker in text
        for marker in ("rate limit", "ratelimit", "429", "timeout", "timed out")
    )


def _parse_json(raw: object) -> object:
    if isinstance(raw, BaseModel):
        return raw.model_dump(mode="json", by_alias=True)
    if isinstance(raw, dict):
        return raw
    text = str(raw).strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1]).strip()
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        raise ValueError("The model did not return a JSON object.")
    return json.loads(text[start : end + 1])


def _without_cache_breakpoints(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """CrewAI's LiteLLM fallback does not strip its Groq-unsupported marker."""

    return [
        {key: value for key, value in message.items() if key != "cache_breakpoint"}
        for message in messages
    ]


def _crewai_call(settings: Settings, spec: AgentSpec, prompt: str) -> object:
    try:
        from crewai import LLM, Agent, Crew, Process, Task
    except ImportError as exc:
        raise AppError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "llm_unavailable",
            "Live assistant dependencies are unavailable. Use mock mode or install requirements.",
        ) from exc

    if settings.groq_api_key is None:
        raise AppError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "llm_unavailable",
            "The live assistant is not configured.",
        )

    class GroqCompatibleLLM(LLM):
        def _format_messages_for_provider(
            self, messages: list[dict[str, Any]]
        ) -> list[dict[str, str]]:
            return super()._format_messages_for_provider(
                _without_cache_breakpoints(messages)
            )

    llm = GroqCompatibleLLM(
        model=settings.groq_model,
        api_key=settings.groq_api_key.get_secret_value(),
        temperature=0,
    )
    agent = Agent(
        role=spec.role,
        goal=spec.goal,
        backstory=spec.backstory,
        llm=llm,
        tools=[],
        memory=False,
        max_iter=3,
        verbose=False,
    )
    task = Task(
        description=prompt,
        expected_output="One JSON object only, matching the requested schema.",
        agent=agent,
    )
    result = Crew(
        agents=[agent],
        tasks=[task],
        process=Process.sequential,
        memory=False,
        verbose=False,
    ).kickoff()
    return getattr(result, "raw", result)


def run_structured_agent(
    settings: Settings,
    *,
    spec: AgentSpec,
    prompt: str,
    result_type: type[ResultT],
    mock_payload: dict[str, object],
    call: Callable[[Settings, AgentSpec, str], object] | None = None,
    max_attempts: int = 3,
) -> ResultT:
    """Return validated agent output or a stable application error."""

    if settings.llm_mode == "mock":
        return result_type.model_validate(mock_payload)

    invoke = call or _crewai_call
    last_error: Exception | None = None
    for attempt in range(max_attempts):
        try:
            return result_type.model_validate(
                _parse_json(invoke(settings, spec, prompt))
            )
        except AppError:
            raise
        except (ValidationError, ValueError, json.JSONDecodeError) as exc:
            raise AppError(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "llm_invalid_response",
                "The assistant returned an invalid response. Your draft is safe; please retry.",
            ) from exc
        except Exception as exc:
            last_error = exc
            if not _is_retryable(exc):
                raise AppError(
                    status.HTTP_503_SERVICE_UNAVAILABLE,
                    "llm_unavailable",
                    "The live assistant could not process this request. Please try later.",
                ) from exc
            if attempt + 1 < max_attempts:
                time.sleep(0.1 * (2**attempt))

    raise AppError(
        status.HTTP_503_SERVICE_UNAVAILABLE,
        "llm_busy",
        "The assistant is busy. Your draft is safe; please retry.",
    ) from last_error
