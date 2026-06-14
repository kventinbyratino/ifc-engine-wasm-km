from __future__ import annotations

from collections.abc import Callable

from fastapi import HTTPException

AdminDependency = Callable[[str | None], None]


def build_admin_dependency(configured_admin_token: str | None) -> AdminDependency:
    def require_admin_token(authorization: str | None = None) -> None:
        if not configured_admin_token:
            raise HTTPException(status_code=500, detail="IFC_ADMIN_TOKEN is not configured")
        if authorization != f"Bearer {configured_admin_token}":
            raise HTTPException(status_code=401, detail="Unauthorized")

    return require_admin_token
