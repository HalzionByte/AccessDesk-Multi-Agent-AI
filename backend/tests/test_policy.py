from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

import pytest

from app.schemas import EvaluationComplaint
from app.services.policy import load_policy_sections, search_policy

EVAL_PATH = Path(__file__).resolve().parents[1] / "eval" / "complaints.jsonl"


def test_policy_contains_exactly_the_eight_fictional_sections():
    sections = load_policy_sections()

    assert [section.id for section in sections] == [
        "P-1",
        "P-2",
        "P-3",
        "P-4",
        "P-5",
        "P-6",
        "P-7",
        "P-8",
    ]
    assert all(section.title and section.text for section in sections)


def test_search_returns_relevant_english_policy_passages():
    results = search_policy("damaged item photo replacement", k=3)

    assert results
    assert "P-1" in {result.id for result in results}
    assert "P-3" in {result.id for result in results}


def test_search_supports_roman_urdu_keywords():
    photo_results = search_policy("kharab product ki tasveer saboot", k=3)
    late_results = search_policy("saat din ke baad der se request", k=3)

    assert "P-3" in {result.id for result in photo_results}
    assert "P-7" in {result.id for result in late_results}


def test_search_handles_empty_queries_and_result_limits():
    assert search_policy("", k=3) == []
    assert search_policy("damage", k=0) == []
    assert len(search_policy("damage photo replacement", k=2)) <= 2

    with pytest.raises(TypeError, match="k must be an integer"):
        search_policy("damage", k=True)


def test_evaluation_corpus_validates_against_shared_schema():
    records = [
        EvaluationComplaint.model_validate(json.loads(line))
        for line in EVAL_PATH.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    policy_ids = {section.id for section in load_policy_sections()}

    assert len(records) == 15
    assert len({record.id for record in records}) == 15
    assert Counter(record.language.value for record in records) == {
        "en": 6,
        "roman-urdu": 6,
        "mixed": 3,
    }
    assert all(set(record.expected_policy_ids) <= policy_ids for record in records)
