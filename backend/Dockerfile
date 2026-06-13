# Build context must be the project root: docker build -f backend/Dockerfile .
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the Django app and the poster generator (needed by Celery workers)
COPY backend/ .
COPY poster_generators/ /app/poster_generators/

EXPOSE 8000

CMD ["gunicorn", "edgedelivery.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--timeout", "120"]
