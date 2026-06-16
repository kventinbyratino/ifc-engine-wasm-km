from __future__ import annotations

from pathlib import Path
from time import monotonic, sleep

from fastapi.testclient import TestClient

from app.main import create_app


FIXTURE_IFC = Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "ifc" / "modified-roundtrip.ifc"


def make_client(tmp_path: Path, admin_token: str = "test-token") -> TestClient:
    app = create_app(
        db_path=tmp_path / "fragments.sqlite3",
        storage_dir=tmp_path / "fragments",
        max_fragment_bytes=100_000,
        admin_token=admin_token,
        conversion_db_path=tmp_path / "conversion.sqlite3",
        conversion_storage_dir=tmp_path / "conversion",
        max_conversion_bytes=10_000_000,
    )
    return TestClient(app)


def auth_headers(token: str = "test-token") -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def wait_for_completed_job(client: TestClient, job_id: str, timeout_s: float = 20.0):
    deadline = monotonic() + timeout_s
    job = None
    while monotonic() < deadline:
        response = client.get(f"/api/ifc-conversion-jobs/{job_id}")
        assert response.status_code == 200
        job = response.json()
        if job["status"] in {"completed", "failed"}:
            return job
        sleep(0.1)
    raise AssertionError(f"Conversion job {job_id} did not finish in time")


def test_ifc_conversion_job_flow(tmp_path: Path):
    client = make_client(tmp_path)

    response = client.post(
        "/api/ifc-conversion-jobs",
        data={"name": "modified-roundtrip.ifc"},
        files={"file": ("modified-roundtrip.ifc", FIXTURE_IFC.read_bytes(), "application/octet-stream")},
        headers=auth_headers(),
    )

    assert response.status_code == 202
    created = response.json()
    assert created["status"] == "queued"
    assert created["source_filename"] == "modified-roundtrip.ifc"
    assert created["source_url"].endswith(f"/api/ifc-conversion-jobs/{created['id']}/source")

    completed = wait_for_completed_job(client, created["id"])
    assert completed["status"] == "completed"
    assert completed["fragment_id"]
    assert completed["artifact_url"].endswith(f"/api/ifc-conversion-jobs/{created['id']}/artifact")
    assert completed["fragment_download_url"].endswith(f"/api/fragments/{completed['fragment_id']}/download")

    manifest = client.get(f"/api/ifc-conversion-jobs/{created['id']}/manifest")
    assert manifest.status_code == 200
    manifest_json = manifest.json()
    assert manifest_json["kind"] == "ifc-conversion-manifest"
    assert manifest_json["fragment_id"] == completed["fragment_id"]

    artifact_download = client.get(completed["artifact_url"])
    assert artifact_download.status_code == 200
    assert artifact_download.content

    source_download = client.get(completed["source_url"])
    assert source_download.status_code == 200
    assert source_download.content == FIXTURE_IFC.read_bytes()

    fragment_download = client.get(completed["fragment_download_url"])
    assert fragment_download.status_code == 200
    assert fragment_download.content == artifact_download.content


def test_ifc_conversion_rejects_oversized_files(tmp_path: Path):
    client = make_client(tmp_path)
    response = client.post(
        "/api/ifc-conversion-jobs",
        data={"name": "too-big.ifc"},
        files={"file": ("too-big.ifc", b"x" * 10_000_001, "application/octet-stream")},
        headers=auth_headers(),
    )
    assert response.status_code == 413


def test_ifc_conversion_requires_admin_token(tmp_path: Path):
    client = make_client(tmp_path)
    response = client.post(
        "/api/ifc-conversion-jobs",
        data={"name": "modified-roundtrip.ifc"},
        files={"file": ("modified-roundtrip.ifc", FIXTURE_IFC.read_bytes(), "application/octet-stream")},
    )
    assert response.status_code == 401
