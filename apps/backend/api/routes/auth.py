from fastapi import APIRouter
from pydantic import BaseModel
import uuid

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

_profiles: dict[str, dict] = {}


class ProfileCreate(BaseModel):
    name: str
    apiKey: str | None = None
    baseUrl: str | None = None


@router.get("/profiles")
async def list_profiles():
    return list(_profiles.values())


@router.post("/profiles", status_code=201)
async def create_profile(body: ProfileCreate):
    profile_id = str(uuid.uuid4())[:8]
    profile = {
        "id": profile_id,
        "name": body.name,
        "baseUrl": body.baseUrl,
        "hasApiKey": body.apiKey is not None,
    }
    _profiles[profile_id] = profile
    return profile
