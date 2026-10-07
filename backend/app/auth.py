import bcrypt
import hashlib
import hmac
from datetime import datetime, timedelta
from jose import jwt
from app.config import settings

def create_access_token(data: dict, expires_delta: timedelta = None):
    if not settings.JWT_SECRET:
        raise RuntimeError("JWT_SECRET não configurado")
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    if not token:
        return None

    # A chave anterior permite uma rotação sem derrubar sessões imediatamente.
    for secret in filter(None, [settings.JWT_SECRET, settings.JWT_SECRET_PREVIOUS]):
        try:
            return jwt.decode(token, secret, algorithms=[settings.JWT_ALGORITHM])
        except jwt.JWTError:
            continue
    return None


def extract_access_token(authorization: str | None, legacy_token: str | None = None):
    """Lê o padrão Authorization: Bearer e mantém compatibilidade temporária."""
    if authorization:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() == "bearer" and token.strip():
            return token.strip()
    return legacy_token

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain_password, hashed_password):
    if hashed_password.startswith("$2"):
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

    # Mantém o acesso aos usuários cadastrados antes da migração para bcrypt.
    legacy_hash = hashlib.sha256(plain_password.encode("utf-8")).hexdigest()
    return hmac.compare_digest(legacy_hash, hashed_password)
