from pydantic_settings import BaseSettings
from typing import List, Optional

class Settings(BaseSettings):
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    DATABASE_URL: str = "sqlite:///./restaurante.db"
    # Lista de orígenes permitidos separados por coma (None = usar fallback en main.py)
    FRONTEND_ORIGIN: Optional[str] = None
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    ENVIRONMENT: str = "development"

    @property
    def FRONTEND_ORIGINS(self) -> List[str]:
        if not self.FRONTEND_ORIGIN:
            return []
        return [o.strip() for o in self.FRONTEND_ORIGIN.split(",") if o.strip()]

    class Config:
        env_file = ".env"

settings = Settings()
