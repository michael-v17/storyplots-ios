import logging
import os
import traceback

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .routes.audio import router as audio_router
from .routes.avatar_generate import router as avatar_generate_router
from .routes.character_generate import router as character_generate_router
from .routes.character_refine import router as character_refine_router
from .routes.chat import router as chat_router
from .routes.fork import router as fork_router
from .routes.health import router as health_router
from .routes.image import router as image_router
from .routes.insights import router as insights_router
from .routes.provider_embedding import router as provider_embedding_router

FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")
ALLOWED_ORIGINS = [o.strip() for o in FRONTEND_ORIGIN.split(",") if o.strip()]

app = FastAPI(title="StoryPlots Backend", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "apikey"],
    allow_credentials=False,
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logging.getLogger("storyplots").exception("unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": f"{type(exc).__name__}: {exc}", "traceback": traceback.format_exc().splitlines()[-6:]},
    )

app.include_router(health_router)
app.include_router(chat_router)
app.include_router(insights_router)
app.include_router(fork_router)
app.include_router(image_router)
app.include_router(audio_router)
app.include_router(character_refine_router)
app.include_router(character_generate_router)
app.include_router(avatar_generate_router)
app.include_router(provider_embedding_router)
