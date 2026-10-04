"""Run Firestore transactions with retries or the test adapter equivalent."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, TypeVar

from google.cloud.firestore_v1.transaction import transactional

T = TypeVar("T")


def run_transaction(database: Any, operation: Callable[[Any], T]) -> T:
    adapter_runner = getattr(database, "run_transaction", None)
    if adapter_runner is not None:
        return adapter_runner(operation)
    return transactional(operation)(database.transaction())
