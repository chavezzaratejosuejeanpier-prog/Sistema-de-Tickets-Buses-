from pathlib import Path
from pydantic import ValidationError, field_validator
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parents[2]

# Valores de ejemplo o triviales que nunca deben firmar tokens reales.
CLAVES_PROHIBIDAS = {
    "tu-clave-secreta-aqui",
    "changeme",
    "secret",
    "secret-key",
    "clave-secreta",
}
LARGO_MINIMO_CLAVE = 32
# Solo HMAC: evita "none" y la confusión con algoritmos asimétricos.
ALGORITMOS_PERMITIDOS = {"HS256", "HS384", "HS512"}


class Settings(BaseSettings):
    DATABASE_URL: str = f"sqlite:///{(BASE_DIR / 'buss_conectpro.db').as_posix()}"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    # Swagger/ReDoc/OpenAPI: útiles en desarrollo; desactivar en producción.
    DOCS_ENABLED: bool = True

    class Config:
        env_file = str(BASE_DIR / ".env")
        # Variables ajenas a la API (p. ej. del seed) no impiden el arranque.
        extra = "ignore"

    @field_validator("SECRET_KEY")
    @classmethod
    def _validar_clave(cls, valor: str) -> str:
        valor = (valor or "").strip()
        if valor.lower() in CLAVES_PROHIBIDAS or len(valor) < LARGO_MINIMO_CLAVE:
            raise ValueError(
                f"SECRET_KEY debe ser aleatoria y tener al menos {LARGO_MINIMO_CLAVE} caracteres. "
                "Genera una con: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )
        return valor

    @field_validator("ALGORITHM")
    @classmethod
    def _validar_algoritmo(cls, valor: str) -> str:
        valor = (valor or "").strip().upper()
        if valor not in ALGORITMOS_PERMITIDOS:
            raise ValueError(f"ALGORITHM debe ser uno de {sorted(ALGORITMOS_PERMITIDOS)}")
        return valor

    @field_validator("ACCESS_TOKEN_EXPIRE_MINUTES")
    @classmethod
    def _validar_expiracion(cls, valor: int) -> int:
        if not 1 <= valor <= 24 * 60:
            raise ValueError("ACCESS_TOKEN_EXPIRE_MINUTES debe estar entre 1 y 1440")
        return valor


class ConfiguracionInvalida(RuntimeError):
    """Error de arranque sin los valores recibidos (pueden ser secretos)."""


def describir_error_configuracion(exc: ValidationError) -> str:
    """Campo y motivo de cada error, nunca `input_value` (p. ej. SECRET_KEY)."""
    lineas = []
    for error in exc.errors(include_input=False, include_url=False, include_context=False):
        campo = ".".join(str(p) for p in error.get("loc", ())) or "configuración"
        mensaje = str(error.get("msg", "valor inválido"))
        if mensaje.startswith("Value error, "):
            mensaje = mensaje[len("Value error, "):]
        lineas.append(f"- {campo}: {mensaje}")
    return "Configuración inválida en backend/.env o variables de entorno:\n" + "\n".join(lineas)


def cargar_settings(**valores) -> Settings:
    try:
        return Settings(**valores)
    except ValidationError as exc:
        # `from None`: la traza no encadena el ValidationError con los valores.
        raise ConfiguracionInvalida(describir_error_configuracion(exc)) from None


settings = cargar_settings()
