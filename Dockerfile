# Force rebuild v2
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install && npm cache clean --force

COPY frontend/ ./
RUN npm run build


FROM python:3.11-slim AS production

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY backend/pyproject.toml ./backend/pyproject.toml
COPY backend/app ./backend/app
COPY backend/alembic ./backend/alembic
COPY backend/alembic.ini ./backend/alembic.ini

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir ./backend

COPY --from=frontend-builder /app/frontend/dist ./backend/app/static

WORKDIR /app/backend

EXPOSE 8000

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
