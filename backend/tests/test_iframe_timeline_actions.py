import pytest
from pydantic import ValidationError

from app.models.iframe_timeline import (
    TimelineRemoteClickAction,
    TimelineSpeechAction,
    TimelineTimedTextAction,
    TimelineVideoControlAction,
)
from app.services.iframe_timeline import (
    resolve_remote_click_action,
    resolve_speech_action,
    resolve_timed_text_action,
    resolve_video_control_action,
)


def test_timed_text_action_valid_and_missing_fields():
    action = TimelineTimedTextAction(
        text="字幕測試",
        language="zh-TW",
        duration_seconds=5,
    )
    payload = resolve_timed_text_action(action, fallback_client="default_client")
    assert payload["text"] == "字幕測試"
    assert payload["target_client_id"] == "default_client"

    with pytest.raises(ValidationError, match="subtitle/caption 需要 text 或 clear=true"):
        TimelineTimedTextAction()


def test_timed_text_action_invalid_client():
    action = TimelineTimedTextAction(text="OK", target_client_id="bad client id")
    with pytest.raises(ValueError, match="target_client_id 僅允許"):
        resolve_timed_text_action(action, fallback_client="default_client")


def test_speech_action_valid_and_missing_fields():
    action = TimelineSpeechAction(
        mode="speak_with_subtitle",
        text="大家好",
        auto_play=False,
    )
    payload = resolve_speech_action(action, fallback_client="client_a")
    assert payload["subtitle_text"] == "大家好"
    assert payload["target_client_id"] == "client_a"

    with pytest.raises(ValidationError, match="tts / speak_with_subtitle 模式需要 text"):
        TimelineSpeechAction(mode="tts")


def test_speech_action_invalid_client():
    action = TimelineSpeechAction(text="yo", target_client_id="bad client id")
    with pytest.raises(ValueError, match="target_client_id 僅允許"):
        resolve_speech_action(action, fallback_client="client_a")


def test_remote_click_action_valid_and_missing_fields():
    action = TimelineRemoteClickAction(
        selector="#cta",
        x=10,
        y=20,
        offset_seconds=1.5,
    )
    payload = resolve_remote_click_action(action, fallback_client="client_click")
    assert payload["selector"] == "#cta"
    assert payload["target_client_id"] == "client_click"

    with pytest.raises(ValidationError, match=r"remote_click 需要 selector/target 或 x\+y 座標"):
        TimelineRemoteClickAction()


def test_remote_click_action_invalid_client():
    action = TimelineRemoteClickAction(selector="#cta", target_client_id="bad client id")
    with pytest.raises(ValueError, match="target_client_id 僅允許"):
        resolve_remote_click_action(action, fallback_client="client_click")


def test_video_control_action_valid_and_missing_fields():
    action = TimelineVideoControlAction(action="play", offset_seconds=0.5)
    payload = resolve_video_control_action(action, fallback_client="video")
    assert payload["action"] == "play"
    assert payload["target_client_id"] == "video"

    with pytest.raises(ValidationError, match="set_volume 需要 volume"):
        TimelineVideoControlAction(action="set_volume")


def test_video_control_action_invalid_client():
    action = TimelineVideoControlAction(action="pause", target_client_id="bad client id")
    with pytest.raises(ValueError, match="target_client_id 僅允許"):
        resolve_video_control_action(action, fallback_client="video")
