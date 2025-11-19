from app.api.screenshot_helpers import build_request_metadata


def test_build_request_metadata_returns_none_for_missing_snapshot():
    assert build_request_metadata(None) is None
    assert build_request_metadata(None, include_sound=True) is None


def test_build_request_metadata_basic_fields():
    snapshot = {
        "status": "completed",
        "target_client_id": "viewer-1",
        "processed_by": "worker-a",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:01:00Z",
        "metadata": {"foo": "bar"},
        "sound_effect": {"filename": "abc.wav"},
    }

    metadata = build_request_metadata(snapshot)

    assert metadata == {
        "status": "completed",
        "target_client_id": "viewer-1",
        "processed_by": "worker-a",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:01:00Z",
        "metadata": {"foo": "bar"},
    }


def test_build_request_metadata_sound_effect_optional():
    snapshot = {
        "status": "completed",
        "sound_effect": {"filename": "loop.wav"},
    }

    metadata_without_sound = build_request_metadata(snapshot)
    metadata_with_sound = build_request_metadata(snapshot, include_sound=True)

    assert "sound_effect" not in metadata_without_sound
    assert metadata_with_sound["sound_effect"] == {"filename": "loop.wav"}


def test_build_request_metadata_missing_fields_consistent():
    snapshot_missing = {
        "status": "completed",
    }
    snapshot_with_none = {
        "status": "completed",
        "created_at": None,
        "processed_by": None,
    }

    assert build_request_metadata(snapshot_missing) == build_request_metadata(snapshot_with_none)
