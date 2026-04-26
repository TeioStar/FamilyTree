from fastapi.testclient import TestClient
from pathlib import Path

from app.main import app


client = TestClient(app)
BACKEND_DIR = Path(__file__).resolve().parents[1]


def test_graph_contains_seed_family():
    response = client.get("/api/families/shen-wuxian/graph")

    assert response.status_code == 200
    data = response.json()
    assert len(data["persons"]) >= 12
    assert any(person["name"] == "沈怀远" for person in data["persons"])
    seed_person = next(person for person in data["persons"] if person["id"] == "p1")
    assert seed_person["gender"] == "male"
    assert seed_person["birth_place"] == "苏州府吴县"
    assert seed_person["death_place"] == "苏州府吴县"
    assert seed_person["rank"] == "始祖"
    assert seed_person["burial_place"] == "吴县祖茔"
    assert seed_person["confidence"] == "已校"
    assert any(edge["type"] == "spouse" for edge in data["relationships"])
    assert any(archive["type"] == "manuscript" for archive in data["archives"])
    assert any(log["entityType"] == "family" for log in data["auditLogs"])


def test_export_family_contains_complete_archive_payload():
    response = client.get("/api/families/shen-wuxian/export")

    assert response.status_code == 200
    assert "shen-wuxian-familytree-export.json" in response.headers["content-disposition"]
    data = response.json()
    assert data["schemaVersion"] == 1
    assert data["family"]["id"] == "shen-wuxian"
    assert len(data["data"]["persons"]) >= 12
    exported_person = next(person for person in data["data"]["persons"] if person["id"] == "p1")
    assert exported_person["birth_place"] == "苏州府吴县"
    assert exported_person["confidence"] == "已校"
    assert data["data"]["relationships"]
    assert data["data"]["events"]
    assert data["data"]["archives"]
    assert data["data"]["auditLogs"]


def test_import_family_restores_export_payload():
    export_payload = client.get("/api/families/shen-wuxian/export").json()
    create_response = client.post(
        "/api/families/shen-wuxian/persons",
        json={
            "name": "临时导入测试",
            "generation": "临",
            "branch": "导入支",
            "years": "1999-2026",
            "summary": "导入恢复后应被移除",
            "gender": "unknown",
            "birth_place": "临时地",
            "death_place": "",
            "rank": "测试",
            "burial_place": "",
            "confidence": "待校",
        },
    )
    assert create_response.status_code == 201

    import_response = client.post("/api/families/shen-wuxian/import", json=export_payload)

    assert import_response.status_code == 200
    assert import_response.json()["persons"] == len(export_payload["data"]["persons"])
    graph = client.get("/api/families/shen-wuxian/graph").json()
    assert all(person["name"] != "临时导入测试" for person in graph["persons"])
    restored_person = next(person for person in graph["persons"] if person["id"] == "p1")
    assert restored_person["birth_place"] == "苏州府吴县"
    assert restored_person["confidence"] == "已校"
    assert any(log["action"] == "import" and log["entityType"] == "family" for log in graph["auditLogs"])


def test_import_family_rejects_wrong_family_id():
    export_payload = client.get("/api/families/shen-wuxian/export").json()
    export_payload["family"]["id"] = "other-family"

    response = client.post("/api/families/shen-wuxian/import", json=export_payload)

    assert response.status_code == 400


