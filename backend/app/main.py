from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from .core.database import engine, Base
from .middleware.security_headers import SecurityHeadersMiddleware
from .routers import auth, mesas, carta, pedidos, cocina, usuarios, reportes, superadmin, superadmin_dashboard

# ── Crear tablas ─────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

# ── Rate limiter ─────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

# ── App ──────────────────────────────────────────────────────
app = FastAPI(
    title="RestauranteSaaS API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url=None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── Middleware ────────────────────────────────────────────────
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # En producción reemplazar por dominios reales
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get("/health")
def health():
    return {"status": "ok"}
