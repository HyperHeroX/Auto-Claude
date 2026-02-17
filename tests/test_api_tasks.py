import pytest
from httpx import AsyncClient, ASGITransport


@pytest.mark.asyncio
async def test_list_tasks():
    from api.main import create_app
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/tasks?projectId=test")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_create_task(tmp_path):
    import os
    os.environ["DATA_DIR"] = str(tmp_path)
    from api.main import create_app
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/tasks", json={
            "projectId": "test",
            "title": "Add auth",
            "description": "Add user authentication"
        })
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Add auth"
