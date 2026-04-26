from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import JSONResponse
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


class RelationshipCreate(BaseModel):
    type: str = Field(pattern=r"^(parent|spouse|adoptive|collateral)$")
    source: str = Field(min_length=1, max_length=40)
    target: str = Field(min_length=1, max_length=40)


class EventCreate(BaseModel):
    person_id: str = Field(min_length=1, max_length=40)
    year: int = Field(ge=1, le=9999)
    title: str = Field(min_length=1, max_length=80)


class ArchiveCreate(BaseModel):
    person_id: str = Field(min_length=1, max_length=40)
    type: str = Field(pattern=r"^(manuscript|photo|epitaph|oral|contract|other)$")
    title: str = Field(min_length=1, max_length=80)
    source: str = Field(min_length=1, max_length=80)


class FamilyImportMeta(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=80)
    role: str = Field(min_length=1, max_length=40)
    status: str = Field(min_length=1, max_length=40)


class PersonImport(BaseModel):
    id: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=40)
    generation: str = Field(min_length=1, max_length=8)
    branch: str = Field(min_length=1, max_length=20)
    years: str = Field(pattern=r"^\d{4}-\d{4}$")
    x: int
    y: int
    summary: str = Field(default="", max_length=240)


class RelationshipImport(BaseModel):
    id: int
    type: str = Field(pattern=r"^(parent|spouse|adoptive|collateral)$")
    source: str = Field(min_length=1, max_length=40)
    target: str = Field(min_length=1, max_length=40)


class EventImport(BaseModel):
    id: str = Field(min_length=1, max_length=40)
    personId: str = Field(min_length=1, max_length=40)
    year: int = Field(ge=1, le=9999)
    title: str = Field(min_length=1, max_length=80)


class ArchiveImport(BaseModel):
    id: str = Field(min_length=1, max_length=40)
    personId: str = Field(min_length=1, max_length=40)
    type: str = Field(pattern=r"^(manuscript|photo|epitaph|oral|contract|other)$")
    title: str = Field(min_length=1, max_length=80)
    source: str = Field(min_length=1, max_length=80)


