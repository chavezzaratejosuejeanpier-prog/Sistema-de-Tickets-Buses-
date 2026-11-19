# Guía de despliegue: Render Free + Neon PostgreSQL (TLS)

Guía para publicar **una demostración** del sistema: FastAPI sirve el build
de React y la API en el **mismo origen** (`/` y `/api`), con PostgreSQL
administrado en Neon por TLS. Este documento no despliega nada: describe los
pasos para que el responsable los ejecute con sus propias cuentas.

> **Alcance.** El checkout es de **demostración**: registra la compra con
> `metodo_pago=SIMULADO` y no cobra. Render Free y el plan gratuito de Neon
> sirven para pruebas y demos, no para venta real. Antes de captar datos
> personales reales revisa los pendientes de `AUDITORIA_PRODUCCION.md`
> (pasarela, privacidad, backups, sesiones).

> **Sin verificar.** Esta guía **no** ha verificado contra los proveedores:
> los límites de los planes gratuitos de Render y Neon (horas de cómputo,
> almacenamiento, suspensión por inactividad, ventana de restauración,
> conexiones), ni el comportamiento del proxy de Render (direcciones de
> ingreso, número de entradas que añade a `X-Forwarded-For`, existencia de
> red privada entre servicios). Consulta la documentación vigente de ambos
> proveedores antes de cada despliegue y no tomes como dato ninguna cifra
> que no hayas comprobado.

---

## 1. Arquitectura

```
Navegador ──HTTPS──> Render (proxy TLS) ──HTTP──> python servidor.py (FastAPI)
                                                     ├─ /            frontend/dist (SPA, PWA)
                                                     ├─ /api/*       API
                                                     └─ /health/*    sondas
                                     FastAPI ──TLS (verify-full)──> Neon PostgreSQL (rol buss_app)
```

- Un único servicio web de Render (runtime Python) compila el frontend y
  ejecuta la API con un proceso (`WEB_CONCURRENCY=1`: el limitador de intentos
  vive en memoria).
- Mismo origen: no hace falta CORS (`CORS_ORIGENES` vacío) y la CSP usa
  `connect-src 'self'`.
- Secretos **solo en el backend**: `DATABASE_URL` (rol restringido
  `buss_app`) y `SECRET_KEY` son variables del servicio; ninguna variable
  `VITE_*` lleva secretos (el build falla si un nombre lo parece) y el
  bundle no incluye URLs de loopback.
- El esquema solo cambia con `python migrar.py` (Alembic), ejecutado **desde
  la máquina de confianza** con el rol migrador. La API **no** ejecuta DDL al
  arrancar y **no arranca** si la base no está migrada.
- **Sin datos de demostración en producción**: `seed.py` se niega a
  ejecutarse con `ENTORNO=produccion` y la API nunca genera el programa demo
  al arrancar en producción. La flota y las salidas las registra un
  administrador (`POST /api/buses`, `POST /api/routes`).

## 2. Requisitos previos y pruebas locales

- Repositorio accesible desde Render (GitHub/GitLab). El usuario gestiona los
  commits; esta guía no requiere cambios de Git.
- Cuenta de Render y cuenta de Neon, ambas con MFA.
- Máquina local de confianza con Python 3 (la misma versión que fijarás en
  `PYTHON_VERSION`), Node LTS con npm y `psql` (cliente PostgreSQL).

### 2.1 Instalación

```bash
# Backend (entorno virtual dentro de backend/, ignorado por Git)
cd backend
python -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# Frontend
cd ../frontend
npm ci
```

### 2.2 Pruebas (SQLite temporal, datos sintéticos)

```bash
cd backend && . .venv/bin/activate
python -m unittest discover -s tests -t .
cd ../frontend
npm run lint && npm test && npm run build
```

Sin servidor PostgreSQL configurado, `tests/test_postgres_real.py` se omite
(lo indica en la salida). **No despliegues sin ejecutarla** (sección 2.3).

