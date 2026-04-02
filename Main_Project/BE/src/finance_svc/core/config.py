from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "mysql+pymysql://root:password@localhost:3306/finance_app"
    secret_key: str = "your-secret-key-minimum-32-characters-long"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30
    groq_api_key: str = ""
    google_api_key: str = ""
    veryfi_client_id: str = ""
    veryfi_client_secret: str = ""
    veryfi_username: str = ""
    veryfi_api_key: str = ""
    app_env: str = "development"
    cors_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache()
def get_settings() -> Settings:
    return Settings()
