from __future__ import annotations

import sqlite3
import shutil
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path


class ConversionJobRepositoryError(Exception):
    pass


class ConversionJobNotFoundError(ConversionJobRepositoryError):
    pass


class ConversionJobValidationError(ConversionJobRepositoryError):
    pass


@dataclass(frozen=True, slots=True)
class ConversionJobRecord:
    id: str
    name: str
    source_filename: str
    source_path: str
    source_size_bytes: int
    status: str
    progress: int
    created_at: str
    updated_at: str
    fragment_id: str | None = None
    fragment_name: str | None = None
    fragment_size_bytes: int | None = None
    manifest_filename: str | None = None
    error: str | None = None


class ConversionJobRepository:
    def __init__(self, db_path: str | Path, storage_dir: str | Path):
        self.db_path = Path(db_path)
        self.storage_dir = Path(storage_dir)
        self.sources_dir = self.storage_dir / "sources"
        self.artifacts_dir = self.storage_dir / "artifacts"
        self.manifests_dir = self.storage_dir / "manifests"
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.sources_dir.mkdir(parents=True, exist_ok=True)
        self.artifacts_dir.mkdir(parents=True, exist_ok=True)
        self.manifests_dir.mkdir(parents=True, exist_ok=True)
        init_db(self.db_path)

    def create_job(
        self,
        *,
        name: str,
        source_filename: str,
        source_path: str | Path,
        source_size_bytes: int,
        job_id: str | None = None,
        created_at: str | None = None,
    ) -> ConversionJobRecord:
        record = ConversionJobRecord(
            id=job_id or uuid.uuid4().hex,
            name=normalize_name(name),
            source_filename=normalize_name(source_filename),
            source_path=str(Path(source_path)),
            source_size_bytes=source_size_bytes,
            status="queued",
            progress=0,
            created_at=created_at or datetime.now(timezone.utc).isoformat(),
            updated_at=created_at or datetime.now(timezone.utc).isoformat(),
        )
        with connect(self.db_path) as conn:
            conn.execute(
                """
                INSERT INTO conversion_jobs (
                    id, name, source_filename, source_path, source_size_bytes,
                    status, progress, created_at, updated_at,
                    fragment_id, fragment_name, fragment_size_bytes, manifest_filename, error
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record.id,
                    record.name,
                    record.source_filename,
                    record.source_path,
                    record.source_size_bytes,
                    record.status,
                    record.progress,
                    record.created_at,
                    record.updated_at,
                    record.fragment_id,
                    record.fragment_name,
                    record.fragment_size_bytes,
                    record.manifest_filename,
                    record.error,
                ),
            )
            conn.commit()
        return record

    def list_jobs(self) -> list[ConversionJobRecord]:
        with connect(self.db_path) as conn:
            rows = conn.execute(
                """
                SELECT id, name, source_filename, source_path, source_size_bytes,
                       status, progress, created_at, updated_at,
                       fragment_id, fragment_name, fragment_size_bytes, manifest_filename, error
                FROM conversion_jobs
                ORDER BY created_at DESC
                """
            ).fetchall()
        return [job_from_row(row) for row in rows]

    def get_job(self, job_id: str) -> ConversionJobRecord:
        with connect(self.db_path) as conn:
            row = conn.execute(
                """
                SELECT id, name, source_filename, source_path, source_size_bytes,
                       status, progress, created_at, updated_at,
                       fragment_id, fragment_name, fragment_size_bytes, manifest_filename, error
                FROM conversion_jobs
                WHERE id = ?
                """,
                (job_id,),
            ).fetchone()
        if row is None:
            raise ConversionJobNotFoundError(job_id)
        return job_from_row(row)

    def update_job(
        self,
        job_id: str,
        *,
        status: str | None = None,
        progress: int | None = None,
        fragment_id: str | None = None,
        fragment_name: str | None = None,
        fragment_size_bytes: int | None = None,
        manifest_filename: str | None = None,
        error: str | None = None,
    ) -> ConversionJobRecord:
        job = self.get_job(job_id)
        next_job = ConversionJobRecord(
            id=job.id,
            name=job.name,
            source_filename=job.source_filename,
            source_path=job.source_path,
            source_size_bytes=job.source_size_bytes,
            status=status or job.status,
            progress=job.progress if progress is None else progress,
            created_at=job.created_at,
            updated_at=datetime.now(timezone.utc).isoformat(),
            fragment_id=fragment_id if fragment_id is not None else job.fragment_id,
            fragment_name=fragment_name if fragment_name is not None else job.fragment_name,
            fragment_size_bytes=fragment_size_bytes if fragment_size_bytes is not None else job.fragment_size_bytes,
            manifest_filename=manifest_filename if manifest_filename is not None else job.manifest_filename,
            error=error if error is not None else job.error,
        )
        with connect(self.db_path) as conn:
            conn.execute(
                """
                UPDATE conversion_jobs
                SET status = ?, progress = ?, updated_at = ?, fragment_id = ?, fragment_name = ?,
                    fragment_size_bytes = ?, manifest_filename = ?, error = ?
                WHERE id = ?
                """,
                (
                    next_job.status,
                    next_job.progress,
                    next_job.updated_at,
                    next_job.fragment_id,
                    next_job.fragment_name,
                    next_job.fragment_size_bytes,
                    next_job.manifest_filename,
                    next_job.error,
                    next_job.id,
                ),
            )
            conn.commit()
        return next_job

    def mark_failed(self, job_id: str, error: str) -> ConversionJobRecord:
        return self.update_job(job_id, status="failed", progress=100, error=error)

    def mark_running(self, job_id: str, progress: int = 10) -> ConversionJobRecord:
        return self.update_job(job_id, status="running", progress=progress, error=None)

    def mark_completed(
        self,
        job_id: str,
        *,
        fragment_id: str,
        fragment_name: str,
        fragment_size_bytes: int,
        manifest_filename: str,
    ) -> ConversionJobRecord:
        return self.update_job(
            job_id,
            status="completed",
            progress=100,
            fragment_id=fragment_id,
            fragment_name=fragment_name,
            fragment_size_bytes=fragment_size_bytes,
            manifest_filename=manifest_filename,
            error=None,
        )

    def source_path(self, job: ConversionJobRecord) -> Path:
        return Path(job.source_path)

    def artifact_path(self, job: ConversionJobRecord) -> Path:
        return self.artifacts_dir / f"{job.id}.frag"

    def manifest_path(self, job: ConversionJobRecord) -> Path:
        return self.manifests_dir / f"{job.id}.json"

    def source_download_name(self, job: ConversionJobRecord) -> str:
        return job.source_filename or "model.ifc"


def connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: Path) -> None:
    with connect(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS conversion_jobs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                source_filename TEXT NOT NULL,
                source_path TEXT NOT NULL,
                source_size_bytes INTEGER NOT NULL,
                status TEXT NOT NULL,
                progress INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                fragment_id TEXT,
                fragment_name TEXT,
                fragment_size_bytes INTEGER,
                manifest_filename TEXT,
                error TEXT
            )
            """
        )
        conn.commit()


def job_from_row(row: sqlite3.Row) -> ConversionJobRecord:
    return ConversionJobRecord(
        id=row["id"],
        name=row["name"],
        source_filename=row["source_filename"],
        source_path=row["source_path"],
        source_size_bytes=row["source_size_bytes"],
        status=row["status"],
        progress=row["progress"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        fragment_id=row["fragment_id"],
        fragment_name=row["fragment_name"],
        fragment_size_bytes=row["fragment_size_bytes"],
        manifest_filename=row["manifest_filename"],
        error=row["error"],
    )


def serialize_job(record: ConversionJobRecord, api_base: str = "/api/ifc-conversion-jobs") -> dict[str, object]:
    payload = asdict(record)
    payload["source_url"] = f"{api_base}/{record.id}/source"
    payload["artifact_url"] = f"{api_base}/{record.id}/artifact" if record.fragment_id else None
    payload["manifest_url"] = f"{api_base}/{record.id}/manifest"
    payload["fragment_download_url"] = f"/api/fragments/{record.fragment_id}/download" if record.fragment_id else None
    return payload


def normalize_name(value: str) -> str:
    return Path(value.strip()).name or "model.ifc"
