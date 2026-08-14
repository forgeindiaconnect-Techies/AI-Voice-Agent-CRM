import logging
import httpx
from typing import Optional

logger = logging.getLogger("uvicorn.error")

_http_client: Optional[httpx.AsyncClient] = None


def get_http_client() -> httpx.AsyncClient:
    """Retrieve or create the global shared HTTP client singleton."""
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(10.0, connect=5.0),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
            headers={"User-Agent": "ForgeCRM-HTTPClient/1.0"}
        )
        logger.info("[PERF] Initialized global reusable HTTP connection pool.")
    return _http_client


async def close_http_client() -> None:
    """Close the global HTTP client session cleanly on application shutdown."""
    global _http_client
    if _http_client is not None and not _http_client.is_closed:
        await _http_client.aclose()
        _http_client = None
        logger.info("[PERF] Closed global reusable HTTP connection pool.")
