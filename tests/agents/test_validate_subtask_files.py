#!/usr/bin/env python3
"""
Test Suite for validate_subtask_files
======================================

Tests for the file validation logic that runs before subtask execution.
Ensures files_to_modify exist, files_to_create are excluded from checks,
and path boundary validation works correctly.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "apps" / "backend"))

from agents.coder import validate_subtask_files


@pytest.fixture
def project_dir(tmp_path: Path) -> Path:
    """Create a project directory with some existing files."""
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "app.py").write_text("# app")
    (tmp_path / "src" / "utils.py").write_text("# utils")
    (tmp_path / "locales" / "en").mkdir(parents=True)
    (tmp_path / "locales" / "en" / "common.json").write_text("{}")
    return tmp_path


class TestValidateSubtaskFiles:
    """Tests for validate_subtask_files."""

    def test_all_files_exist(self, project_dir: Path):
        """Should pass when all files_to_modify exist."""
        subtask = {"files_to_modify": ["src/app.py", "src/utils.py"]}
        result = validate_subtask_files(subtask, project_dir)
        assert result["success"] is True
        assert result["missing_files"] == []

    def test_missing_files_detected(self, project_dir: Path):
        """Should fail when files_to_modify references non-existent files."""
        subtask = {"files_to_modify": ["src/app.py", "src/missing.py"]}
        result = validate_subtask_files(subtask, project_dir)
        assert result["success"] is False
        assert "src/missing.py" in result["missing_files"]
        assert "Planned files do not exist" in result["error"]

    def test_empty_files_to_modify(self, project_dir: Path):
        """Should pass when files_to_modify is empty."""
        subtask = {"files_to_modify": []}
        result = validate_subtask_files(subtask, project_dir)
        assert result["success"] is True

    def test_no_files_to_modify_key(self, project_dir: Path):
        """Should pass when files_to_modify key is absent."""
        subtask = {}
        result = validate_subtask_files(subtask, project_dir)
        assert result["success"] is True

    def test_files_to_create_excluded_from_check(self, project_dir: Path):
        """Files in files_to_create should NOT trigger missing file errors,
        even if they also appear in files_to_modify."""
        subtask = {
            "files_to_modify": [
                "src/app.py",
                "locales/zh-TW/common.json",
                "locales/zh-TW/dialogs.json",
            ],
            "files_to_create": [
                "locales/zh-TW/common.json",
                "locales/zh-TW/dialogs.json",
            ],
        }
        result = validate_subtask_files(subtask, project_dir)
        assert result["success"] is True
        assert result["missing_files"] == []

    def test_files_to_create_only_excludes_listed(self, project_dir: Path):
        """Only files explicitly in files_to_create should be excluded."""
        subtask = {
            "files_to_modify": [
                "src/app.py",
                "locales/zh-TW/common.json",
                "locales/zh-TW/dialogs.json",
            ],
            "files_to_create": [
                "locales/zh-TW/common.json",
            ],
        }
        result = validate_subtask_files(subtask, project_dir)
        assert result["success"] is False
        assert "locales/zh-TW/dialogs.json" in result["missing_files"]
        assert "locales/zh-TW/common.json" not in result["missing_files"]

    def test_path_outside_project_boundary(self, project_dir: Path):
        """Should fail when path resolves outside project directory."""
        subtask = {"files_to_modify": ["../../etc/passwd"]}
        result = validate_subtask_files(subtask, project_dir)
        assert result["success"] is False
        assert len(result["invalid_paths"]) > 0
        assert "outside project boundary" in result["error"]

    def test_files_to_create_without_overlap(self, project_dir: Path):
        """files_to_create that are NOT in files_to_modify should not affect validation."""
        subtask = {
            "files_to_modify": ["src/app.py"],
            "files_to_create": ["src/new_file.py"],
        }
        result = validate_subtask_files(subtask, project_dir)
        assert result["success"] is True
