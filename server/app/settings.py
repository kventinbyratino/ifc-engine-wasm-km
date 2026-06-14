from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

DEFAULT_MAX_FRAGMENT_BYTES = 100 * 1024 * 1024
DEFAULT_ALLOWED_ORIGINS = ["http://127.0.0.1:5173", "http://localhost:5173"]
DEFAULT_FRAGMENT_DB = "./data/fragments.sqlite3"
DEFAULT_FRAGMENT_DIR = "./data/fragments"


@dataclass(frozen=True, slots=True)
class FragmentSettings:
    db_path: Path
    storage_dir: Path
    max_fragment_bytes: int
    admin_token: str | None
    allowed_origins: list[str]


def build_fragment_settings(
    db_path: str | Path | None = None,
    storage_dir: str | Path | None = None,
    max_fragment_bytes: int | None = None,
    admin_token: str | None = None,
    allowed_origins: str | None = None,
) -> FragmentSettings:
    return FragmentSettings(
        db_path=Path(db_path or os.getenv("IFC_FRAGMENTS_DB", DEFAULT_FRAGMENT_DB)),
        storage_dir=Path(storage_dir or os.getenv("IFC_FRAGMENTS_DIR", DEFAULT_FRAGMENT_DIR)),
        max_fragment_bytes=(
            int(os.getenv("IFC_MAX_FRAGMENT_BYTES", str(DEFAULT_MAX_FRAGMENT_BYTES)))
            if max_fragment_bytes is None
            else max_fragment_bytes
        ),
        admin_token=admin_token if admin_token is not None else os.getenv("IFC_ADMIN_TOKEN"),
        allowed_origins=get_allowed_origins(allowed_origins),
    )


def get_allowed_origins(raw: str | None = None) -> list[str]:
    value = raw if raw is not None else os.getenv("IFC_ALLOWED_ORIGINS", "")
    origins = [origin.strip() for origin in value.split(",") if origin.strip()]
    return origins or DEFAULT_ALLOWED_ORIGINS


def normalize_display_name(name: str) -> str:
    value = Path(name.strip()).name
    return value or "model"
