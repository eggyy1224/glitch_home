from __future__ import annotations

from typing import Any, Dict, Optional
import json

import httpx

from .config import api_base, http_timeout_seconds


class BackendClient:
    def __init__(self, base_url: Optional[str] = None, timeout: Optional[float] = None) -> None:
        self.base_url = (base_url or api_base()).rstrip("/")
        self.timeout = timeout or http_timeout_seconds()
        self._client = httpx.Client(base_url=self.base_url, timeout=self.timeout)

    def _format_error(self, err: Exception, status_code: Optional[int] = None) -> Dict[str, Any]:
        message = str(err)
        return {"ok": False, "error": message, "status_code": status_code}

    def get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        try:
            r = self._client.get(path, params=params)
            if r.status_code >= 400:
                return self._format_error(Exception(r.text), r.status_code)
            return {"ok": True, "data": r.json()}
        except Exception as e:  # noqa: BLE001
            return self._format_error(e)

    def post(self, path: str, json_body: Optional[Dict[str, Any]] = None, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        try:
            r = self._client.post(path, json=json_body, params=params)
            if r.status_code >= 400:
                return self._format_error(Exception(r.text), r.status_code)
            # Some endpoints may return non-JSON; try to parse then fallback to text
            try:
                content = r.json()
            except json.JSONDecodeError:
                content = {"raw": r.text}
            return {"ok": True, "data": content}
        except Exception as e:  # noqa: BLE001
            return self._format_error(e)

    def put(self, path: str, json_body: Optional[Dict[str, Any]] = None, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        try:
            r = self._client.put(path, json=json_body, params=params)
            if r.status_code >= 400:
                return self._format_error(Exception(r.text), r.status_code)
            # Some endpoints may return non-JSON; try to parse then fallback to text
            try:
                content = r.json()
            except json.JSONDecodeError:
                content = {"raw": r.text}
            return {"ok": True, "data": content}
        except Exception as e:  # noqa: BLE001
            return self._format_error(e)

