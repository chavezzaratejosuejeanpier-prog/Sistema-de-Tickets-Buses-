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
4. `ENTORNO=produccion` activa controles que impiden arrancar con una
   configuración insegura: `DATABASE_URL` explícita; PostgreSQL remoto con
   `sslmode=require|verify-ca|verify-full`; SQLite solo con
   `PERMITIR_SQLITE_PRODUCCION=true` y ruta absoluta; documentación
   desactivada (`DOCS_ENABLED` vacío o `false`); `HOSTS_PERMITIDOS` sin `*`;
   `CORS_ORIGENES` solo https. Los errores nombran el campo y el motivo,
   nunca el valor (la URL puede contener la contraseña).
5. Todas las variables están documentadas en `backend/.env.example`; la guía
   de despliegue está en `DESPLIEGUE_RENDER_NEON.md` (raíz del repositorio).

## 2. Esquema de la base (migración explícita y versionada)

La API **no ejecuta DDL** al importarse ni al arrancar. El esquema se crea y
actualiza solo con Alembic, mediante un comando explícito:

```bash
cd backend
python migrar.py --estado   # revisión actual y requerida (código 3 si hay pendientes)
python migrar.py            # aplica las revisiones pendientes
```

- Al arrancar, la API comprueba que la base esté en la revisión requerida.
  Si no lo está, registra el motivo y **no arranca**. `GET /health/ready`
  devuelve 503 con `"schema": "pending"` en ese caso.
- `migrar.py` aplica todas las revisiones en **una transacción**. En
  PostgreSQL el DDL es transaccional y se serializa con un bloqueo consultivo
  (`lock_timeout` de 15 s). En SQLite usa un motor dedicado con
  `BEGIN IMMEDIATE`: ante cualquier error se revierte todo, incluidos los
  `ALTER TABLE` y la tabla `alembic_version`.
- Nunca imprime la URL de la base ni mensajes de excepción con SQL o datos.
- Revisión base `0001_esquema_base` (`alembic_migraciones/versions/`):
  - base vacía: crea las cinco tablas con DDL explícito, sin depender de los
    modelos actuales;
  - base anterior sin versión (creada con `create_all`): crea solo lo que
    falta y aplica los pasos aditivos de `app/migraciones.py` (columnas
    `ruc`, `user_id`, `metodo_pago` de `reservas` y el índice único parcial
    `uq_ticket_ruta_asiento`, creado o actualizado si tiene el predicado
    antiguo). Si hay asientos ocupados duplicados, la migración completa se
    revierte y la API sigue sin arrancar hasta corregir esos datos.
- La revisión base no se revierte (`downgrade`): eliminaría las ventas. Ante
  un problema, se restaura una copia verificada.
- Nuevas revisiones: `alembic revision -m "descripcion"` desde `backend/`
  (usa `alembic.ini`); escribirlas compatibles con la versión anterior del
  código durante la ventana de rollback.

Una restricción histórica incompatible puede detener y revertir la migración.
Por ejemplo, `UNIQUE(codigo_reserva)` en `tickets` impide vender varios
asientos en una misma reserva. Revisa la restricción y los datos en una
copia verificada antes de decidir la corrección. Continúa con la
inicialización solo cuando `python migrar.py` termine correctamente.

**Antes de migrar una base con datos:** copia consistente y verificada
(SQLite: API de backup con la API detenida; PostgreSQL/Neon: rama o
`pg_dump`), ensayo sobre la copia y conteos por tabla antes y después.

## 3. Primer administrador (`bootstrap_admin.py`)

