import pytest
import asyncio
from httpx import AsyncClient
from httpx_ws import aconnect_ws
from httpx_ws.transport import ASGIWebSocketTransport


@pytest.mark.asyncio
async def test_agent_websocket_connection():
    from api.main import create_app
    app = create_app()
    async with AsyncClient(
        transport=ASGIWebSocketTransport(app),
        base_url="http://test"
    ) as client:
        async with aconnect_ws("/ws/v1/agents/test-task", client) as ws:
            await ws.send_json({"type": "ping"})
            response = await asyncio.wait_for(ws.receive_json(), timeout=5)
            assert response["type"] == "pong"