def test_create_family_library_and_write_independent_graph():
    family_id = "test-multi-family"
    for suffix in ("", "-wal", "-shm"):
        (BACKEND_DIR / "data" / "families" / f"{family_id}.ftree.db{suffix}").unlink(missing_ok=True)

    create_response = client.post(
        "/api/families",
        json={"id": family_id, "name": "测试多家谱", "role": "creator", "status": "draft"},
    )

    assert create_response.status_code == 201
    families = client.get("/api/families").json()
    assert any(family["id"] == family_id and family["name"] == "测试多家谱" for family in families)

    new_graph = client.get(f"/api/families/{family_id}/graph").json()
    assert new_graph["familyId"] == family_id
    assert new_graph["persons"] == []

    person_response = client.post(
        f"/api/families/{family_id}/persons",
        json={
            "name": "新谱首录",
            "generation": "首",
            "branch": "始迁支",
            "years": "2000-2026",
            "summary": "新家谱库中的独立人物",
            "gender": "unknown",
            "birth_place": "",
            "death_place": "",
            "rank": "首录",
            "burial_place": "",
            "confidence": "待校",
        },
    )

    assert person_response.status_code == 201
    default_graph = client.get("/api/families/shen-wuxian/graph").json()
    assert all(person["name"] != "新谱首录" for person in default_graph["persons"])
    created_graph = client.get(f"/api/families/{family_id}/graph").json()
    assert any(person["name"] == "新谱首录" for person in created_graph["persons"])


def test_search_indexes_people_events_and_archives():
    person_response = client.get("/api/families/shen-wuxian/search", params={"q": "沈怀远"})
    assert person_response.status_code == 200
    person_results = person_response.json()["results"]
    assert any(result["type"] == "person" and result["id"] == "p1" for result in person_results)

    event_response = client.get("/api/families/shen-wuxian/search", params={"q": "立谱"})
    assert event_response.status_code == 200
    assert any(result["type"] == "event" and result["personId"] == "p3" for result in event_response.json()["results"])

    archive_response = client.get("/api/families/shen-wuxian/search", params={"q": "手稿"})
    assert archive_response.status_code == 200
    assert any(result["type"] == "archive" and result["personId"] == "p7" for result in archive_response.json()["results"])


def test_create_person_persists_to_family_database():
    response = client.post(
        "/api/families/shen-wuxian/persons",
        json={
            "name": "沈新录",
            "generation": "新",
            "branch": "新支",
            "years": "1990-2026",
            "summary": "测试录入人物",
            "gender": "male",
            "birth_place": "无锡县",
            "death_place": "",
            "rank": "长孙",
            "burial_place": "新支墓园",
            "confidence": "待校",
        },
    )

    assert response.status_code == 201
    person_id = response.json()["id"]

    graph = client.get("/api/families/shen-wuxian/graph").json()
    created_person = next(person for person in graph["persons"] if person["id"] == person_id)
    assert created_person["name"] == "沈新录"
    assert created_person["birth_place"] == "无锡县"
    assert created_person["rank"] == "长孙"
    assert any(log["action"] == "create" and log["entityId"] == person_id for log in graph["auditLogs"])


def test_update_person_records_audit_log():
    response = client.put(
        "/api/families/shen-wuxian/persons/p1",
        json={
            "name": "沈怀远",
            "generation": "怀",
            "branch": "宗祖",
            "years": "1841-1912",
            "summary": "族谱主干人物，主持修谱与校订。",
            "gender": "male",
            "birth_place": "苏州府吴县",
            "death_place": "无锡迁居地",
            "rank": "始祖",
            "burial_place": "吴县祖茔东侧",
            "confidence": "已校",
        },
    )

    assert response.status_code == 200
    graph = client.get("/api/families/shen-wuxian/graph").json()
    updated_person = next(person for person in graph["persons"] if person["id"] == "p1")
    assert updated_person["death_place"] == "无锡迁居地"
    assert updated_person["burial_place"] == "吴县祖茔东侧"
    assert any(log["action"] == "update" and log["entityId"] == "p1" for log in graph["auditLogs"])


def test_create_relationship_rejects_self_reference():
    response = client.post(
        "/api/families/shen-wuxian/relationships",
        json={"type": "parent", "source": "p1", "target": "p1"},
    )

    assert response.status_code == 400


