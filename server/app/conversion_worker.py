from __future__ import annotations

import json
import subprocess
from pathlib import Path

from .conversion_repository import ConversionJobRepository
from .repository import FragmentRepository


class ConversionWorkerError(RuntimeError):
    pass


def run_conversion_job(
    *,
    root: Path,
    job_repository: ConversionJobRepository,
    fragment_repository: FragmentRepository,
    job_id: str,
    max_fragment_bytes: int,
) -> None:
    job = job_repository.get_job(job_id)
    source_path = Path(job.source_path)
    artifact_path = job_repository.artifact_path(job)
    manifest_path = job_repository.manifest_path(job)
    script_path = root / "backend" / "convert-ifc.mjs"

    job_repository.mark_running(job_id, progress=10)
    try:
        completed = subprocess.run(
            [
                "node",
                str(script_path),
                "--source",
                str(source_path),
                "--artifact",
                str(artifact_path),
                "--manifest",
                str(manifest_path),
                "--name",
                job.name,
                "--source-name",
                job.source_filename,
                "--job-id",
                job.id,
            ],
            cwd=root,
            check=False,
            capture_output=True,
            text=True,
        )
        if completed.returncode != 0:
            stderr = completed.stderr.strip()
            stdout = completed.stdout.strip()
            raise ConversionWorkerError(stderr or stdout or f"IFC conversion failed with exit code {completed.returncode}")

        if not artifact_path.is_file():
            raise ConversionWorkerError("Conversion artifact was not written")

        fragment = fragment_repository.store_fragment_from_file(
            name=job.name,
            upload_filename=f"{job.source_filename}.frag",
            source_path=artifact_path,
            max_bytes=max_fragment_bytes,
        )

        manifest = {
            "kind": "ifc-conversion-manifest",
            "version": 1,
            "job_id": job.id,
            "name": job.name,
            "source_filename": job.source_filename,
            "source_size_bytes": job.source_size_bytes,
            "artifact_filename": artifact_path.name,
            "artifact_size_bytes": artifact_path.stat().st_size,
            "fragment_id": fragment.id,
            "fragment_name": fragment.name,
            "fragment_size_bytes": fragment.size_bytes,
            "status": "completed",
            "artifact_url": f"/api/fragments/{fragment.id}/download",
            "source_url": f"/api/ifc-conversion-jobs/{job.id}/source",
        }
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

        job_repository.mark_completed(
            job_id,
            fragment_id=fragment.id,
            fragment_name=fragment.name,
            fragment_size_bytes=fragment.size_bytes,
            manifest_filename=manifest_path.name,
        )
    except Exception as exc:  # pragma: no cover - propagated to backend status and logs
        job_repository.mark_failed(job_id, str(exc))
        raise
