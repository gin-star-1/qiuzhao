FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN groupadd --system app && useradd --system --gid app --create-home app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chown -R app:app /app

USER app

EXPOSE 8000

CMD ["sh", "-c", "exec gunicorn --workers \"${GUNICORN_WORKERS:-2}\" --threads \"${GUNICORN_THREADS:-4}\" --bind 0.0.0.0:8000 --access-logfile - --error-logfile - app:app"]
