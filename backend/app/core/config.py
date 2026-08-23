from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./buss_conectpro.db"
    SECRET_KEY: str = "cambia-esta-clave-super-secreta-buss-conectpro-2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    class Config:
        env_file = ".env"

settings = Settings()
