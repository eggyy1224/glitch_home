from app.api.clients import QueueCreateRequest, _collect_ids


def test_collect_ids_prefers_body_over_path() -> None:
    assert _collect_ids("path-one", ["id-a", "id-b"]) == ["id-a", "id-b"]
    assert _collect_ids("path-one", []) == []
    assert _collect_ids("path-one", None) == ["path-one"]


def test_collect_ids_deduplicates_body_ids() -> None:
    assert _collect_ids("path-one", ["dup", "dup", "other"]) == ["dup", "other"]


def test_queue_create_request_accepts_iso_eta() -> None:
    payload = {
        "client_id": "abc",
        "type": "snapshot",
        "target_id": "s1",
        "eta": "2024-05-01T12:00:00Z",
    }
    req = QueueCreateRequest(**payload)  # should not raise
    assert req.eta is not None
