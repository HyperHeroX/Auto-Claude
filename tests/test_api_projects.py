import pytest
from httpx import AsyncClient, ASGITransport


@pytest.mark.asyncio
async def test_list_projects_empty():
    from api.main import create_app
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/projects")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_create_project(tmp_path):
    from api.main import create_app
    import os
    os.environ["DATA_DIR"] = str(tmp_path)
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/projects", json={
            "projectPath": str(tmp_path / "test-project")
        })
    assert response.status_code in (200, 201)
