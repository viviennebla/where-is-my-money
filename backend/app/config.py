import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:////app/data/wimm.db"
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_EXPIRE_MINUTES: int = 1440
    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com/anthropic"
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_MODEL: str = "deepseek-v4-pro"
    DEEPSEEK_FLASH_MODEL: str = "deepseek-v4-flash"
    UPLOAD_DIR: str = "/app/uploads"
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024

    model_config = {"env_file": ".env"}


settings = Settings()

os.makedirs("data", exist_ok=True)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
