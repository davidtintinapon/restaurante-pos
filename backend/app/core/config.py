from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    DATABASE_URL: str = "sqlite:///./restaurante.db"
    FRONTEND_ORIGIN: str = "http://localhost:5173"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"

settings = Settings()