### 2.3 PostgreSQL real con clúster sintético efímero

La prueba crea un clúster temporal que escucha **solo en un socket Unix** de
un directorio temporal, migra, ejecuta un ciclo completo con checkout de
demostración y concurrencia, y lo destruye al terminar. Nunca usa
`DATABASE_URL` ni `backend/.env`.

**Opción A: PostgreSQL de Arch extraído en local, sin instalarlo** (probado
con PostgreSQL 18.7 de los paquetes de Arch Linux). Descarga los paquetes
`postgresql` y `postgresql-libs` de la misma versión desde un espejo oficial
(o con `pacman -Sw`) a un directorio vacío y extráelos ahí:

```bash
mkdir -p "$HOME/pg-arch" && cd "$HOME/pg-arch"
# Paquetes ya descargados en este directorio, p. ej.:
#   postgresql-18.7-*.pkg.tar.zst  postgresql-libs-18.7-*.pkg.tar.zst
for paquete in postgresql-*.pkg.tar.zst; do tar --zstd -xf "$paquete" -C "$HOME/pg-arch"; done
"$HOME/pg-arch/usr/bin/initdb" --version   # debe mostrar 18.7

cd /ruta/al/repositorio/backend && . .venv/bin/activate
PG_BIN="$HOME/pg-arch/usr/bin" LD_LIBRARY_PATH="$HOME/pg-arch/usr/lib" \
  BUSS_TEST_POSTGRES_EFIMERO=1 python -m unittest tests.test_postgres_real -v
```

Los binarios de PostgreSQL localizan `share/` y `lib/` relativos a su propia
ruta, por eso funcionan extraídos. `LD_LIBRARY_PATH` solo hace falta si el
sistema no tiene `libpq` instalada. Si alguna prueba aparece como *skipped*,
la integración **no** se ejecutó.

**Opción B: PostgreSQL del sistema** (`initdb`/`pg_ctl` en `PATH` o en
`/usr/lib/postgresql/*/bin`):

```bash
cd backend && . .venv/bin/activate
BUSS_TEST_POSTGRES_EFIMERO=1 python -m unittest tests.test_postgres_real -v
```

**Opción C: contenedor desechable** (el nombre de la base debe contener
`test` o `prueba`): ver `backend/INICIALIZACION_SEGURA.md`, sección 7.

## 3. Neon: proyecto, roles y TLS

1. **Proyecto.** Crea un proyecto en la región más cercana a la de Render.
   Versión de PostgreSQL: la más reciente estable que ofrezca Neon (ensaya
   localmente con la misma versión mayor si es posible).
2. **Rol migrador y base.** Desde la consola de Neon (*Roles*) crea
   `buss_migrador` y, en *Databases*, la base `buss` con propietario
   `buss_migrador`. Los roles creados desde el panel **no deben suponerse
   restringidos** (en Neon suelen recibir privilegios administrativos): por
   eso este rol solo se usa desde la máquina de confianza para migrar y
   administrar permisos. **Nunca** se configura en Render, ni como
   `DATABASE_URL` ni en otra variable.
3. **Rol de servicio por SQL (mínimos privilegios).** El rol de la API se
   crea **con SQL**, no desde el panel, para que no herede membresías
   ampliadas. Conéctate con `psql` como `buss_migrador` (URL directa con TLS,
   ver paso 5) y ejecuta:

   ```sql
   CREATE ROLE buss_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
     NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 10;
   \password buss_app
   ```

   `\password` pide la contraseña sin eco y envía solo su hash (no queda en
   el historial ni en registros de sentencias). Genera una contraseña larga y
   aleatoria (`python -c "import secrets; print(secrets.token_urlsafe(32))"`);
   Neon puede rechazar contraseñas de baja entropía. **No** concedas a
   `buss_app` ningún rol (`GRANT <rol> TO buss_app`), ni `neon_superuser`, ni
   la propiedad de objetos.
