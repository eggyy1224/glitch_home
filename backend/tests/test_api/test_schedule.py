import pytest

from app.services.client_queue import client_queue_manager


@pytest.fixture(autouse=True)
def reset_queue_manager():
    client_queue_manager._auto_start_workers = False
    client_queue_manager._items.clear()
    client_queue_manager._queue_by_client.clear()
    client_queue_manager._workers.clear()
    client_queue_manager._wake_events.clear()
    yield
    client_queue_manager._items.clear()
    client_queue_manager._queue_by_client.clear()
    client_queue_manager._workers.clear()
    client_queue_manager._wake_events.clear()
    client_queue_manager._auto_start_workers = True


def test_schedule_crud_and_deploy(client):
    payload = {
        "id": "daily_show",
        "title": "Daily Show",
        "timezone": "Asia/Taipei",
        "status": "active",
        "events": [
            {
                "id": "evt_morning",
                "time": "09:00",
                "type": "snapshot",
                "target_id": "desktop/sample",
                "enabled": True,
            }
        ],
    }

    resp = client.put("/api/schedules/daily_show", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["schedule"]["id"] == "daily_show"

    resp = client.get("/api/schedules/daily_show")
    assert resp.status_code == 200
    schedule = resp.json()["schedule"]
    assert schedule["id"] == "daily_show"
    assert schedule["events"][0]["id"] == "evt_morning"

    resp = client.post("/api/schedules/daily_show/deploy", json={"dry_run": True})
    assert resp.status_code == 200
    dry_run = resp.json()
    assert dry_run["dry_run"] is True
    assert len(dry_run.get("planned", [])) == 1

    resp = client.post("/api/schedules/daily_show/deploy", json={"dry_run": False})
    assert resp.status_code == 200
    deploy = resp.json()
    assert deploy["dry_run"] is False
    assert len(deploy.get("created", [])) == 1

    resp = client.post("/api/schedules/daily_show/deploy", json={"dry_run": False})
    assert resp.status_code == 200
    deploy_again = resp.json()
    skipped = deploy_again.get("skipped", [])
    assert any(item.get("reason") == "duplicate" for item in skipped)
