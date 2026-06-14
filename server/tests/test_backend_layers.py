from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import HTTPException

from app.auth import build_admin_dependency
from app.repository import FragmentRepository
from app.settings import DEFAULT_ALLOWED_ORIGINS, get_allowed_origins, normalize_display_name


def test_settings_helpers_normalize_origins_and_names(monkeypatch):
    monkeypatch.delenv("IFC_ALLOWED_ORIGINS", raising=False)

    assert get_allowed_origins() == DEFAULT_ALLOWED_ORIGINS
    assert get_allowed_origins("https://dev.lab-tim.ru, https://example.org") == [
        "https://dev.lab-tim.ru",
        "https://example.org",
    ]
    assert normalize_display_name("../models/floor.ifc") == "floor.ifc"
    assert normalize_display_name("   ") == "model"


def test_admin_dependency_requires_bearer_token():
    require_admin = build_admin_dependency("secret-token")

    with pytest.raises(HTTPException) as exc:
        require_admin()
    assert exc.value.status_code == 401

    require_admin("Bearer secret-token")


def test_fragment_repository_roundtrip(tmp_path: Path):
    repository = FragmentRepository(
        db_path=tmp_path / "fragments.sqlite3",
        storage_dir=tmp_path / "fragments",
    )

    created = repository.store_fragment(
        name="model.ifc",
        upload_filename="model.frag",
        payload=b"fragment-bytes",
        max_bytes=100,
        created_at="2026-01-01T00:00:00+00:00",
    )

    assert created.name == "model.ifc"
    assert created.filename.endswith(".frag")
    assert created.size_bytes == len(b"fragment-bytes")
    assert (tmp_path / "fragments" / created.filename).read_bytes() == b"fragment-bytes"

    listed = repository.list_fragments()
    assert listed == [created]
    assert repository.get_fragment(created.id) == created

    repository.delete_fragment(created.id)
    assert repository.list_fragments() == []
    assert not (tmp_path / "fragments" / created.filename).exists()
