# Inicialización segura del backend

Guía para preparar la API en desarrollo o en un entorno nuevo sin credenciales
predeterminadas. Ningún paso imprime ni guarda contraseñas en el repositorio.

## 1. Configuración (`backend/.env`)

1. Copia `backend/.env.example` como `backend/.env` (el archivo está en `.gitignore`).
2. Genera una clave propia y colócala en `SECRET_KEY`:

   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

   La API **no arranca** si `SECRET_KEY` falta, tiene menos de 32 caracteres o
   es un valor de ejemplo. El error indica el campo y el motivo, nunca el valor
   recibido. Usa una clave distinta en cada entorno; cambiarla invalida todas
   las sesiones abiertas.
3. `ALGORITHM` admite solo `HS256`, `HS384` o `HS512`.
   `ACCESS_TOKEN_EXPIRE_MINUTES` debe estar entre 1 y 1440.
4. En producción, `DOCS_ENABLED=false` para no publicar Swagger/ReDoc/OpenAPI.

## 2. Esquema de la base

La API crea las tablas que faltan y aplica migraciones **aditivas** al
arrancar (`app/migraciones.py`): columnas nuevas de `reservas` y el índice
único parcial de asientos `uq_ticket_ruta_asiento`, que se crea si falta o se
actualiza si tiene el predicado antiguo. Cada cambio de índice va en una
transacción explícita (en SQLite `BEGIN IMMEDIATE`): si falla, se revierte y
el índice anterior queda intacto. Si el índice no puede crearse (asientos
ocupados duplicados en datos heredados) la API **no arranca** hasta que se
corrijan esos datos.

Nada borra ni reconstruye tablas automáticamente. Si una base antigua conserva
`UNIQUE(codigo_reserva)` o un `UNIQUE(route_id, numero_asiento)` sin
predicado, la API y el seed lo avisan; la corrección (copia de seguridad,
recrear `tickets` y copiar filas) es manual.

## 3. Primer administrador (`bootstrap_admin.py`)

Solo crea la cuenta: no carga datos de ejemplo ni crea o repara tablas
(arranca la API una vez antes para crear el esquema).

Opción interactiva (recomendada; la contraseña se escribe sin eco):

```bash
cd backend
python bootstrap_admin.py --email admin@tu-dominio.example
```

Opción no interactiva (CI o contenedor), solo con variables de la sesión:

```bash
BUSS_ADMIN_EMAIL=admin@tu-dominio.example BUSS_ADMIN_PASSWORD='…' python bootstrap_admin.py
```

No guardes `BUSS_ADMIN_*` en `.env`, scripts ni historial compartido; en un
gestor de secretos, elimínalas tras crear la cuenta.

Reglas: correo válido, contraseña de 12 caracteres como mínimo y 72 bytes como
máximo (límite de bcrypt), sin espacios al inicio o final y sin el nombre del
correo. **Nunca modifica ni desactiva cuentas existentes**: si el correo ya
existe termina con error sin cambiar nada. Solo informa el correo creado.

Si una base heredada conserva cuentas de demostración con contraseñas
conocidas, un administrador debe revisarlas y desactivarlas manualmente; las
herramientas no lo hacen por su cuenta.

Los usuarios registrados desde la web siempre son `CLIENTE` (contraseña de
8 caracteres como mínimo). Los roles `ADMIN`/`VENDEDOR` solo se asignan desde
el servidor.

## 4. Datos de demostración (`seed.py`, solo desarrollo)

```bash
cd backend
DATABASE_URL=sqlite:////ruta/absoluta/dev.db python seed.py --desarrollo
```

- Exige `--desarrollo` y una `DATABASE_URL` **explícita** (entorno o `.env`)
  de tipo SQLite en archivo. Sin ellas no hace nada (código 2): no hay ruta de
  respaldo ni se usa PostgreSQL.
- Crea los buses del catálogo (si no hay ninguno) y las salidas que faltan.
- No crea, modifica ni desactiva usuarios, y no reconstruye tablas.

## 5. Arranque

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-server-header --no-access-log
```

- Detrás de un proxy (Caddy, Render…), añade `--proxy-headers
  --forwarded-allow-ips=<IP del proxy>` para que el limitador de intentos vea la
  IP real del cliente. No uses `*` salvo que el puerto solo sea accesible
  desde el proxy.
- El registro de acceso predeterminado de Uvicorn incluye la URL. El comando anterior lo desactiva para evitar registrar localizadores. El proxy también debe omitirlos.
- No uses `--reload` fuera de desarrollo.
- `GET /health` devuelve 503 si la base de datos no responde.

## 6. Controles activos

| Control | Comportamiento |
|---|---|
| Login | Cada intento reserva su cupo de forma atómica antes de verificar la contraseña. 5 fallos por IP por minuto; 10 por cuenta e IP cada 15 min; 50 por cuenta cada 15 min, salvo desde una IP con login correcto en los últimos 7 días (un atacante desde otra IP no bloquea al titular). Un acierto no borra los fallos previos de la IP. 429 con `Retry-After`. Tiempo similar exista o no la cuenta. Cuentas desactivadas no reciben token. |
| Registro | 10 intentos por IP por hora (atómico). Misma respuesta 201 exista o no el correo, también ante registros simultáneos: no permite enumerar cuentas. |
| Auth | Respuestas de `/api/auth/*` (incluidos errores) con `Cache-Control: no-store`. |
| Búsqueda | `GET /api/routes/buscar` es de solo lectura: devuelve las salidas existentes que aún no partieron (hora de Lima). Si no hay, el frontend pide `POST /api/routes/generar`, que crea solo las salidas que faltan del par y fecha (ciudades del catálogo, de hoy a 90 días, 30 solicitudes por IP por hora). Nunca se modifican horarios ni precios existentes. |
| Calendario | Fechas de búsqueda, programación y corte de venta con la hora de Lima (UTC-5), no la del servidor. El checkout se cierra en la fecha y hora reales de salida. |
| IDs | IDs mayores a 2 147 483 647 → 422 (nunca 500). |
| Limitador | En memoria y por proceso: con varios workers o réplicas se necesita un almacén compartido. |
| Tokens | JWT emitido con `iat`; verificación obligatoria de `exp` y `sub`; el rol se vuelve a leer de la base en cada petición. |
| Cabeceras | `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP y CSP estricta en la API. HSTS solo sobre HTTPS. |
| Cuerpo | Máximo 64 KiB por petición → 413. |
| Errores | 422 con mensaje en español sin devolver los datos enviados. Errores internos sin trazas ni SQL. Los logs usan la plantilla de la ruta (`/api/sales/tickets/{codigo}`), nunca la ruta real, la query ni el mensaje de la excepción. |
| SQLite | `PRAGMA foreign_keys=ON` en cada conexión. El índice único de asientos excluye `CANCELADO` y `DISPONIBLE`, igual que la consulta de disponibilidad. |

## 7. Pruebas

Las pruebas usan una base SQLite temporal y una clave ficticia; no tocan
`backend/.env` ni `buss_conectpro.db`.

```bash
cd backend && python -m unittest discover -s tests -t .
cd frontend && npm test
```
