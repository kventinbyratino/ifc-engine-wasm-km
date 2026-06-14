from __future__ import annotations

from dataclasses import asdict, dataclass


@dataclass(frozen=True, slots=True)
class FragmentRecord:
    id: str
    name: str
    filename: str
    size_bytes: int
    created_at: str


def fragment_to_dict(record: FragmentRecord) -> dict[str, object]:
    return asdict(record)
