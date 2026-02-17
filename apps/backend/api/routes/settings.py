from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])

_settings: dict = {
    "theme": "default",
    "mode": "dark",
    "language": "en",
}


@router.get("")
async def get_settings():
    return _settings


@router.put("")
async def update_settings(body: dict):
    _settings.update(body)
    return _settings
