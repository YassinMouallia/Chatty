# Chatty

A small real-time chat application built with React, Django REST Framework, Django Channels, and PostgreSQL.

## Documentation

- [Architecture documentation](docs/ARCHITECTURE.md)
- [Feature documentation](docs/FEATURES.md)

## Features

- Username/password registration and JWT login
- Private one-to-one conversations
- Real-time messages over authenticated WebSockets
- Username search and conversation sidebar
- Image attachments up to 10 MB
- Pin and delete message actions
- PostgreSQL persistence and Redis-backed Channels
- Production frontend build served by Nginx

## Run locally with Docker

```bash
cp .env.example .env
# Set DJANGO_SECRET_KEY and POSTGRES_PASSWORD in .env
docker compose up --build
```

Open `http://localhost:5173`. Create two accounts in separate browser sessions, then use the Django admin or API to create a conversation. The API endpoints are:

- `POST /api/auth/register/`
- `POST /api/auth/token/`
- `GET /api/users/?search=...`
- `POST /api/conversations/` with `{"username":"other-user"}`
- `GET/POST /api/conversations/<id>/messages/`

If you run the frontend with `cd frontend && npm run dev`, Vite proxies `/api` and `/ws` to Django, so browser CORS is not involved during local development. The Django server must still be running on port `8000`.

For a real deployment, put TLS in front of the services, use a managed PostgreSQL/Redis instance, keep secrets outside source control, and set explicit `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, and `DJANGO_DEBUG=False`.

## Local development without Docker

Create a PostgreSQL database, export the variables in `.env`, then run:

```bash
.venv/bin/python backend/manage.py migrate
.venv/bin/python backend/manage.py runserver
cd frontend && npm run dev
```
