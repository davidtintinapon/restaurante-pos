from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    DATABASE_URL: str = "sqlite:///./restaurante.db"
    # Lista de orígenes permitidos separados por coma
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    ENVIRONMENT: str = "development"

    @property
    def FRONTEND_ORIGINS(self) -> List[str]:
        return [o.strip() for o in self.FRONTEND_ORIGIN.split(",") if o.strip()]

    class Config:
        env_file = ".env"

settings = Settings()