4. **Primera migración** (sección 5, paso 2) y después, como
   `buss_migrador`, los permisos de datos. Se conceden **tabla por tabla**,
   sin `ALTER DEFAULT PRIVILEGES`: una tabla nueva no recibe permisos hasta
   que se revisen y concedan explícitamente.

   ```sql
   -- Base y esquema: nadie más que los roles indicados.
   REVOKE ALL ON DATABASE buss FROM PUBLIC;
   GRANT CONNECT ON DATABASE buss TO buss_app;
   REVOKE CREATE ON SCHEMA public FROM PUBLIC;
   GRANT USAGE ON SCHEMA public TO buss_app;

   -- Datos: la API solo lee, inserta y actualiza (no borra ni trunca).
   REVOKE ALL ON ALL TABLES IN SCHEMA public FROM buss_app;
   GRANT SELECT, INSERT, UPDATE ON users, buses, routes, tickets, reservas TO buss_app;
   GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO buss_app;

   -- Versión del esquema: SOLO LECTURA para la API (la comprueba al arrancar
   -- y en /health/ready). Solo migrar.py, con buss_migrador, la escribe.
   GRANT SELECT ON alembic_version TO buss_app;
   ```

   Verificación (todas deben dar el resultado indicado):

   ```sql
   SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolreplication, rolinherit
     FROM pg_roles WHERE rolname = 'buss_app';                       -- todo f
   SELECT r.rolname FROM pg_auth_members m
     JOIN pg_roles r ON r.oid = m.roleid
     JOIN pg_roles u ON u.oid = m.member WHERE u.rolname = 'buss_app'; -- 0 filas
   SELECT has_table_privilege('buss_app', 'alembic_version', 'INSERT, UPDATE, DELETE, TRUNCATE'); -- f
   SELECT has_table_privilege('buss_app', 'tickets', 'DELETE, TRUNCATE');                           -- f
   SELECT has_schema_privilege('buss_app', 'public', 'CREATE');                                     -- f
   SELECT has_database_privilege('buss_app', 'buss', 'CREATE, TEMPORARY');                          -- f
   ```

   La API además usa bloqueos consultivos (`pg_advisory_xact_lock`), que no
   requieren permisos adicionales. Si una revisión futura crea tablas o
   necesita otro privilegio, repite este paso con la tabla concreta.
5. **Cadena de conexión con TLS.** Copia la cadena **directa** (host sin
   `-pooler`) y ajusta los parámetros. Para Render, la del rol `buss_app`:

   ```text
   postgresql://buss_app:<CONTRASEÑA>@ep-xxxx.<region>.aws.neon.tech/buss?sslmode=verify-full&sslrootcert=system&channel_binding=require
   ```

   - `sslmode=verify-full` cifra y valida el certificado y el nombre del
     servidor; `sslrootcert=system` usa los certificados raíz del sistema
     (requiere libpq 16 o superior). Si el entorno no lo admite, usa como
     mínimo `sslmode=require`. La API rechaza en producción cualquier
     PostgreSQL sin `sslmode=require|verify-ca|verify-full`.
   - `channel_binding=require` protege la autenticación SCRAM.
   - `postgres://` o `postgresql://` se normalizan solos a
     `postgresql+psycopg2://`.
   - **Pooler de Neon (`-pooler`)**: admite la API (transacciones cortas,
     bloqueos `xact`), pero no el parámetro `options`; deja
     `DB_STATEMENT_TIMEOUT_MS=0`. Para `migrar.py` usa siempre la conexión
     directa.
6. **Inactividad.** Neon suspende el cómputo sin uso y cierra conexiones; la
   API recicla conexiones (`DB_POOL_RECYCLE=300`) y las comprueba antes de
   usarlas (`pool_pre_ping`). La primera petición tras la suspensión tarda
   más.

## 4. Render: servicio web

Crea **New → Web Service** con estos valores (o el Blueprint del anexo A):

