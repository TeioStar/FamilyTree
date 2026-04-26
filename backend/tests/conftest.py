import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.database import DEFAULT_DB_PATH, initialize_default_family


def pytest_configure():
    DEFAULT_DB_PATH.unlink(missing_ok=True)
    initialize_default_family()
