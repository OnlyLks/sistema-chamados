import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
    DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
    DB_PORT = int(os.getenv("DB_PORT", "3306"))
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_NAME = os.getenv("DB_NAME", "sistema_chamados")
    JWT_SECRET = os.getenv("JWT_SECRET", "development-only-jwt-secret-do-not-use-in-production")
    JWT_SECRET_PREVIOUS = os.getenv("JWT_SECRET_PREVIOUS", "")
    JWT_ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))
    CORS_ORIGINS = [item.strip() for item in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if item.strip()]
    TRUSTED_HOSTS = [item.strip() for item in os.getenv("TRUSTED_HOSTS", "*" if APP_ENV != "production" else "").split(",") if item.strip()]

    def validate_production_settings(self):
        if self.APP_ENV != "production":
            return
        required = {
            "DB_HOST": self.DB_HOST,
            "DB_USER": self.DB_USER,
            "DB_PASSWORD": self.DB_PASSWORD,
            "DB_NAME": self.DB_NAME,
            "JWT_SECRET": self.JWT_SECRET,
            "CORS_ORIGINS": ",".join(self.CORS_ORIGINS),
            "TRUSTED_HOSTS": ",".join(self.TRUSTED_HOSTS),
        }
        missing = [key for key, value in required.items() if not value]
        if missing:
            raise RuntimeError(f"Configurações obrigatórias ausentes em produção: {', '.join(missing)}")
        placeholders = [
            key for key, value in required.items()
            if "substitua" in value.lower() or "seudominio" in value.lower()
        ]
        if placeholders:
            raise RuntimeError(f"Substitua os valores de exemplo antes de iniciar: {', '.join(placeholders)}")
        if len(self.JWT_SECRET) < 64 or self.JWT_SECRET.startswith("development-only"):
            raise RuntimeError("JWT_SECRET deve ter ao menos 64 caracteres em produção")
        if self.DB_USER.lower() == "root":
            raise RuntimeError("DB_USER não pode ser root em produção")


settings = Settings()
settings.validate_production_settings()
