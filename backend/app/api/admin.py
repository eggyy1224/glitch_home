"""Serve simple admin console page."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

router = APIRouter()


@router.get("/admin", response_class=HTMLResponse)
async def admin_console(request: Request) -> HTMLResponse:
    return templates.TemplateResponse("admin.html", {"request": request})

