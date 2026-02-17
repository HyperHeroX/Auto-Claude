from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

# Track active connections per task
_task_connections: dict[str, set[WebSocket]] = {}


@router.websocket("/ws/v1/agents/{task_id}")
async def agent_websocket(websocket: WebSocket, task_id: str):
    await websocket.accept()

    if task_id not in _task_connections:
        _task_connections[task_id] = set()
    _task_connections[task_id].add(websocket)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
            else:
                await websocket.send_json({
                    "type": "error",
                    "error": f"Unknown message type: {msg_type}",
                })
    except WebSocketDisconnect:
        _task_connections[task_id].discard(websocket)
        if not _task_connections[task_id]:
            del _task_connections[task_id]


async def broadcast_to_task(task_id: str, message: dict):
    """Broadcast a message to all WebSocket clients watching a task."""
    connections = _task_connections.get(task_id, set())
    dead = set()
    for ws in connections:
        try:
            await ws.send_json(message)
        except Exception:
            dead.add(ws)
    connections -= dead
