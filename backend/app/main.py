from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.responses import JSONResponse
from .config import settings
from .services.gemini_image import generate_mixed_offspring, generate_mixed_offspring_v2
from .models.schemas import GenerateMixTwoResponse, GenerateMixTwoRequest


app = FastAPI(title="Image Loop Synthesizer Backend", version="0.1.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.post("/api/generate/mix-two", response_model=GenerateMixTwoResponse, status_code=201)
def api_generate_mix_two(
    count: int | None = Query(None, ge=2, description="When body not provided, how many parents to sample"),
    body: GenerateMixTwoRequest | None = Body(default=None),
):
    """Backward-compatible endpoint with expanded options.

    - If body is omitted, falls back to previous behavior using `count` query (default 2).
    - If body is provided, supports explicit parents, prompt, strength, output size/format.
    """
    try:
        if body is None:
            result = generate_mixed_offspring(count=count or 2)
        else:
            result = generate_mixed_offspring_v2(
                parents=body.parents,
                count=body.count if body.count is not None else (count or 2),
                prompt=body.prompt,
                strength=body.strength,
                output_format=body.output_format,
                output_width=body.output_width,
                output_height=body.output_height,
                output_max_side=body.output_max_side,
                resize_mode=body.resize_mode,
            )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return JSONResponse(status_code=201, content=result)
