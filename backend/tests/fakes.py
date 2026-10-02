"""Small Firestore test double used by service and API integration tests."""

from __future__ import annotations

from copy import deepcopy
from itertools import count
from typing import Any


class FakeSnapshot:
    def __init__(self, reference: FakeDocumentReference, data: dict[str, Any] | None):
        self.reference = reference
        self.id = reference.id
        self.exists = data is not None
        self._data = data

    def to_dict(self) -> dict[str, Any] | None:
        return deepcopy(self._data)


class FakeDocumentReference:
    def __init__(self, database: FakeFirestore, path: tuple[str, ...]):
        self.database = database
        self.path = path
        self.id = path[-1]

    def get(self, transaction=None) -> FakeSnapshot:
        return FakeSnapshot(self, self.database.documents.get(self.path))

    def set(self, data: dict[str, Any], merge: bool = False) -> None:
        if merge and self.path in self.database.documents:
            self.database.documents[self.path].update(deepcopy(data))
        else:
            self.database.documents[self.path] = deepcopy(data)

    def update(self, data: dict[str, Any]) -> None:
        if self.path not in self.database.documents:
            raise KeyError(f"Document does not exist: {self.path}")
        self.database.documents[self.path].update(deepcopy(data))

    def delete(self) -> None:
        self.database.documents.pop(self.path, None)

    def collection(self, name: str) -> FakeCollection:
        return FakeCollection(self.database, (*self.path, name))


class FakeQuery:
    def __init__(
        self,
        collection: FakeCollection,
        filters: list[Any] | None = None,
        order_field: str | None = None,
    ):
        self.collection = collection
        self.filters = filters or []
        self.order_field = order_field

    def where(self, *, filter):
        return FakeQuery(self.collection, [*self.filters, filter], self.order_field)

    def order_by(self, field: str):
        return FakeQuery(self.collection, self.filters, field)

    def stream(self):
        snapshots = list(self.collection.stream())
        for condition in self.filters:
            if condition.op_string != "==":
                raise NotImplementedError(condition.op_string)
            snapshots = [
                snapshot
                for snapshot in snapshots
                if (snapshot.to_dict() or {}).get(condition.field_path)
                == condition.value
            ]
        if self.order_field:
            snapshots.sort(key=lambda item: (item.to_dict() or {})[self.order_field])
        return snapshots


class FakeCollection(FakeQuery):
    def __init__(self, database: FakeFirestore, path: tuple[str, ...]):
        self.database = database
        self.path = path
        super().__init__(self)

    def document(self, document_id: str | None = None) -> FakeDocumentReference:
        generated_id = document_id or f"auto-{next(self.database.identifiers):04d}"
        return FakeDocumentReference(self.database, (*self.path, generated_id))

    def stream(self):
        expected_length = len(self.path) + 1
        snapshots = []
        for path, data in self.database.documents.items():
            if len(path) == expected_length and path[:-1] == self.path:
                snapshots.append(
                    FakeSnapshot(FakeDocumentReference(self.database, path), data)
                )
        return snapshots


class FakeTransaction:
    def set(self, reference: FakeDocumentReference, data: dict[str, Any]) -> None:
        reference.set(data)

    def update(self, reference: FakeDocumentReference, data: dict[str, Any]) -> None:
        reference.update(data)

    def commit(self) -> None:
        return None


class FakeFirestore:
    def __init__(self):
        self.documents: dict[tuple[str, ...], dict[str, Any]] = {}
        self.identifiers = count(1)

    def collection(self, name: str) -> FakeCollection:
        return FakeCollection(self, (name,))

    def transaction(self) -> FakeTransaction:
        return FakeTransaction()

    def put(self, collection: str, document_id: str, data: dict[str, Any]) -> None:
        self.collection(collection).document(document_id).set(data)