| Campo | Valor |
|---|---|
| Runtime | Python 3 |
| Branch | `main` (o la que autorice el usuario) |
| Root Directory | vacío (raíz del repositorio) |
| Build Command | `cd frontend && npm ci --include=dev && npm run build && cd ../backend && pip install -r requirements.txt` |
| Start Command | `cd backend && python servidor.py` |
| Instance Type | Free |
| Health Check Path | `/health/live` |
| Auto-Deploy | Off hasta validar el procedimiento (recomendado) |

- El Build Command **no** migra ni carga datos: la migración es un paso
  explícito desde la máquina de confianza (sección 5).
- `--include=dev` asegura que Vite se instale aunque la plataforma defina
  `NODE_ENV=production`. Todo `vite build` se valida como producción (con
  cualquier `--mode`): rechaza `VITE_API_URL` con loopback, parámetros o
  fragmentos.
- Health check en `/health/live` (no consulta la base): una sonda frecuente a
  `/health/ready` mantendría despierto el cómputo de Neon. Usa
  `/health/ready` para verificaciones manuales.

### 4.1 Variables de entorno (panel *Environment* de Render)

| Variable | Valor | Notas |
|---|---|---|
| `ENTORNO` | `produccion` | Activa las validaciones de arranque. |
| `DATABASE_URL` | URL de **`buss_app`** con `sslmode=verify-full…` | Secreto. Nunca la del migrador. |
| `SECRET_KEY` | botón *Generate* de Render o `python -c "import secrets; print(secrets.token_urlsafe(48))"` | Secreto, distinto por entorno. |
| `HOST` | `0.0.0.0` | Render inyecta `PORT` (no lo definas). |
| `SERVIR_FRONTEND` | `true` | Sirve `frontend/dist` en el mismo origen. |
| `HOSTS_PERMITIDOS` | `SERVICIO.onrender.com` (y el dominio propio, si lo hay, separado por comas) | **Explícito**: copia el nombre exacto que muestra Render. No dependas de que la plataforma lo añada sola. |
| `PROXY_IPS_CONFIABLES` | **vacío** | Ver 4.2. Nunca `*`. |
| `PROXY_SALTOS` | `1` | Solo se usa si `PROXY_IPS_CONFIABLES` tiene valor. |
| `PROGRAMA_DEMO_AL_ARRANCAR` | `false` | Sin datos de demostración en producción (la API lo ignora igualmente en `produccion`). |
| `DOCS_ENABLED` | `false` | En producción no se admite `true`. |
| `CORS_ORIGENES` | vacío | Mismo origen. |
| `WEB_CONCURRENCY` | `1` | Limitador en memoria. |
| `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` | `3` / `2` | Ajusta al límite de conexiones de tu plan y al `CONNECTION LIMIT` de `buss_app`. |
| `DB_POOL_RECYCLE` | `300` | |
| `LOG_LEVEL` / `LOG_FORMAT` | `INFO` / `json` | Logs sin ruta real, query, IDs del cliente, URL de la base ni mensajes de excepción. |
| `PYTHON_VERSION` | la misma versión 3.x con la que pasaron las pruebas locales | Fíjala completa. |
| `NODE_VERSION` | una LTS compatible con Vite 5 | |

**Nunca** definas en Render la URL del rol migrador ni variables `VITE_*`
con secretos (se publican en el JavaScript del navegador). `VITE_API_URL`
no hace falta (por defecto `/api`).

### 4.2 Proxy confiable (`PROXY_IPS_CONFIABLES`)

La API solo interpreta `X-Forwarded-For`/`X-Forwarded-Proto` si la conexión
llega desde una IP o red listada en `PROXY_IPS_CONFIABLES`. En producción
solo se admiten **IP/CIDR explícitos y acotados** del ingreso confirmado del
proveedor: la configuración rechaza `*`, `0.0.0.0/0`, `::/0` y prefijos
demasiado amplios.

