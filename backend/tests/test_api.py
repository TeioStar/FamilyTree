from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_graph_contains_seed_family():
    response = client.get("/api/families/shen-wuxian/graph")

    assert response.status_code == 200
    data = response.json()
    assert len(data["persons"]) >= 12
    assert any(person["name"] == "沈怀远" for person in data["persons"])
    assert any(edge["type"] == "spouse" for edge in data["relationships"])
    assert any(archive["type"] == "manuscript" for archive in data["archives"])
    assert any(log["entityType"] == "family" for log in data["auditLogs"])


def test_create_person_persists_to_family_database():
    response = client.post(
        "/api/families/shen-wuxian/persons",
        json={
            "name": "沈新录",
            "generation": "新",
            "branch": "新支",
            "years": "1990-2026",
            "summary": "测试录入人物",
        },
    )

    assert response.status_code == 201
    person_id = response.json()["id"]

    graph = client.get("/api/families/shen-wuxian/graph").json()
    assert any(person["id"] == person_id and person["name"] == "沈新录" for person in graph["persons"])
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
        },
    )

    assert response.status_code == 200
    graph = client.get("/api/families/shen-wuxian/graph").json()
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
