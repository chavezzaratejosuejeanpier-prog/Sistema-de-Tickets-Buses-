# Cabeceras HTTP del servidor estático de la SPA

**Opción recomendada (mismo origen, sin servidor adicional):** con
`SERVIR_FRONTEND=true` la propia API entrega `frontend/dist` junto a `/api`
(`backend/app/core/spa.py`) y aplica automáticamente lo descrito en este
documento: CSP con los hashes de los scripts en línea calculados al arrancar
desde `dist/index.html` (sin recalcular a mano), `upgrade-insecure-requests`
y HSTS solo sobre HTTPS, cabeceras de seguridad, políticas de caché y
fallback de la SPA sin afectar a `/api/*` ni a estáticos inexistentes. Es la
configuración de `DESPLIEGUE_RENDER_NEON.md`.

**Alternativa:** si otro servidor (nginx, Caddy, CDN, etc.) entrega el
`index.html`, `sw.js`, `manifest.json` y `/assets/*` generados por
`npm run build`, ese servidor **debe** añadir estas cabeceras;
`SecurityHeadersMiddleware` (`backend/app/core/http.py`) solo cubre entonces
las respuestas de FastAPI.

## Cabeceras obligatorias (todas las respuestas de la SPA)

| Cabecera | Valor recomendado |
|---|---|
| `Content-Security-Policy` | ver abajo |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` (respaldo de `frame-ancestors`) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` (o `no-referrer`) |
| `Permissions-Policy` | `camera=(), microphone=(self), geolocation=(), payment=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` (solo con HTTPS) |

La política de micrófono permite el origen de la SPA para conservar las funciones de voz con permiso del navegador.

## Content-Security-Policy

```
default-src 'self';
script-src 'self' 'sha256-<HASH_SCRIPT_TEMA>';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob:;
connect-src 'self';
worker-src 'self';
manifest-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests
```

(En una sola línea en la cabecera real.)

- **`script-src`**: sin `'unsafe-inline'` ni `'unsafe-eval'`. `index.html`
  contiene un único script en línea (aplica el tema antes de pintar). Su hash
  se calcula sobre el contenido exacto entre `<script>` y `</script>` del
  `dist/index.html` generado, y debe recalcularse si ese script cambia:

  ```sh
  node -e "const h=require('fs').readFileSync('dist/index.html','utf8');const s=h.match(/<script>([\s\S]*?)<\/script>/)[1];console.log('sha256-'+require('crypto').createHash('sha256').update(s,'utf8').digest('base64'))"
  ```

  Si el hash no coincide, el navegador lo bloquea y lo informa en consola
  indicando el hash esperado; ese valor es el que debe usarse.
- **`style-src 'unsafe-inline'`**: necesario porque SweetAlert2 inyecta su
  hoja de estilos y la alerta de compra del checkout demo usa atributos
  `style`. No habilita ejecución de scripts.
- **`connect-src 'self'`**: la SPA llama a `/api` en el mismo origen (proxy
  inverso). Si la API se publica en otro origen (`VITE_API_URL`), añadir ese
  origen exacto, p. ej. `connect-src 'self' https://api.ejemplo.pe`.
- **`img-src data: blob:`**: Vite inserta imágenes pequeñas como `data:` y la
  descarga del PDF usa una URL `blob:`.

## Caché

| Recurso | `Cache-Control` |
|---|---|
| `/index.html` y rutas de la SPA (fallback) | `no-cache` |
| `/sw.js` | `no-cache` (y `Service-Worker-Allowed` no es necesario) |
| `/manifest.json`, `/favicon.svg` | `no-cache` o `max-age=3600` |
| `/assets/*` (nombres con hash) | `public, max-age=31536000, immutable` |

El fallback de la SPA (cualquier ruta desconocida → `index.html`) no debe
aplicarse a `/api/*` ni a `/assets/*` inexistentes (deben dar 404).

## Ejemplo nginx

```nginx
server {
    listen 443 ssl http2;
    root /srv/lux/dist;

    set $csp "default-src 'self'; script-src 'self' 'sha256-<HASH_SCRIPT_TEMA>'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests";

    # Común a todas las respuestas estáticas.
    add_header Content-Security-Policy $csp always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(self), geolocation=(), payment=()" always;
    add_header Cross-Origin-Opener-Policy "same-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location /api/ {
        # No registrar códigos de reserva ni parámetros de consulta.
        access_log off;
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /assets/ {
        # nginx no hereda add_header si el bloque define alguno: se repiten.
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        add_header Content-Security-Policy $csp always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        try_files $uri =404;
    }

    location = /sw.js {
        add_header Cache-Control "no-cache" always;
        add_header Content-Security-Policy $csp always;
        add_header X-Content-Type-Options "nosniff" always;
        try_files $uri =404;
    }

    location / {
        add_header Cache-Control "no-cache" always;
        add_header Content-Security-Policy $csp always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Permissions-Policy "camera=(), microphone=(self), geolocation=(), payment=()" always;
        add_header Cross-Origin-Opener-Policy "same-origin" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
        try_files $uri $uri/ /index.html;
    }
}
```

Con `location /api/` el proxy debe pasar las cabeceras reales del cliente y
la API ejecutarse con `PROXY_IPS_CONFIABLES=127.0.0.1` y `PROXY_SALTOS=1`
(`python servidor.py`; ver `backend/INICIALIZACION_SEGURA.md`).

## Notas de XSS / CSRF

- **XSS**: React escapa todo el texto renderizado y no se usa
  `dangerouslySetInnerHTML`. En SweetAlert2 la firma posicional
  `Swal.fire(título, texto, icono)` interpreta el texto como HTML; la SPA usa
  `alertaTexto()` (`src/utils/alertas.js`), que envía `titleText`/`text`.
  La única alerta con `html` (compra registrada, checkout demo) escapa cada
  valor dinámico con `escaparHtml`. La CSP anterior es la segunda barrera.
- **Sesión**: el JWT y el usuario se guardan en `sessionStorage`
  (`src/utils/sesion.js`); las sesiones antiguas en `localStorage` se
  trasladan una vez si siguen vigentes y se borran de `localStorage`.
  `sessionStorage` reduce la persistencia (se borra al cerrar la pestaña),
  pero no protege frente a un XSS: la CSP sigue siendo necesaria.
- **CSRF**: la API autentica con `Authorization: Bearer` (sin cookies) y CORS
  no habilita credenciales, por lo que un sitio ajeno no puede enviar
  peticiones autenticadas en nombre del usuario. Si en el futuro se usan
  cookies de sesión, hará falta `SameSite`, token anti-CSRF y verificación de
  `Origin`.
