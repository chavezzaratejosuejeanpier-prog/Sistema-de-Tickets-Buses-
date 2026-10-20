from pathlib import Path
from pydantic_settings import BaseSettings

# Carpeta backend/ (este archivo vive en backend/app/core/config.py)
BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    DATABASE_URL: str = f"sqlite:///{(BASE_DIR / 'buss_conectpro.db').as_posix()}"
    # Obligatoria: definela en backend/.env (ver .env.example). Sin ella la app falla al arrancar.
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    class Config:
        env_file = str(BASE_DIR / ".env")

settings = Settings()
