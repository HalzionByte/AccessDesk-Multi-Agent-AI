"""Deterministic BM25 retrieval over the local fictional policy."""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

from rank_bm25 import BM25Okapi

from app.schemas import PolicyCitation

POLICY_PATH = Path(__file__).resolve().parents[1] / "data" / "policy.md"
SECTION_PATTERN = re.compile(r"^## (P-[1-8]): (.+)$", re.MULTILINE)
TOKEN_PATTERN = re.compile(r"[a-z0-9]+")
MAX_QUERY_TOKENS = 200

TERM_GROUPS: tuple[frozenset[str], ...] = (
    frozenset(
        {
            "damage",
            "damaged",
            "broken",
            "crack",
            "cracked",
            "kharab",
            "toota",
            "tooti",
            "replacement",
            "replace",
            "badalna",
        }
    ),
    frozenset({"7", "seven", "saat", "day", "days", "din", "window"}),
    frozenset({"photo", "picture", "image", "tasveer", "tasvir", "saboot"}),
    frozenset({"packaging", "packing", "package", "box", "dabba"}),
    frozenset({"delivered", "delivery", "deliver", "mila", "pohncha"}),
    frozenset({"duplicate", "existing", "again", "dobara", "same", "active"}),
    frozenset({"late", "outside", "expired", "der", "old"}),
    frozenset({"staff", "review", "approve", "decision", "faisla", "manzoori"}),
)


def _tokenize(value: str) -> list[str]:
    return TOKEN_PATTERN.findall(value.casefold())


def _expanded_query(value: str) -> list[str]:
    original = _tokenize(value)[:MAX_QUERY_TOKENS]
    expanded = list(original)
    seen = set(original)
    for token in original:
        for group in TERM_GROUPS:
            if token not in group:
                continue
            for related in group:
                if related not in seen:
                    expanded.append(related)
                    seen.add(related)
    return expanded


@lru_cache(maxsize=1)
def load_policy_sections() -> tuple[PolicyCitation, ...]:
    """Parse the versioned policy document and fail closed if it is malformed."""

    content = POLICY_PATH.read_text(encoding="utf-8")
    matches = list(SECTION_PATTERN.finditer(content))
    sections: list[PolicyCitation] = []
    for index, match in enumerate(matches):
        body_start = match.end()
        body_end = (
            matches[index + 1].start() if index + 1 < len(matches) else len(content)
        )
        body = " ".join(content[body_start:body_end].strip().split())
        sections.append(
            PolicyCitation(id=match.group(1), title=match.group(2), text=body)
        )

    expected_ids = [f"P-{number}" for number in range(1, 9)]
    if [section.id for section in sections] != expected_ids:
        raise RuntimeError("The policy must contain ordered sections P-1 through P-8.")
    return tuple(sections)


@lru_cache(maxsize=1)
def _policy_index() -> tuple[BM25Okapi, tuple[PolicyCitation, ...]]:
    sections = load_policy_sections()
    corpus = [
        _tokenize(f"{section.id} {section.title} {section.text}")
        for section in sections
    ]
    return BM25Okapi(corpus), sections


def search_policy(query: str, k: int = 3) -> list[PolicyCitation]:
    """Return up to ``k`` relevant policy passages in deterministic score order."""

    if isinstance(k, bool) or not isinstance(k, int):
        raise TypeError("k must be an integer.")
    if k <= 0:
        return []
    query_tokens = _expanded_query(query)
    if not query_tokens:
        return []

    index, sections = _policy_index()
    scores = index.get_scores(query_tokens)
    ranked = sorted(
        enumerate(scores),
        key=lambda item: (-float(item[1]), item[0]),
    )
    return [sections[index] for index, score in ranked if score > 0][: min(k, 8)]
