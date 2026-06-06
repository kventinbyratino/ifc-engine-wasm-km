from __future__ import annotations

import os
import shutil
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response

DEFAULT_MAX_FRAGMENT_BYTES = 100 * 1024 * 1024


def create_app(
    db_path: str | Path | None = None,
    storage_dir: str | Path | None = None,
    max_fragment_bytes: int | None = None,
    admin_token: str | None = None,
) -> FastAPI:
    db = Path(db_path or os.getenv("IFC_FRAGMENTS_DB", "./data/fragments.sqlite3"))
    storage = Path(storage_dir or os.getenv("IFC_FRAGMENTS_DIR", "./data/fragments"))
    max_bytes = int(os.getenv("IFC_MAX_FRAGMENT_BYTES", str(DEFAULT_MAX_FRAGMENT_BYTES))) if max_fragment_bytes is None else max_fragment_bytes
    db.parent.mkdir(parents=True, exist_ok=True)
    storage.mkdir(parents=True, exist_ok=True)
    init_db(db)
    configured_admin_token = admin_token if admin_token is not None else os.getenv("IFC_ADMIN_TOKEN")

    def require_admin_token(authorization: str | None = Header(default=None)) -> None:
        if not configured_admin_token:
            raise HTTPException(status_code=500, detail="IFC_ADMIN_TOKEN is not configured")
        if authorization != f"Bearer {configured_admin_token}":
            raise HTTPException(status_code=401, detail="Unauthorized")

    app = FastAPI(title="IFC Engine WASM fragments API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=os.getenv("IFC_ALLOWED_ORIGINS", "*").split(","),
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/fragments")
    def list_fragments() -> list[dict[str, object]]:
        with connect(db) as conn:
            rows = conn.execute(
                """
                SELECT id, name, filename, size_bytes, created_at
                FROM fragments
                ORDER BY created_at DESC
                """
            ).fetchall()
        return [serialize_row(row) for row in rows]

    @app.post("/api/fragments", status_code=201, dependencies=[Depends(require_admin_token)])
    async def upload_fragment(
        name: Annotated[str, Form()],
        file: Annotated[UploadFile, File()],
    ) -> dict[str, object]:
        original_filename = Path(file.filename or "").name
        if not original_filename.lower().endswith(".frag"):
            raise HTTPException(status_code=400, detail="Only .frag files are supported")

        fragment_id = uuid.uuid4().hex
        safe_name = normalize_display_name(name)
        stored_filename = f"{fragment_id}.frag"
        destination = storage / stored_filename
        size = 0

        try:
            with destination.open("wb") as out:
                while chunk := await file.read(1024 * 1024):
                    size += len(chunk)
                    if size > max_bytes:
                        raise HTTPException(status_code=413, detail="Fragment file is too large")
                    out.write(chunk)
        except Exception:
            destination.unlink(missing_ok=True)
            raise
        finally:
            await file.close()

        created_at = datetime.now(timezone.utc).isoformat()
        with connect(db) as conn:
            conn.execute(
                """
                INSERT INTO fragments (id, name, filename, size_bytes, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (fragment_id, safe_name, stored_filename, size, created_at),
            )
            conn.commit()

        return {
            "id": fragment_id,
            "name": safe_name,
            "filename": stored_filename,
            "size_bytes": size,
            "created_at": created_at,
        }

    @app.get("/api/fragments/{fragment_id}/download")
    def download_fragment(fragment_id: str) -> FileResponse:
        row = get_fragment(db, fragment_id)
        path = storage / str(row["filename"])
        if not path.is_file():
            raise HTTPException(status_code=404, detail="Fragment file not found")
        download_name = f"{row['name']}.frag" if not str(row["name"]).lower().endswith(".frag") else str(row["name"])
        return FileResponse(path, media_type="application/octet-stream", filename=download_name)

    @app.delete("/api/fragments/{fragment_id}", status_code=204, dependencies=[Depends(require_admin_token)])
    def delete_fragment(fragment_id: str) -> Response:
        row = get_fragment(db, fragment_id)
        path = storage / str(row["filename"])
        path.unlink(missing_ok=True)
        with connect(db) as conn:
            conn.execute("DELETE FROM fragments WHERE id = ?", (fragment_id,))
            conn.commit()
        return Response(status_code=204)

    return app


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


def get_fragment(db_path: Path, fragment_id: str) -> sqlite3.Row:
    with connect(db_path) as conn:
        row = conn.execute(
            "SELECT id, name, filename, size_bytes, created_at FROM fragments WHERE id = ?",
            (fragment_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Fragment not found")
    return row


def serialize_row(row: sqlite3.Row) -> dict[str, object]:
    return {
        "id": row["id"],
        "name": row["name"],
        "filename": row["filename"],
        "size_bytes": row["size_bytes"],
        "created_at": row["created_at"],
    }


def normalize_display_name(name: str) -> str:
    value = Path(name.strip()).name
    return value or "model"


app = create_app()
