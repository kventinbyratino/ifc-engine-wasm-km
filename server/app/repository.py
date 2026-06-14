from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import HTTPException

from .schemas import FragmentRecord, fragment_to_dict
from .settings import normalize_display_name


class FragmentRepositoryError(Exception):
    pass


class FragmentNotFoundError(FragmentRepositoryError):
    pass


class FragmentValidationError(FragmentRepositoryError):
    pass


class FragmentTooLargeError(FragmentRepositoryError):
    pass


class FragmentRepository:
    def __init__(self, db_path: str | Path, storage_dir: str | Path):
        self.db_path = Path(db_path)
        self.storage_dir = Path(storage_dir)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        init_db(self.db_path)

    def list_fragments(self) -> list[FragmentRecord]:
        with connect(self.db_path) as conn:
            rows = conn.execute(
                """
                SELECT id, name, filename, size_bytes, created_at
                FROM fragments
                ORDER BY created_at DESC
                """
            ).fetchall()
        return [fragment_from_row(row) for row in rows]

    def get_fragment(self, fragment_id: str) -> FragmentRecord:
        with connect(self.db_path) as conn:
            row = conn.execute(
                "SELECT id, name, filename, size_bytes, created_at FROM fragments WHERE id = ?",
                (fragment_id,),
            ).fetchone()
        if row is None:
            raise FragmentNotFoundError(fragment_id)
        return fragment_from_row(row)

    def store_fragment(
        self,
        *,
        name: str,
        upload_filename: str,
        payload: bytes,
        max_bytes: int,
        created_at: str | None = None,
    ) -> FragmentRecord:
        if not upload_filename.lower().endswith(".frag"):
            raise FragmentValidationError("Only .frag files are supported")

        if len(payload) > max_bytes:
            raise FragmentTooLargeError("Fragment file is too large")

        fragment_id = uuid.uuid4().hex
        safe_name = normalize_display_name(name)
        filename = f"{fragment_id}.frag"
        path = self.storage_dir / filename
        path.write_bytes(payload)

        created_at_value = created_at or datetime.now(timezone.utc).isoformat()
        record = FragmentRecord(
            id=fragment_id,
            name=safe_name,
            filename=filename,
            size_bytes=len(payload),
            created_at=created_at_value,
        )
        with connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO fragments (id, name, filename, size_bytes, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (record.id, record.name, record.filename, record.size_bytes, record.created_at),
            )
            conn.commit()
        return record

    def delete_fragment(self, fragment_id: str) -> None:
        record = self.get_fragment(fragment_id)
        (self.storage_dir / record.filename).unlink(missing_ok=True)
        with connect(self.db_path) as conn:
            conn.execute("DELETE FROM fragments WHERE id = ?", (fragment_id,))
            conn.commit()

    def file_path(self, fragment: FragmentRecord) -> Path:
        return self.storage_dir / fragment.filename


def connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: Path) -> None:
    with connect(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS fragments (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                filename TEXT NOT NULL UNIQUE,
                size_bytes INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def fragment_from_row(row: sqlite3.Row) -> FragmentRecord:
    return FragmentRecord(
        id=row["id"],
        name=row["name"],
        filename=row["filename"],
        size_bytes=row["size_bytes"],
        created_at=row["created_at"],
    )


def serialize_fragment(record: FragmentRecord) -> dict[str, object]:
    return fragment_to_dict(record)
