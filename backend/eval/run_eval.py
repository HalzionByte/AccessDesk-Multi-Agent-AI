"""Run the labelled Task 5 complaint set in mock or explicitly configured live mode."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Literal, cast

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.agents.intake import run_intake_agent
from app.agents.policy_agent import run_policy_agent
from app.config import Settings
from app.schemas import (
    EvaluationComplaint,
    IntakeResult,
    MissingRequirement,
    PreferredLanguage,
)
from app.services.policy import search_policy

CORPUS = Path(__file__).with_name("complaints.jsonl")


def _has_image_statement(text: str) -> bool:
    lowered = text.lower()
    positive = any(word in lowered for word in ("photo", "picture", "tasveer"))
    negative = any(
        phrase in lowered
        for phrase in ("no photo", "photo nahi", "without a photo")
    )
    return positive and not negative


def _derived_missing(result: IntakeResult, text: str) -> set[MissingRequirement]:
    missing: set[MissingRequirement] = set()
    if result.order_id is None:
        missing.add(MissingRequirement.ORDER)
    if result.issue_type is None:
        missing.add(MissingRequirement.ISSUE_TYPE)
    if result.description is None or len(result.description.strip()) < 10:
        missing.add(MissingRequirement.DESCRIPTION)
    if not _has_image_statement(text):
        missing.add(MissingRequirement.IMAGE)
    if result.resolution != "replacement":
        missing.add(MissingRequirement.REQUESTED_RESOLUTION)
    return missing


def run(mode: str) -> dict[str, object]:
    settings = Settings(llm_mode=cast(Literal["mock", "live"], mode))
    rows = [
        EvaluationComplaint.model_validate_json(line)
        for line in CORPUS.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    extraction_correct = 0
    missing_correct = 0
    citations_valid = 0
    details: list[dict[str, object]] = []
    for row in rows:
        known = [row.expected_order_id] if row.expected_order_id else []
        intake = run_intake_agent(
            settings,
            row.complaint,
            known_order_ids=known,
        )
        extracted_ok = (
            intake.order_id == row.expected_order_id
            and intake.issue_type == row.expected_issue_type
        )
        actual_missing = _derived_missing(intake, row.complaint)
        missing_ok = actual_missing == set(row.expected_missing)
        passages = search_policy(row.complaint, k=5)
        language = (
            PreferredLanguage.ROMAN_URDU
            if row.language.value != "en"
            else PreferredLanguage.ENGLISH
        )
        policy = run_policy_agent(
            settings,
            row.complaint,
            language=language,
            passages=passages,
        )
        allowed = {item.id for item in passages}
        citation_ok = set(policy.citation_ids).issubset(allowed)
        extraction_correct += int(extracted_ok)
        missing_correct += int(missing_ok)
        citations_valid += int(citation_ok)
        details.append(
            {
                "id": row.id,
                "extractionCorrect": extracted_ok,
                "missingCorrect": missing_ok,
                "citationsValid": citation_ok,
            }
        )
    count = len(rows)
    return {
        "mode": mode,
        "model": settings.groq_model,
        "complaints": count,
        "extractionAccuracy": extraction_correct / count,
        "missingItemAccuracy": missing_correct / count,
        "citationValidity": citations_valid / count,
        "details": details,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("mock", "live"), default="mock")
    args = parser.parse_args()
    print(json.dumps(run(args.mode), indent=2))


if __name__ == "__main__":
    main()
