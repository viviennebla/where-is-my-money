FROM python:3.11-slim

WORKDIR /app

ENV VENV=/app/.venv
RUN python -m venv $VENV
ENV PATH="$VENV/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN mkdir -p /app/data /app/uploads

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