def test_create_and_delete_relationship():
    person_response = client.post(
        "/api/families/shen-wuxian/persons",
        json={
            "name": "沈旁支",
            "generation": "旁",
            "branch": "旁支",
            "years": "1991-2026",
            "summary": "用于关系测试",
        },
    )
    target_id = person_response.json()["id"]

    create_response = client.post(
        "/api/families/shen-wuxian/relationships",
        json={"type": "parent", "source": "p1", "target": target_id},
    )

    assert create_response.status_code == 201
    relationship_id = create_response.json()["id"]

    graph = client.get("/api/families/shen-wuxian/graph").json()
    assert any(edge["id"] == relationship_id for edge in graph["relationships"])

    delete_response = client.delete(f"/api/families/shen-wuxian/relationships/{relationship_id}")
    assert delete_response.status_code == 204
    graph = client.get("/api/families/shen-wuxian/graph").json()
    assert any(log["action"] == "delete" and log["entityType"] == "relationship" for log in graph["auditLogs"])


def test_create_and_delete_event():
    create_response = client.post(
        "/api/families/shen-wuxian/events",
        json={"person_id": "p1", "year": 1911, "title": "修谱校订"},
    )

    assert create_response.status_code == 201
    event_id = create_response.json()["id"]

    graph = client.get("/api/families/shen-wuxian/graph").json()
    assert any(event["id"] == event_id and event["title"] == "修谱校订" for event in graph["events"])

    delete_response = client.delete(f"/api/families/shen-wuxian/events/{event_id}")
    assert delete_response.status_code == 204
    graph = client.get("/api/families/shen-wuxian/graph").json()
    assert any(log["action"] == "delete" and log["entityId"] == event_id for log in graph["auditLogs"])


def test_create_and_delete_archive():
    create_response = client.post(
        "/api/families/shen-wuxian/archives",
        json={
            "person_id": "p1",
            "type": "oral",
            "title": "Oral history record",
            "source": "Family interview",
        },
    )

    assert create_response.status_code == 201
    archive_id = create_response.json()["id"]

    graph = client.get("/api/families/shen-wuxian/graph").json()
    assert any(archive["id"] == archive_id and archive["source"] == "Family interview" for archive in graph["archives"])

    delete_response = client.delete(f"/api/families/shen-wuxian/archives/{archive_id}")
    assert delete_response.status_code == 204
    graph = client.get("/api/families/shen-wuxian/graph").json()
    assert any(log["action"] == "delete" and log["entityId"] == archive_id for log in graph["auditLogs"])


def test_upload_archive_file_creates_downloadable_archive():
    response = client.post(
        "/api/families/shen-wuxian/archives/upload",
        data={
            "person_id": "p1",
            "type": "manuscript",
            "title": "手稿扫描件",
            "source": "家藏原件",
        },
        files={"file": ("scan.txt", b"archive file content", "text/plain")},
    )

    assert response.status_code == 201
    archive = response.json()
    assert archive["fileName"] == "scan.txt"
    assert archive["fileSize"] == len(b"archive file content")
    assert archive["mimeType"] == "text/plain"
    assert archive["fileUrl"].startswith("/uploads/shen-wuxian/")

    graph = client.get("/api/families/shen-wuxian/graph").json()
    uploaded_archive = next(item for item in graph["archives"] if item["id"] == archive["id"])
    assert uploaded_archive["fileName"] == "scan.txt"
    assert uploaded_archive["fileUrl"] == archive["fileUrl"]


def test_delete_person_removes_related_archives():
    person_response = client.post(
        "/api/families/shen-wuxian/persons",
        json={
            "name": "Archive Owner",
            "generation": "A",
            "branch": "Archive",
            "years": "1990-2026",
            "summary": "Owns archive records",
        },
    )
    person_id = person_response.json()["id"]
    archive_response = client.post(
        "/api/families/shen-wuxian/archives",
        json={
            "person_id": person_id,
            "type": "photo",
            "title": "Portrait",
            "source": "Private album",
        },
    )
    archive_id = archive_response.json()["id"]

    delete_response = client.delete(f"/api/families/shen-wuxian/persons/{person_id}")

    assert delete_response.status_code == 204
    graph = client.get("/api/families/shen-wuxian/graph").json()
    assert all(archive["id"] != archive_id for archive in graph["archives"])
