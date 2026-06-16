from __future__ import annotations

import json
import threading
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response

from .auth import build_admin_dependency
from .conversion_repository import ConversionJobNotFoundError, ConversionJobRepository, serialize_job
from .conversion_worker import ConversionWorkerError, run_conversion_job
from .repository import (
    FragmentNotFoundError,
    FragmentRepository,
    FragmentTooLargeError,
    FragmentValidationError,
    serialize_fragment,
)
from .settings import build_conversion_settings, build_fragment_settings


def create_app(
    db_path: str | Path | None = None,
    storage_dir: str | Path | None = None,
    max_fragment_bytes: int | None = None,
    admin_token: str | None = None,
    conversion_db_path: str | Path | None = None,
    conversion_storage_dir: str | Path | None = None,
    max_conversion_bytes: int | None = None,
) -> FastAPI:
    fragment_settings = build_fragment_settings(
        db_path=db_path,
        storage_dir=storage_dir,
        max_fragment_bytes=max_fragment_bytes,
        admin_token=admin_token,
    )
    conversion_settings = build_conversion_settings(
        db_path=conversion_db_path,
        storage_dir=conversion_storage_dir,
        max_conversion_bytes=max_conversion_bytes,
        admin_token=admin_token,
    )
    fragment_repository = FragmentRepository(fragment_settings.db_path, fragment_settings.storage_dir)
    conversion_repository = ConversionJobRepository(conversion_settings.db_path, conversion_settings.storage_dir)
    require_admin_token = build_admin_dependency(fragment_settings.admin_token)

    app = FastAPI(title="IFC Engine WASM fragments API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=fragment_settings.allowed_origins,
        allow_credentials=False,
        allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    def require_admin_header(authorization: str | None = Header(default=None)) -> None:
        require_admin_token(authorization)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/fragments")
    def list_fragments() -> list[dict[str, object]]:
        return [serialize_fragment(record) for record in fragment_repository.list_fragments()]

    @app.post("/api/fragments", status_code=201, dependencies=[Depends(require_admin_header)])
    async def upload_fragment(
        name: Annotated[str, Form()],
        file: Annotated[UploadFile, File()],
    ) -> dict[str, object]:
        payload = await file.read()
        try:
            record = fragment_repository.store_fragment(
                name=name,
                upload_filename=file.filename or "",
                payload=payload,
                max_bytes=fragment_settings.max_fragment_bytes,
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
            record = fragment_repository.get_fragment(fragment_id)
        except FragmentNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Fragment not found") from exc
        path = fragment_repository.file_path(record)
        if not path.is_file():
            raise HTTPException(status_code=404, detail="Fragment file not found")
        download_name = f"{record.name}.frag" if not record.name.lower().endswith(".frag") else record.name
        return FileResponse(path, media_type="application/octet-stream", filename=download_name)

    @app.delete("/api/fragments/{fragment_id}", status_code=204, dependencies=[Depends(require_admin_header)])
    def delete_fragment(fragment_id: str) -> Response:
        try:
            fragment_repository.delete_fragment(fragment_id)
        except FragmentNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Fragment not found") from exc
        return Response(status_code=204)

    @app.post("/api/ifc-conversion-jobs", status_code=202, dependencies=[Depends(require_admin_header)])
    async def create_conversion_job(
        name: Annotated[str, Form()],
        file: Annotated[UploadFile, File()],
    ) -> dict[str, object]:
        source_filename = file.filename or "model.ifc"
        job_id = uuid.uuid4().hex
        source_path = conversion_repository.sources_dir / f"{job_id}.ifc"
        source_path.parent.mkdir(parents=True, exist_ok=True)

        total_size = 0
        try:
            with source_path.open("wb") as destination:
                while True:
                    chunk = await file.read(1024 * 1024)
                    if not chunk:
                        break
                    total_size += len(chunk)
                    if total_size > conversion_settings.max_conversion_bytes:
                        raise HTTPException(status_code=413, detail="IFC file exceeds backend conversion limit")
                    destination.write(chunk)
        except HTTPException:
            source_path.unlink(missing_ok=True)
            raise
        except Exception as exc:
            source_path.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail=str(exc)) from exc
        finally:
            await file.close()

        job = conversion_repository.create_job(
            job_id=job_id,
            name=name,
            source_filename=source_filename,
            source_path=source_path,
            source_size_bytes=total_size,
        )
        thread = threading.Thread(
            target=_run_conversion_job_background,
            kwargs={
                "root": Path(__file__).resolve().parents[2],
                "job_repository": conversion_repository,
                "fragment_repository": fragment_repository,
                "job_id": job.id,
                "max_fragment_bytes": fragment_settings.max_fragment_bytes,
            },
            daemon=True,
        )
        thread.start()
        return serialize_job(job)

    @app.get("/api/ifc-conversion-jobs")
    def list_conversion_jobs() -> list[dict[str, object]]:
        return [serialize_job(record) for record in conversion_repository.list_jobs()]

    @app.get("/api/ifc-conversion-jobs/{job_id}")
    def get_conversion_job(job_id: str) -> dict[str, object]:
        try:
            return serialize_job(conversion_repository.get_job(job_id))
        except ConversionJobNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Conversion job not found") from exc

    @app.get("/api/ifc-conversion-jobs/{job_id}/source")
    def download_conversion_source(job_id: str) -> FileResponse:
        try:
            job = conversion_repository.get_job(job_id)
        except ConversionJobNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Conversion job not found") from exc
        path = conversion_repository.source_path(job)
        if not path.is_file():
            raise HTTPException(status_code=404, detail="Source IFC file not found")
        return FileResponse(path, media_type="application/octet-stream", filename=job.source_filename)

    @app.get("/api/ifc-conversion-jobs/{job_id}/artifact")
    def download_conversion_artifact(job_id: str) -> FileResponse:
        try:
            job = conversion_repository.get_job(job_id)
        except ConversionJobNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Conversion job not found") from exc
        if job.fragment_id is None:
            raise HTTPException(status_code=409, detail="Conversion artifact is not ready")
        try:
            fragment = fragment_repository.get_fragment(job.fragment_id)
        except FragmentNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Conversion fragment not found") from exc
        path = fragment_repository.file_path(fragment)
        if not path.is_file():
            raise HTTPException(status_code=404, detail="Conversion fragment file not found")
        return FileResponse(path, media_type="application/octet-stream", filename=f"{job.source_filename}.frag")

    @app.get("/api/ifc-conversion-jobs/{job_id}/manifest")
    def download_conversion_manifest(job_id: str) -> dict[str, object]:
        try:
            job = conversion_repository.get_job(job_id)
        except ConversionJobNotFoundError as exc:
            raise HTTPException(status_code=404, detail="Conversion job not found") from exc
        manifest_path = conversion_repository.manifest_path(job)
        if not manifest_path.is_file():
            raise HTTPException(status_code=409, detail="Conversion manifest is not ready")
        return json.loads(manifest_path.read_text(encoding="utf-8"))

    return app


def _run_conversion_job_background(
    *,
    root: Path,
    job_repository: ConversionJobRepository,
    fragment_repository: FragmentRepository,
    job_id: str,
    max_fragment_bytes: int,
) -> None:
    try:
        run_conversion_job(
            root=root,
            job_repository=job_repository,
            fragment_repository=fragment_repository,
            job_id=job_id,
            max_fragment_bytes=max_fragment_bytes,
        )
    except ConversionWorkerError:
        return
    except Exception:
        return


app = create_app()
