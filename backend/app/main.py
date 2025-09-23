from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from .config import settings
from .services.gemini_image import generate_mixed_offspring
from .models.schemas import GenerateMixTwoResponse


app = FastAPI(title="Image Loop Synthesizer Backend", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/generate/mix-two", response_model=GenerateMixTwoResponse, status_code=201)
def api_generate_mix_two(count: int = Query(2, ge=2)) -> JSONResponse:
    try:
        result = generate_mixed_offspring(count=count)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return JSONResponse(status_code=201, content=result)