Solo crea la cuenta: no carga datos de ejemplo ni crea o repara tablas
(ejecuta antes `python migrar.py`).

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
export DATABASE_URL=sqlite:////ruta/absoluta/dev.db
python migrar.py && python seed.py --desarrollo
```

- Exige `--desarrollo` y una `DATABASE_URL` **explícita** (entorno o `.env`)
  de tipo SQLite en archivo. Sin ellas no hace nada (código 2): no hay ruta de
  respaldo ni se usa PostgreSQL.
- El seed comprueba la revisión del esquema. Si hay migraciones pendientes,
  termina con código 3 sin cargar datos. Con el esquema al día, crea los
  buses del catálogo (si no hay ninguno) y las salidas que faltan.
- No crea, modifica ni desactiva usuarios, y no reconstruye tablas.

## 5. Arranque

```bash
python migrar.py      # solo si hay revisiones pendientes
python servidor.py    # HOST/PORT/WEB_CONCURRENCY/LOG_* desde la configuración
```

`servidor.py` ejecuta Uvicorn sin `--reload`, sin cabecera `Server`, sin el
log de acceso de Uvicorn (incluye la URL con localizadores) y con
`log_config=None` para usar el registro JSON propio.

- **Host y puerto:** `HOST` (por defecto `127.0.0.1`) y `PORT` (por defecto
  8000). En Render, `HOST=0.0.0.0` y el `PORT` que inyecta la plataforma.
- **Proxy confiable.** Deja `PROXY_IPS_CONFIABLES` vacío hasta verificar con
  el proveedor qué direcciones IP o redes CIDR acotadas corresponden al proxy
  de entrada. Configura solo esas direcciones. Producción rechaza `*`.
  Ajusta `PROXY_SALTOS` al número de proxies confiables que escriben en
  `X-Forwarded-For`.
  La IP del cliente es la entrada número `PROXY_SALTOS` desde la derecha, no
  la de la izquierda, que el cliente puede falsificar. Con la lista vacía se
  ignoran las cabeceras `X-Forwarded-*`. El soporte de Uvicorn
  (`--proxy-headers`) queda desactivado en `servidor.py`; si lanzas `uvicorn`
  a mano usa `--no-proxy-headers`.
- **Hosts:** `HOSTS_PERMITIDOS` (400 para otros `Host`; `/health*` queda
  exento para las sondas de la plataforma).
- **CORS:** `CORS_ORIGENES` con orígenes exactos; vacío = solo mismo origen.
  El servidor de Vite en loopback solo se admite fuera de `produccion`.
- **Frontend en el mismo origen:** `SERVIR_FRONTEND=true` sirve
  `frontend/dist` (o `FRONTEND_DIST`): `/assets/*` con caché inmutable,
  `index.html`/`sw.js`/`manifest.json` con `no-cache`, fallback de la SPA para
  rutas de navegación, 404 para estáticos inexistentes y para `/api/*`, y la
  CSP del documento con los hashes de sus scripts en línea calculados al
  arrancar. Si falta el build, la API no arranca.
- **Registro:** JSON en stderr (`LOG_FORMAT=json`) con `request_id`, método,
  plantilla de ruta, estado y duración; nunca la ruta real, la query, cuerpos
  ni mensajes de excepción. Cada respuesta lleva `X-Request-ID`.
- **Salud:** `GET /health/live` (proceso), `GET /health` (base de datos) y
  `GET /health/ready` (base y esquema al día). 503 si fallan.
- Un solo proceso (`WEB_CONCURRENCY=1`) mientras el limitador de intentos sea
  en memoria.

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

### PostgreSQL real aislado

`tests/test_postgres_real.py` ejecuta migración, ciclo completo con checkout
de demostración y concurrencia contra un servidor PostgreSQL real. Sin
servidor configurado se omite. Nunca usa `DATABASE_URL` ni `backend/.env`.

Opción A, contenedor desechable (el nombre de la base debe contener `test`
o `prueba`; cada clase crea y elimina su propio esquema):

```bash
docker run --rm -d --name buss-pg-prueba -e POSTGRES_PASSWORD=clave-sintetica \
  -e POSTGRES_DB=buss_prueba -p 127.0.0.1:55432:5432 postgres:17-alpine
cd backend
BUSS_TEST_POSTGRES_URL=postgresql://postgres:clave-sintetica@127.0.0.1:55432/buss_prueba \
  python -m unittest tests.test_postgres_real -v
docker stop buss-pg-prueba
```

Opción B, clúster efímero local (requiere `initdb` y `pg_ctl`, en PATH o en
`PG_BIN`; escucha solo en un socket Unix temporal y se borra al terminar):

```bash
cd backend
BUSS_TEST_POSTGRES_EFIMERO=1 python -m unittest tests.test_postgres_real -v
```
