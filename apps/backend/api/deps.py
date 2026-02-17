"""Shared dependencies for API routes."""
from pathlib import Path
import os


def get_data_dir() -> Path:
    """Get the data directory for persistent storage."""
    return Path(os.environ.get("DATA_DIR", ".auto-claude"))


def get_workspace_dir() -> Path:
    """Get the workspace directory (user's project)."""
    return Path(os.environ.get("WORKSPACE_DIR", "."))