- **Mientras no tengas confirmadas las direcciones de ingreso de Render,
  déjala vacía.** No uses `*`: Render puede ofrecer red privada entre
  servicios, y otro servicio de esa red podría conectarse directamente al
  puerto de la API y falsificar `X-Forwarded-For`.
- Efecto de dejarla vacía: la API ve como cliente la IP del proxy, por lo que
  el limitador de intentos agrupa a todos los usuarios que entren por el
  mismo nodo (pueden bloquearse entre sí durante un minuto) y las respuestas
  no reciben HSTS si el proxy no reenvía el esquema por otra vía. Es la
  opción segura para una demo.
- Cuando el proveedor documente o confirme por soporte los rangos de su
  ingreso hacia tu servicio, lista **solo esos** rangos (p. ej.
  `10.20.0.0/16`, valor ficticio) y verifica `PROXY_SALTOS` con la
  sección 6.3.

## 5. Primer despliegue (orden obligatorio)

1. **Neon listo** (sección 3, pasos 1-3 y 5).
2. **Migrar desde la máquina de confianza** con el rol migrador. La URL va
   solo en la variable de la sesión (no en archivos ni en el historial
   compartido):

   ```bash
   cd backend && . .venv/bin/activate
   read -rs DATABASE_URL && export DATABASE_URL     # pega la URL de buss_migrador, sin eco
   export SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(48))')"  # solo para cargar la configuración
   export ENTORNO=produccion HOSTS_PERMITIDOS=migracion.invalid
   python migrar.py --estado
   python migrar.py
   unset DATABASE_URL SECRET_KEY ENTORNO HOSTS_PERMITIDOS
   ```

   `migrar.py` no imprime la URL; muestra el motor y las revisiones. **No**
   ejecutes `seed.py`: en producción se niega a ejecutarse.
3. **Permisos de `buss_app`** (sección 3, paso 4) y su verificación.
4. **Primer administrador** (opcional, solo si se usará el panel). Con la URL
   de **`buss_app`** en la sesión, igual que en el paso 2:

   ```bash
   python bootstrap_admin.py --email admin@tu-dominio.example   # contraseña sin eco
   ```

5. **Crear el servicio en Render** (sección 4) y lanzar el deploy manual.
6. **Verificar** (sección 6). La API no arranca si la base no está en la
   revisión requerida: en los logs aparece `ejecuta python migrar.py`. Un
   fallo de conexión se registra solo con el tipo de error y los marcos de
   código, sin URL ni mensaje.
7. **Datos operativos:** el administrador registra buses y salidas desde el
   panel. No se cargan datos de demostración en producción.

## 6. Verificación tras el despliegue

Sustituye `https://SERVICIO.onrender.com` por la URL real. La primera
petición puede tardar mientras Render y Neon despiertan.

### 6.1 Salud y API

```bash
B=https://SERVICIO.onrender.com
curl -s  $B/health/live                    # {"status":"ok"}
curl -s  $B/health/ready                   # {"status":"ok","database":"connected","schema":"ok"}
curl -s  $B/api/routes/ciudades | head -c 200
curl -s -o /dev/null -w '%{http_code}\n' $B/docs          # 404
curl -s  $B/api/no-existe                  # {"detail":"Not Found"} con 404
```

### 6.2 SPA, PWA y cabeceras

```bash
curl -sI $B/                 # 200, Cache-Control: no-cache, Content-Security-Policy con 'sha256-…',
                             # X-Request-ID (generado por el servidor)
curl -sI $B/asientos/1       # 200 text/html (fallback de la SPA)
curl -sI $B/sw.js            # Cache-Control: no-cache
curl -sI $B/assets/no-existe.js   # 404 (no devuelve HTML)
curl -sI $B/api/auth/login   # 405 + Cache-Control: no-store
curl -s -o /dev/null -w '%{http_code}\n' -H 'Host: otro.example' $B/api/routes/ciudades   # 400
curl -sI -H 'X-Request-ID: dato-del-cliente-123' $B/health/live | grep -i x-request-id    # otro valor (hex)
```

