from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MONGO_URI: str = "mongodb://127.0.0.1:27017"
    MONGO_DB_NAME: str = "ai_voice_crm"
    JWT_SECRET: str = "dev_secret_change_me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    FRONTEND_ORIGIN: str = "http://localhost:5173"

    class Config:
        env_file = ".env"


settings = Settings()

