from __future__ import annotations

from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response

from .auth import build_admin_dependency
from .repository import (
    FragmentNotFoundError,
    FragmentRepository,
    FragmentTooLargeError,
    FragmentValidationError,
    serialize_fragment,
)
from .settings import build_fragment_settings

DEFAULT_MAX_FRAGMENT_BYTES = 100 * 1024 * 1024


def create_app(
    db_path: str | Path | None = None,
    storage_dir: str | Path | None = None,
    max_fragment_bytes: int | None = None,
    admin_token: str | None = None,
) -> FastAPI:
    settings = build_fragment_settings(
        db_path=db_path,
        storage_dir=storage_dir,
        max_fragment_bytes=max_fragment_bytes,
        admin_token=admin_token,
    )
    repository = FragmentRepository(settings.db_path, settings.storage_dir)
    require_admin_token = build_admin_dependency(settings.admin_token)

    app = FastAPI(title="IFC Engine WASM fragments API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/fragments")
    def list_fragments() -> list[dict[str, object]]:
        return [serialize_fragment(record) for record in repository.list_fragments()]

    def require_admin_header(authorization: str | None = Header(default=None)) -> None:
        require_admin_token(authorization)

    @app.post("/api/fragments", status_code=201, dependencies=[Depends(require_admin_header)])
    async def upload_fragment(
        name: Annotated[str, Form()],
        file: Annotated[UploadFile, File()],
    ) -> dict[str, object]:
        payload = await file.read()
        try:
            record = repository.store_fragment(
                name=name,
                upload_filename=file.filename or "",
                payload=payload,
                max_bytes=settings.max_fragment_bytes,
            )
        except FragmentValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except FragmentTooLargeError as exc:
            raise HTTPException(status_code=413, detail=str(exc)) from exc
        finally:
            await file.close()
        return serialize_fragment(record)

    @app.get("/api/fragments/{fragment_id}/download")
    def download_fragment(fragment_id: str) -> FileResponse:
        try:
            record = repository.get_fragment(fragment_id)
        except FragmentNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Fragment not found") from exc
        path = repository.file_path(record)
        if not path.is_file():
            raise HTTPException(status_code=404, detail="Fragment file not found")
        download_name = f"{record.name}.frag" if not record.name.lower().endswith(".frag") else record.name
        return FileResponse(path, media_type="application/octet-stream", filename=download_name)

    @app.delete("/api/fragments/{fragment_id}", status_code=204, dependencies=[Depends(require_admin_header)])
    def delete_fragment(fragment_id: str) -> Response:
        try:
            repository.delete_fragment(fragment_id)
        except FragmentNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Fragment not found") from exc
        return Response(status_code=204)

    return app


app = create_app()