En un navegador limpio: portada y tutorial inicial, búsqueda, selección de
asientos, registro/login, checkout de demostración (aviso de pago simulado),
Mis Pasajes y descarga del PDF, modo oscuro, PetFriendly y sus PDF. En las
herramientas de desarrollo: sin errores de CSP en consola, service worker
activo, `/api/*` fuera de Cache Storage y aviso offline al cortar la red.
`Strict-Transport-Security` solo aparece si la API recibe el esquema https
(requiere un proxy confiable configurado, sección 4.2).

### 6.3 IP real detrás del proxy (solo con `PROXY_IPS_CONFIABLES` definido)

Con `PROXY_IPS_CONFIABLES` vacío, el paso 2 responderá 429: es el efecto
esperado y documentado en 4.2. Con rangos confirmados y datos sintéticos:

1. Desde una red, 6 intentos de login fallidos seguidos con un correo
   ficticio → el 6.º responde **429**.
2. Desde otra red (p. ej. datos móviles), un login fallido inmediato →
   **401**, no 429. Si responde 429, el proxy no está en los rangos listados
   o `PROXY_SALTOS` no coincide.
3. Desde la primera red, tras esperar el minuto, repite el paso 1 enviando
   `-H 'X-Forwarded-For: 203.0.113.50'` con valores distintos en cada
   intento: debe seguir llegando el 429 (la cabecera falsificada se ignora).

### 6.4 Logs

En *Logs* de Render cada petición aparece como JSON con `request_id`
(generado por el servidor), `metodo`, `ruta` (plantilla, p. ej.
`/api/sales/tickets/{codigo}`), `estado` y `duracion_ms`. Comprueba que no
aparecen códigos de reserva, correos, documentos, tokens, la URL de la base
ni mensajes de excepción.

## 7. Actualizaciones posteriores

1. Pruebas locales completas (sección 2, incluida PostgreSQL real).
2. Si el cambio incluye una revisión nueva en `alembic_migraciones/versions`:
   - crea una **rama de Neon** (copia instantánea) o un `pg_dump` cifrado
     antes de migrar;
   - ensaya `python migrar.py` sobre la rama;
   - migra la base principal desde la máquina de confianza (paso 5.2) y
     aplica los permisos de las tablas nuevas (sección 3, paso 4). Las
     revisiones deben ser compatibles con la versión anterior del código.
3. Deploy manual en Render y verificación (sección 6).

La migración **no** se automatiza en el build ni en el arranque de Render:
el secreto del migrador nunca se guarda en Render.

## 8. Rollback y recuperación

- **Aplicación:** en Render, *Rollback* a un deploy anterior. Funciona si las
  migraciones aplicadas son compatibles con ese código (regla del paso 7.2).
- **Esquema:** la revisión base no tiene `downgrade` (eliminaría datos). Para
  revertir un cambio de esquema, crea una revisión correctiva nueva o
  restaura la rama/copia previa.
- **Datos:** Neon conserva un historial limitado según el plan (ventana sin
  verificar: consulta tu plan). Complementa con `pg_dump` periódico cifrado
  fuera de Neon, hecho desde la máquina de confianza, y ensaya la
  restauración en una rama:

  ```bash
  read -rs URL_MIGRADOR && export URL_MIGRADOR
  pg_dump --format=custom --no-owner "$URL_MIGRADOR" > buss-AAAAMMDD.dump   # cifrar y guardar fuera
  unset URL_MIGRADOR
  ```

## 9. Dominio propio y HTTPS

1. En Render, *Settings → Custom Domains*: añade el dominio y crea en el DNS
   el registro que indique Render. Render emite y renueva el certificado TLS.
2. Añade el dominio a `HOSTS_PERMITIDOS` (separado por comas, junto al
   `*.onrender.com` del servicio) y redeploy.
