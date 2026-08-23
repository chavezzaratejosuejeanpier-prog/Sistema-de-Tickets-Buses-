# BUSS ConectPro - Sistema de Gestión y Venta de Pasajes

Proyecto académico enfocado en la gestión, reserva y venta de boletos para transporte interprovincial. El sistema implementa una arquitectura moderna cliente-servidor garantizando una experiencia de usuario fluida y un manejo seguro en la selección de asientos.

## Equipo de Desarrollo

* **Josue Jeanpier Chavez Zarate**
* **Jean Franco Flores Peña**
* **Andres Alfredo Salas Ahen**

##  Stack Tecnológico

* **Frontend:** React, Vite, Tailwind CSS, React Router DOM.
* **Backend:** Python, FastAPI, Postgresql.
* **Arquitectura:** Patrón API RESTful desacoplada.

## Organización del Repositorio

El proyecto está dividido en dos módulos principales para mantener el código limpio y escalable:

* `backend/`: Contiene el servidor de FastAPI, la configuración de la base de datos, los modelos ORM y los endpoints.
* `frontend/`: Contiene la interfaz de usuario, maquetación, componentes reutilizables y la conexión HTTP mediante Axios.

## Instrucciones de Despliegue Local

### 1. Iniciar el Servidor (Backend)
Abre tu terminal en la raíz del proyecto y ejecuta:
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
