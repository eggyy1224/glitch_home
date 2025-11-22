import builtins
import importlib
import logging
import sys
import types

import pytest


def _reload_config():
    sys.modules.pop("app.config", None)
    return importlib.import_module("app.config")


def test_load_dotenv_import_error(monkeypatch, caplog):
    original_import = builtins.__import__

    def raise_import_error(name, *args, **kwargs):
        if name == "dotenv":
            raise ImportError("dotenv missing")
        return original_import(name, *args, **kwargs)

    caplog.set_level(logging.WARNING)
    monkeypatch.setattr("builtins.__import__", raise_import_error)

    module = _reload_config()

    assert module.settings is not None
    assert not caplog.records
    sys.modules.pop("app.config", None)


def test_load_dotenv_logs_missing_files(monkeypatch, caplog):
    calls = []

    def fake_load_dotenv(*, dotenv_path, override):
        calls.append(dotenv_path)
        return False

    caplog.set_level(logging.WARNING)
    dotenv_module = types.ModuleType("dotenv")
    dotenv_module.load_dotenv = fake_load_dotenv
    monkeypatch.setitem(sys.modules, "dotenv", dotenv_module)

    module = _reload_config()

    assert module.settings is not None
    assert calls
    for path in calls:
        assert any(path in record.message for record in caplog.records)
    sys.modules.pop("app.config", None)


def test_load_dotenv_failure_logs_and_raises(monkeypatch, caplog):
    def failing_load_dotenv(*, dotenv_path, override):
        raise ValueError(f"bad env at {dotenv_path}")

    caplog.set_level(logging.WARNING)
    dotenv_module = types.ModuleType("dotenv")
    dotenv_module.load_dotenv = failing_load_dotenv
    monkeypatch.setitem(sys.modules, "dotenv", dotenv_module)

    with pytest.raises(ValueError):
        _reload_config()

    assert any("Failed to load .env" in record.message for record in caplog.records)
    sys.modules.pop("app.config", None)
