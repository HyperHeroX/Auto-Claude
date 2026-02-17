from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def create_app() -> FastAPI:
    app = FastAPI(
        title="Auto Claude API",
        version="1.0.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/v1/health")
    async def health():
        return {"status": "ok"}

    from api.routes.projects import router as projects_router
    app.include_router(projects_router)

    from api.routes.tasks import router as tasks_router
    app.include_router(tasks_router)

    from api.routes.settings import router as settings_router
    app.include_router(settings_router)

    from api.routes.auth import router as auth_router
    app.include_router(auth_router)

    from api.websocket.agents import router as agents_ws_router
    app.include_router(agents_ws_router)

    return app


app = create_app()
