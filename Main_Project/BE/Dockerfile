FROM python:3.12-slim


ENV LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    PYTHONIOENCODING=utf-8 \
    PYTHONUTF8=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src ./src
COPY pyproject.toml .

ENV PYTHONPATH=/app/src

CMD ["uvicorn", "finance_svc.asgi:app", "--host", "0.0.0.0", "--port", "8000"]
