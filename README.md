# BUSS ConectPro - Sistema de Venta de Pasajes

Arquitectura desacoplada React + FastAPI creada el 2026-08-22.

## Estructura

```
/backend
  /app
    main.py              # FastAPI entry + CORS + routers
    database.py          # SQLAlchemy + get_db
    core/config.py       # Settings (.env)
    /models  bus.py, route.py, ticket.py, user.py
    /schemas bus_schema.py, ticket_schema.py, user_schema.py
    /routers buses.py, routes.py, sales.py, auth.py
    /services ticket_service.py
  requirements.txt
  .env.example
/frontend
  /src
    App.jsx, main.jsx, index.css
    /components/common  Button.jsx, Input.jsx
    /components/layout  Navbar.jsx, Footer.jsx
    /components/bus     Seat.jsx, BusMap.jsx, FloorTab.jsx
    /pages SearchRoutes.jsx, SeatSelection.jsx, Checkout.jsx, Login.jsx, Dashboard.jsx
    /services api.js
    /context AuthContext.jsx
  tailwind.config.js (colores corporativos azul marino #0f2a44)
```

## Cómo correr

Backend:
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# docs en http://localhost:8000/docs
```

Frontend:
```bash
cd frontend
npm install
npm run dev # http://localhost:5173
```

## Flujo
1. SearchRoutes -> GET /api/routes/buscar?origen=&destino=
2. SeatSelection -> GET /api/routes/{id}/asientos + BusMap interactivo
3. Checkout -> POST /api/sales/checkout (verifica asiento no vendido, genera codigo BC-XXXX)

## Nota
El proyecto anterior ServiceHub (Spring Boot) queda en /src, pom.xml. Si ya no se necesita, puede archivarse. El nuevo sistema usa FastAPI + React desacoplado.
