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
