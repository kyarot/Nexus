from __future__ import annotations

import logging
import pkgutil
from importlib import import_module
from pathlib import Path

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)


def register_routers(app: FastAPI) -> None:
    routers_path = Path(__file__).parent / "routers"
    if not routers_path.exists():
        return

    for module_info in pkgutil.iter_modules([str(routers_path)]):
        if module_info.name.startswith("_"):
            continue

        module = import_module(f"routers.{module_info.name}")
        router = getattr(module, "router", None)

        if not isinstance(router, APIRouter):
            continue
        typed_router: APIRouter = router

        include_kwargs: dict[str, object] = {}
        module_prefix = getattr(module, "PREFIX", None)
        module_tags = getattr(module, "TAGS", None)

        if isinstance(module_prefix, str):
            include_kwargs["prefix"] = module_prefix
        elif not typed_router.prefix:
            include_kwargs["prefix"] = f"/{module_info.name}"

        if isinstance(module_tags, list):
            include_kwargs["tags"] = module_tags

        app.include_router(typed_router, **include_kwargs)


app = FastAPI(title="NEXUS API")

CORS_ORIGINS = settings.origins_list

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_routers(app)


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    import os
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True,
    )