class AuditLogImport(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    actor: str = Field(min_length=1, max_length=40)
    action: str = Field(min_length=1, max_length=40)
    entityType: str = Field(min_length=1, max_length=40)
    entityId: str = Field(min_length=1, max_length=80)
    summary: str = Field(min_length=1, max_length=160)
    createdAt: str = Field(min_length=1, max_length=40)


class FamilyDataImport(BaseModel):
    persons: list[PersonImport]
    relationships: list[RelationshipImport]
    events: list[EventImport]
    archives: list[ArchiveImport]
    auditLogs: list[AuditLogImport]


class FamilyImportPayload(BaseModel):
    schemaVersion: int
    family: FamilyImportMeta
    data: FamilyDataImport



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


def assert_person_exists(connection, person_id: str) -> None:
    exists = connection.execute("SELECT 1 FROM persons WHERE id = ?", (person_id,)).fetchone()
    if not exists:
        raise HTTPException(status_code=404, detail="人物不存在")


def record_audit(connection, action: str, entity_type: str, entity_id: str, summary: str) -> None:
    connection.execute(
        """
        INSERT INTO audit_logs(id, actor, action, entity_type, entity_id, summary)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (f"log-{uuid4().hex[:10]}", "creator", action, entity_type, entity_id, summary),
    )


def validate_import_references(payload: FamilyImportPayload) -> None:
    person_ids = {person.id for person in payload.data.persons}
    for relationship in payload.data.relationships:
        if relationship.source not in person_ids or relationship.target not in person_ids:
            raise HTTPException(status_code=400, detail="导入关系引用了不存在的人物")
    for event in payload.data.events:
        if event.personId not in person_ids:
            raise HTTPException(status_code=400, detail="导入事件引用了不存在的人物")
    for archive in payload.data.archives:
        if archive.personId not in person_ids:
            raise HTTPException(status_code=400, detail="导入资料引用了不存在的人物")


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
        archive_count = connection.execute("SELECT COUNT(*) FROM archives").fetchone()[0]

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
                "archives": archive_count,
                "completeness": 86,
            },
        }
    ]


@app.get("/api/families/{family_id}/graph")
def get_graph(family_id: str) -> dict[str, Any]:
    assert_family(family_id)
    with connect() as connection:
        persons = rows_to_dicts(connection.execute("SELECT * FROM persons ORDER BY y, x").fetchall())
        relationships = rows_to_dicts(connection.execute("SELECT id, type, source AS source, target AS target FROM relationships").fetchall())
        events = rows_to_dicts(connection.execute("SELECT id, person_id AS personId, year, title FROM events ORDER BY year").fetchall())
        archives = rows_to_dicts(
            connection.execute(
                "SELECT id, person_id AS personId, type, title, source FROM archives ORDER BY title"
            ).fetchall()
        )
        audit_logs = rows_to_dicts(
            connection.execute(
                """
                SELECT
                    id,
                    actor,
                    action,
                    entity_type AS entityType,
                    entity_id AS entityId,
                    summary,
                    created_at AS createdAt
                FROM audit_logs
                ORDER BY created_at DESC, id DESC
                LIMIT 30
                """
            ).fetchall()
        )
    return {
        "familyId": family_id,
        "persons": persons,
        "relationships": relationships,
        "events": events,
        "archives": archives,
        "auditLogs": audit_logs,
    }


@app.get("/api/families/{family_id}/export")
def export_family(family_id: str) -> JSONResponse:
    assert_family(family_id)
    graph = get_graph(family_id)
    with connect() as connection:
        meta = {row["key"]: row["value"] for row in connection.execute("SELECT key, value FROM meta")}

    payload = {
        "schemaVersion": 1,
        "exportedAt": date.today().isoformat(),
        "family": {
            "id": meta["family_id"],
            "name": meta["name"],
            "role": meta["role"],
            "status": meta["status"],
        },
        "data": graph,
    }
    return JSONResponse(
        payload,
        headers={"Content-Disposition": f'attachment; filename="{family_id}-familytree-export.json"'},
    )


@app.post("/api/families/{family_id}/import")
def import_family(family_id: str, payload: FamilyImportPayload) -> dict[str, Any]:
    assert_family(family_id)
    if payload.schemaVersion != 1:
        raise HTTPException(status_code=400, detail="暂不支持该导入版本")
    if payload.family.id != family_id:
        raise HTTPException(status_code=400, detail="导入家谱与当前家谱不匹配")

    validate_import_references(payload)

    with connect() as connection:
        connection.execute("DELETE FROM relationships")
        connection.execute("DELETE FROM events")
        connection.execute("DELETE FROM archives")
        connection.execute("DELETE FROM persons")
        connection.execute("DELETE FROM audit_logs")
        connection.execute(
            "UPDATE meta SET value = CASE key WHEN 'name' THEN ? WHEN 'role' THEN ? WHEN 'status' THEN ? ELSE value END",
            (payload.family.name, payload.family.role, payload.family.status),
        )
        connection.executemany(
            """
            INSERT INTO persons(id, name, generation, branch, years, x, y, summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (person.id, person.name, person.generation, person.branch, person.years, person.x, person.y, person.summary)
                for person in payload.data.persons
            ],
        )
        connection.executemany(
            "INSERT INTO relationships(id, type, source, target) VALUES (?, ?, ?, ?)",
            [
                (relationship.id, relationship.type, relationship.source, relationship.target)
                for relationship in payload.data.relationships
            ],
        )
        connection.executemany(
            "INSERT INTO events(id, person_id, year, title) VALUES (?, ?, ?, ?)",
            [(event.id, event.personId, event.year, event.title) for event in payload.data.events],
        )
        connection.executemany(
            "INSERT INTO archives(id, person_id, type, title, source) VALUES (?, ?, ?, ?, ?)",
            [(archive.id, archive.personId, archive.type, archive.title, archive.source) for archive in payload.data.archives],
        )
        connection.executemany(
            """
            INSERT INTO audit_logs(id, actor, action, entity_type, entity_id, summary, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    log.id,
                    log.actor,
                    log.action,
                    log.entityType,
                    log.entityId,
                    log.summary,
                    log.createdAt,
                )
                for log in payload.data.auditLogs
            ],
        )
        record_audit(connection, "import", "family", family_id, f"导入恢复：{payload.family.name}")

    return {
        "familyId": family_id,
        "persons": len(payload.data.persons),
        "relationships": len(payload.data.relationships),
        "events": len(payload.data.events),
        "archives": len(payload.data.archives),
    }


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
        record_audit(connection, "create", "person", person_id, f"新增人物：{payload.name}")
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
        record_audit(connection, "update", "person", person_id, f"更新人物：{payload.name}")
    return {"id": person_id, **payload.model_dump()}


@app.delete("/api/families/{family_id}/persons/{person_id}", status_code=204, response_class=Response)
def delete_person(family_id: str, person_id: str):
    assert_family(family_id)
    with connect() as connection:
        cursor = connection.execute("DELETE FROM persons WHERE id = ?", (person_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="人物不存在")
        connection.execute("DELETE FROM relationships WHERE source = ? OR target = ?", (person_id, person_id))
        connection.execute("DELETE FROM events WHERE person_id = ?", (person_id,))
        connection.execute("DELETE FROM archives WHERE person_id = ?", (person_id,))
        record_audit(connection, "delete", "person", person_id, f"删除人物：{person_id}")


@app.post("/api/families/{family_id}/relationships", status_code=201)
def create_relationship(family_id: str, payload: RelationshipCreate) -> dict[str, Any]:
    assert_family(family_id)
    if payload.source == payload.target:
        raise HTTPException(status_code=400, detail="关系两端不能是同一人物")

    with connect() as connection:
        assert_person_exists(connection, payload.source)
        assert_person_exists(connection, payload.target)
        try:
            cursor = connection.execute(
                "INSERT INTO relationships(type, source, target) VALUES (?, ?, ?)",
                (payload.type, payload.source, payload.target),
            )
        except Exception as exc:
            if "UNIQUE" in str(exc).upper():
                raise HTTPException(status_code=409, detail="关系已存在") from exc
            raise
        record_audit(
            connection,
            "create",
            "relationship",
            str(cursor.lastrowid),
            f"新增关系：{payload.source} -> {payload.target}",
        )

    return {"id": cursor.lastrowid, **payload.model_dump()}


@app.delete("/api/families/{family_id}/relationships/{relationship_id}", status_code=204, response_class=Response)
def delete_relationship(family_id: str, relationship_id: int):
    assert_family(family_id)
    with connect() as connection:
        cursor = connection.execute("DELETE FROM relationships WHERE id = ?", (relationship_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="关系不存在")
        record_audit(connection, "delete", "relationship", str(relationship_id), f"删除关系：{relationship_id}")


@app.post("/api/families/{family_id}/events", status_code=201)
def create_event(family_id: str, payload: EventCreate) -> dict[str, Any]:
    assert_family(family_id)
    event_id = f"e-{uuid4().hex[:8]}"
    with connect() as connection:
        assert_person_exists(connection, payload.person_id)
        connection.execute(
            "INSERT INTO events(id, person_id, year, title) VALUES (?, ?, ?, ?)",
            (event_id, payload.person_id, payload.year, payload.title),
        )
        record_audit(connection, "create", "event", event_id, f"新增事件：{payload.title}")
    return {"id": event_id, "personId": payload.person_id, "year": payload.year, "title": payload.title}


@app.delete("/api/families/{family_id}/events/{event_id}", status_code=204, response_class=Response)
def delete_event(family_id: str, event_id: str):
    assert_family(family_id)
    with connect() as connection:
        cursor = connection.execute("DELETE FROM events WHERE id = ?", (event_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="事件不存在")
        record_audit(connection, "delete", "event", event_id, f"删除事件：{event_id}")


@app.post("/api/families/{family_id}/archives", status_code=201)
def create_archive(family_id: str, payload: ArchiveCreate) -> dict[str, Any]:
    assert_family(family_id)
    archive_id = f"a-{uuid4().hex[:8]}"
    with connect() as connection:
        assert_person_exists(connection, payload.person_id)
        connection.execute(
            "INSERT INTO archives(id, person_id, type, title, source) VALUES (?, ?, ?, ?, ?)",
            (archive_id, payload.person_id, payload.type, payload.title, payload.source),
        )
        record_audit(connection, "create", "archive", archive_id, f"新增资料：{payload.title}")
    return {
        "id": archive_id,
        "personId": payload.person_id,
        "type": payload.type,
        "title": payload.title,
        "source": payload.source,
    }


@app.delete("/api/families/{family_id}/archives/{archive_id}", status_code=204, response_class=Response)
def delete_archive(family_id: str, archive_id: str):
    assert_family(family_id)
    with connect() as connection:
        cursor = connection.execute("DELETE FROM archives WHERE id = ?", (archive_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="资料不存在")
        record_audit(connection, "delete", "archive", archive_id, f"删除资料：{archive_id}")


frontend_dir = ROOT_DIR / "frontend"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
