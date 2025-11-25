from app.api.clients import _collect_ids


def test_collect_ids_prefers_body_over_path() -> None:
    assert _collect_ids("path-one", ["id-a", "id-b"]) == ["id-a", "id-b"]
    assert _collect_ids("path-one", []) == []
    assert _collect_ids("path-one", None) == ["path-one"]


def test_collect_ids_deduplicates_body_ids() -> None:
    assert _collect_ids("path-one", ["dup", "dup", "other"]) == ["dup", "other"]
