import sys
from pathlib import Path

import pytest


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.database import DEFAULT_DB_PATH, initialize_default_family


def reset_default_family_database() -> None:
    for suffix in ("", "-wal", "-shm"):
        DEFAULT_DB_PATH.with_name(f"{DEFAULT_DB_PATH.name}{suffix}").unlink(missing_ok=True)
    initialize_default_family()


def pytest_configure():
    reset_default_family_database()


@pytest.fixture(autouse=True)
def clean_default_family_database():
    reset_default_family_database()
    yield
    reset_default_family_database()
