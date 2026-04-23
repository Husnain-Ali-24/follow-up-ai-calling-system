from functools import lru_cache

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Outbound AI Calling API"
    business_name: str = "Outbound AI Calling"
    app_env: str = "development"
    app_debug: bool = True
    api_v1_prefix: str = "/api/v1"

    secret_key: str = Field(..., min_length=32)
    access_token_expire_minutes: int = 60

    database_url: str = "sqlite:///./data/app.db"
    backend_cors_origins: str = "http://localhost:8000,http://localhost:5173"
    default_phone_region: str = "US"
    base_url: str = "http://localhost:8000"

    vapi_api_key: str = ""
    vapi_base_url: str = "https://api.vapi.ai"
    vapi_phone_number_id: str = ""
    vapi_assistant_id: str = ""
    vapi_webhook_secret: str = ""

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    calling_window_start: str = "09:00"
    calling_window_end: str = "17:00"
    max_call_retries: int = 3
    max_reschedule_count: int = 3
    retry_delay_1_minutes: int = 30
    retry_delay_2_minutes: int = 120
    retry_delay_3_hours: int = 24
    max_concurrent_calls: int = 10
    scheduler_enabled: bool = False
    scheduler_tick_seconds: int = 30

    default_admin_email: str = "admin@example.com"
    default_admin_password: str = "admin123"
    default_admin_full_name: str = "Admin User"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @computed_field
    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def cors_origins_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.backend_cors_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