3. HSTS (`max-age=31536000; includeSubDomains`) solo se envía cuando la API
   recibe el esquema https: confirma que todos los subdominios sirven HTTPS
   antes de usar el dominio en producción.

## 10. Limitaciones conocidas de esta configuración

- Render Free se suspende tras un periodo sin tráfico y tarda en despertar;
  el sistema de archivos es efímero (los PDF se generan en memoria). SQLite
  no es viable aquí. Límites exactos de ambos planes: **sin verificar**.
- Limitador de intentos en memoria: se reinicia con cada despliegue o
  suspensión y no se comparte entre instancias. Sin proxy confiable
  configurado agrupa a los clientes por IP del proxy (sección 4.2).
- Sesiones JWT en `sessionStorage`, sin revocación individual.
- Pago simulado: no hay pasarela, webhooks ni comprobantes fiscales.
- Sin alertas ni métricas externas: solo logs de Render.

## Anexo A. Blueprint de referencia (`render.yaml`)

No se incluye como archivo para evitar altas accidentales. Si el responsable
decide usar Blueprints, puede partir de esto. Las variables con
`sync: false` se piden en el panel al crear el Blueprint:
`DATABASE_URL` (URL de `buss_app`) y `HOSTS_PERMITIDOS` (nombre exacto
`SERVICIO.onrender.com` y, si existe, el dominio propio).

```yaml
services:
  - type: web
    name: buss-connectpro
    runtime: python
    plan: free
    branch: main
    autoDeploy: false
    buildCommand: cd frontend && npm ci --include=dev && npm run build && cd ../backend && pip install -r requirements.txt
    startCommand: cd backend && python servidor.py
    healthCheckPath: /health/live
    envVars:
      - key: ENTORNO
        value: produccion
      - key: DATABASE_URL          # URL de buss_app (rol restringido), nunca la del migrador
        sync: false
      - key: SECRET_KEY
        generateValue: true
      - key: HOSTS_PERMITIDOS      # explícito: SERVICIO.onrender.com[,dominio-propio]
        sync: false
      - key: HOST
        value: 0.0.0.0
      - key: SERVIR_FRONTEND
        value: "true"
      - key: PROGRAMA_DEMO_AL_ARRANCAR
        value: "false"
      - key: DOCS_ENABLED
        value: "false"
      - key: WEB_CONCURRENCY
        value: "1"
      - key: DB_POOL_SIZE
        value: "3"
      - key: DB_MAX_OVERFLOW
        value: "2"
      - key: LOG_FORMAT
        value: json
      - key: PYTHON_VERSION
        sync: false
      - key: NODE_VERSION
        sync: false
      # PROXY_IPS_CONFIABLES se omite (vacío) hasta confirmar los rangos de
      # ingreso del proveedor; nunca "*". Ver sección 4.2.
```

## Anexo B. Ensayo local con el mismo modo de producción

Desarrollo con datos de demostración (SQLite, nunca en producción):

```bash
cd frontend && npm ci && npm run build
cd ../backend && . .venv/bin/activate
export SECRET_KEY="$(python -c 'import secrets; print(secrets.token_urlsafe(48))')"
export DATABASE_URL="sqlite:////tmp/buss-ensayo.db"
export SERVIR_FRONTEND=true LOG_FORMAT=texto
python migrar.py                    # 1) esquema (paso explícito)
python seed.py --desarrollo         # 2) datos demo; exige el esquema al día
python servidor.py                  # http://127.0.0.1:8000 sirve la SPA y /api
```

Para ensayar `ENTORNO=produccion` en local usa una PostgreSQL de prueba (en
`localhost` se admite sin TLS), `HOSTS_PERMITIDOS=127.0.0.1,localhost`,
`PROGRAMA_DEMO_AL_ARRANCAR=false` y `PROXY_IPS_CONFIABLES` vacío. Sin seed:
crea los datos con un administrador desde el panel.
