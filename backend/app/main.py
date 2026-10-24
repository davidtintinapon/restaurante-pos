from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from .middleware.security_headers import SecurityHeadersMiddleware
from .core.config import settings
from .routers import auth, mesas, carta, pedidos, cocina, usuarios, reportes, superadmin, superadmin_dashboard, configuracion
from .routers import gastos

# ── Rate limiter ─────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

# ── App ──────────────────────────────────────────────────────
app = FastAPI(
    title="Zyquid POS API",
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url=None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── Middleware ────────────────────────────────────────────────
app.add_middleware(SecurityHeadersMiddleware)

_PROD_ORIGINS = [
    "https://app.zyquid.com",
    "https://restaurante-pos-kappa.vercel.app",
]
_cors_origins = settings.FRONTEND_ORIGINS if settings.FRONTEND_ORIGINS else _PROD_ORIGINS

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# ── Routers ───────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(mesas.router)
app.include_router(carta.router)
app.include_router(pedidos.router)
app.include_router(cocina.router)
app.include_router(usuarios.router)
app.include_router(reportes.router)
app.include_router(superadmin.router)
app.include_router(superadmin_dashboard.router)
app.include_router(configuracion.router)
app.include_router(gastos.router)

@app.get("/health")
@app.head("/health")
def health():
    return {"status": "ok"}
