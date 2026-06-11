from pathlib import Path

from fastapi.testclient import TestClient

from app.main import create_app


def make_client(tmp_path: Path, admin_token: str = "test-token") -> TestClient:
    app = create_app(
        db_path=tmp_path / "fragments.sqlite3",
        storage_dir=tmp_path / "fragments",
        max_fragment_bytes=100,
        admin_token=admin_token,
    )
    return TestClient(app)


def auth_headers(token: str = "test-token") -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_fragment_upload_list_download_and_delete(tmp_path: Path):
    client = make_client(tmp_path)

    response = client.post(
        "/api/fragments",
        data={"name": "model.ifc"},
        files={"file": ("model.frag", b"fragment-bytes", "application/octet-stream")},
        headers=auth_headers(),
    )

    assert response.status_code == 201
    created = response.json()
    assert created["name"] == "model.ifc"
    assert created["size_bytes"] == len(b"fragment-bytes")
    assert created["id"]
    assert created["created_at"]

    listing = client.get("/api/fragments")
    assert listing.status_code == 200
    assert listing.json() == [created]

    download = client.get(f"/api/fragments/{created['id']}/download")
    assert download.status_code == 200
    assert download.content == b"fragment-bytes"
    assert download.headers["content-disposition"].startswith('attachment; filename="model.ifc.frag"')

    deleted = client.delete(f"/api/fragments/{created['id']}", headers=auth_headers())
    assert deleted.status_code == 204
    assert client.get("/api/fragments").json() == []
    assert client.get(f"/api/fragments/{created['id']}/download").status_code == 404


def test_fragment_upload_rejects_oversized_files(tmp_path: Path):
    client = make_client(tmp_path)

    response = client.post(
        "/api/fragments",
        data={"name": "too-big.ifc"},
        files={"file": ("too-big.frag", b"x" * 101, "application/octet-stream")},
        headers=auth_headers(),
    )

    assert response.status_code == 413
    assert client.get("/api/fragments").json() == []


def test_fragment_upload_rejects_non_frag_extension(tmp_path: Path):
    client = make_client(tmp_path)

    response = client.post(
        "/api/fragments",
        data={"name": "bad.ifc"},
        files={"file": ("bad.ifc", b"ifc", "application/octet-stream")},
        headers=auth_headers(),
    )

    assert response.status_code == 400
    assert client.get("/api/fragments").json() == []


def test_fragment_upload_requires_admin_token(tmp_path: Path):
    client = make_client(tmp_path)

    response = client.post(
        "/api/fragments",
        data={"name": "model.ifc"},
        files={"file": ("model.frag", b"fragment-bytes", "application/octet-stream")},
    )

    assert response.status_code == 401


def test_fragment_delete_requires_admin_token(tmp_path: Path):
    client = make_client(tmp_path)

    created = client.post(
        "/api/fragments",
        data={"name": "model.ifc"},
        files={"file": ("model.frag", b"fragment-bytes", "application/octet-stream")},
        headers=auth_headers(),
    ).json()

    response = client.delete(f"/api/fragments/{created['id']}")

    assert response.status_code == 401
    assert client.get(f"/api/fragments/{created['id']}/download").status_code == 200


def test_cors_does_not_allow_unknown_origin(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("IFC_ALLOWED_ORIGINS", "https://dev.lab-tim.ru")
    client = make_client(tmp_path)

    response = client.options(
        "/api/fragments",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.headers.get("access-control-allow-origin") != "*"
    assert response.headers.get("access-control-allow-origin") != "https://evil.example"


def test_cors_default_does_not_use_wildcard_origin(tmp_path: Path, monkeypatch):
    monkeypatch.delenv("IFC_ALLOWED_ORIGINS", raising=False)
    client = make_client(tmp_path)

    response = client.options(
        "/api/fragments",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.headers.get("access-control-allow-origin") != "*"
    assert response.headers.get("access-control-allow-origin") != "https://evil.example"


def test_cors_allows_configured_origin(tmp_path: Path, monkeypatch):
    monkeypatch.setenv("IFC_ALLOWED_ORIGINS", "https://dev.lab-tim.ru")
    client = make_client(tmp_path)

    response = client.options(
        "/api/fragments",
        headers={
            "Origin": "https://dev.lab-tim.ru",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.headers.get("access-control-allow-origin") == "https://dev.lab-tim.ru"
