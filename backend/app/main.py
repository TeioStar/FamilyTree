from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .database import DEFAULT_FAMILY_ID, ROOT_DIR, connect, initialize_default_family, rows_to_dicts


class PersonCreate(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    generation: str = Field(min_length=1, max_length=8)
    branch: str = Field(min_length=1, max_length=20)
    years: str = Field(pattern=r"^\d{4}-\d{4}$")
    summary: str = Field(default="", max_length=240)


class PersonUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    generation: str = Field(min_length=1, max_length=8)
    branch: str = Field(min_length=1, max_length=20)
    years: str = Field(pattern=r"^\d{4}-\d{4}$")
    summary: str = Field(default="", max_length=240)



@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_default_family()
    yield


app = FastAPI(title="FamilyTree", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def assert_family(family_id: str) -> None:
    if family_id != DEFAULT_FAMILY_ID:
        raise HTTPException(status_code=404, detail="家谱不存在")


def next_position() -> tuple[int, int]:
    with connect() as connection:
        count = connection.execute("SELECT COUNT(*) FROM persons").fetchone()[0]
    return 90 + (count % 5) * 160, 500 + (count // 5) * 122


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/families")
def list_families() -> list[dict[str, Any]]:
    with connect() as connection:
        meta = {row["key"]: row["value"] for row in connection.execute("SELECT key, value FROM meta")}
        person_count = connection.execute("SELECT COUNT(*) FROM persons").fetchone()[0]
        relationship_count = connection.execute("SELECT COUNT(*) FROM relationships").fetchone()[0]
        event_count = connection.execute("SELECT COUNT(*) FROM events").fetchone()[0]

    return [
        {
            "id": meta["family_id"],
            "name": meta["name"],
            "role": meta["role"],
            "status": meta["status"],
            "stats": {
                "persons": person_count,
                "relationships": relationship_count,
                "events": event_count,
                "completeness": 86,
            },
        }
    ]


@app.get("/api/families/{family_id}/graph")
def get_graph(family_id: str) -> dict[str, Any]:
    assert_family(family_id)
    with connect() as connection:
        persons = rows_to_dicts(connection.execute("SELECT * FROM persons ORDER BY y, x").fetchall())
        relationships = rows_to_dicts(connection.execute("SELECT type, source AS source, target AS target FROM relationships").fetchall())
        events = rows_to_dicts(connection.execute("SELECT id, person_id AS personId, year, title FROM events ORDER BY year").fetchall())
    return {"familyId": family_id, "persons": persons, "relationships": relationships, "events": events}


@app.post("/api/families/{family_id}/persons", status_code=201)
def create_person(family_id: str, payload: PersonCreate) -> dict[str, Any]:
    assert_family(family_id)
    person_id = f"p-{uuid4().hex[:8]}"
    x, y = next_position()
    with connect() as connection:
        connection.execute(
            """
            INSERT INTO persons(id, name, generation, branch, years, x, y, summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (person_id, payload.name, payload.generation, payload.branch, payload.years, x, y, payload.summary),
        )
    return {"id": person_id, **payload.model_dump(), "x": x, "y": y}


@app.put("/api/families/{family_id}/persons/{person_id}")
def update_person(family_id: str, person_id: str, payload: PersonUpdate) -> dict[str, Any]:
    assert_family(family_id)
    with connect() as connection:
        cursor = connection.execute(
            """
            UPDATE persons
            SET name = ?, generation = ?, branch = ?, years = ?, summary = ?
            WHERE id = ?
            """,
            (payload.name, payload.generation, payload.branch, payload.years, payload.summary, person_id),
        )
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="人物不存在")
    return {"id": person_id, **payload.model_dump()}


frontend_dir = ROOT_DIR / "frontend"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
