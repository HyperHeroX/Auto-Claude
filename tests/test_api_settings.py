import pytest
from httpx import AsyncClient, ASGITransport


@pytest.mark.asyncio
async def test_get_settings():
    from api.main import create_app
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/api/v1/settings")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_update_settings():
    from api.main import create_app
    app = create_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.put("/api/v1/settings", json={"theme": "dusk"})
    assert response.status_code == 200
