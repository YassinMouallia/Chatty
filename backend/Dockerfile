FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN adduser --disabled-password --gecos "" appuser && mkdir -p /app/media && chmod +x /app/entrypoint.sh && chown -R appuser:appuser /app
ENTRYPOINT ["/app/entrypoint.sh"]
EXPOSE 8000
