from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pathlib import Path
import uuid


router = APIRouter(prefix="/api/v1/projects", tags=["projects"])

_projects: dict[str, dict] = {}


class ProjectCreate(BaseModel):
    projectPath: str
    name: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    settings: dict | None = None


@router.get("")
async def list_projects():
    return list(_projects.values())


@router.post("", status_code=201)
async def create_project(body: ProjectCreate):
    project_id = str(uuid.uuid4())[:8]
    project = {
        "id": project_id,
        "path": body.projectPath,
        "name": body.name or Path(body.projectPath).name,
        "createdAt": __import__("datetime").datetime.now().isoformat(),
    }
    _projects[project_id] = project
    return project


@router.get("/{project_id}")
async def get_project(project_id: str):
    project = _projects.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}")
async def update_project(project_id: str, body: ProjectUpdate):
    project = _projects.get(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if body.name:
        project["name"] = body.name
    if body.settings:
        project["settings"] = body.settings
    return project


@router.delete("/{project_id}")
async def delete_project(project_id: str):
    if project_id not in _projects:
        raise HTTPException(status_code=404, detail="Project not found")
    del _projects[project_id]
    return {"success": True}
