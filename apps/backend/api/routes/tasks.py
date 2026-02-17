from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import uuid
import datetime


router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])

_tasks: dict[str, dict] = {}


class TaskCreate(BaseModel):
    projectId: str
    title: str
    description: str
    metadata: dict | None = None


@router.get("")
async def list_tasks(projectId: str = Query(...)):
    return [t for t in _tasks.values() if t.get("projectId") == projectId]


@router.post("", status_code=201)
async def create_task(body: TaskCreate):
    task_id = str(uuid.uuid4())[:8]
    task = {
        "id": task_id,
        "projectId": body.projectId,
        "title": body.title,
        "description": body.description,
        "status": "pending",
        "metadata": body.metadata or {},
        "createdAt": datetime.datetime.now().isoformat(),
    }
    _tasks[task_id] = task
    return task


@router.get("/{task_id}")
async def get_task(task_id: str):
    task = _tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.delete("/{task_id}")
async def delete_task(task_id: str):
    if task_id not in _tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    del _tasks[task_id]
    return {"success": True}


@router.post("/{task_id}/execute")
async def execute_task(task_id: str):
    task = _tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task["status"] = "running"
    # TODO: Launch agent subprocess and stream events via WebSocket
    return {"success": True, "status": "running"}


@router.post("/{task_id}/cancel")
async def cancel_task(task_id: str):
    task = _tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task["status"] = "cancelled"
    return {"success": True}
