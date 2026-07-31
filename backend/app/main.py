import logging
import time
import traceback

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from app.core.config import settings
from app.core.database import init_indexes, check_db_connection
from app.routes import auth, users, pools, campaigns, leads, calls, leave, reports, ws

# ── Logging ──────────────────────────────────────────────────────────────────
logger = logging.getLogger("uvicorn.error")

app = FastAPI(
    title="Forge India Connect — AI Voice Calling CRM API",
    description="Backend for the AI Voice Calling CRM: auth/RBAC, pools (departments), "
                "campaigns, lead import/assignment, call logging, live monitoring, "
                "leave management and reporting backed by local MongoDB.",
    version="0.1.0",
)

# ── CORS ─────────────────────────────────────────────────────────────────────
# IMPORTANT: allow_origins=["*"] + allow_credentials=True is spec-invalid.
# Browsers silently drop the Access-Control-Allow-Origin header.
# We must list explicit origins when credentials are enabled.
allowed_origins = [
    settings.FRONTEND_ORIGIN,          # http://localhost:5173
    "http://localhost:5173",            # explicit fallback
    "http://127.0.0.1:5173",           # alt localhost
    "http://localhost:3000",            # alternate dev port
    "app://.",                          # Electron origin
]
# De-duplicate while preserving order
allowed_origins = list(dict.fromkeys(allowed_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
    expose_headers=["Content-Disposition"],
    max_age=600,  # Cache preflight for 10 minutes
)


# ── Request / Response Logging Middleware ────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    method = request.method
    path = request.url.path
    client = request.client.host if request.client else "unknown"

    try:
        response = await call_next(request)
    except Exception:
        # Log and re-raise so the global handler catches it
        logger.error(f"[{method}] {path} — unhandled exception during request processing")
        raise

    elapsed_ms = round((time.perf_counter() - start) * 1000, 1)
    logger.info(f"[{method}] {path} → {response.status_code} ({elapsed_ms}ms) from {client}")
    return response


# ── Global Exception Handler ────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch any unhandled exception and return a structured JSON 500 response."""
    logger.error(
        f"Unhandled exception on {request.method} {request.url.path}:\n"
        f"{traceback.format_exc()}"
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error. Please try again later."},
    )


# ── Routes ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(pools.router)
app.include_router(campaigns.router)
app.include_router(leads.router)
app.include_router(calls.router)
app.include_router(leave.router)
app.include_router(reports.router)
app.include_router(ws.router)


# ── Startup ──────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def on_startup():
    db_ok = await check_db_connection()
    if db_ok:
        await init_indexes()
        logger.info("Local MongoDB connected and indexes initialized.")
    else:
        logger.warning(
            "Local MongoDB is not accessible during startup. "
            "Make sure local MongoDB is running on mongodb://127.0.0.1:27017"
        )
    logger.info(f"CORS allowed origins: {allowed_origins}")


# ── Health & Root ────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    db_status = "connected" if await check_db_connection() else "disconnected"
    return {
        "status": "ok",
        "service": "forge-india-connect-crm-api",
        "database": f"local-mongodb ({settings.MONGO_DB_NAME})",
        "database_status": db_status
    }


@app.get("/health")
async def health():
    db_ok = await check_db_connection()
    if not db_ok:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Local MongoDB database connection failed"
        )
    return {"status": "healthy", "database": "connected"}


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    """Return 204 No Content for favicon requests to prevent browser 404 noise."""
    return Response(status_code=204)
