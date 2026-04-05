# API Relay Service - Docker Image
FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create directories for runtime data
RUN mkdir -p /app/database /app/logs

# Expose port
EXPOSE 8080

# Environment variables (can be overridden with --env or --env-file)
ENV SERVER_HOST=0.0.0.0
ENV SERVER_PORT=8080
ENV LOG_LEVEL=INFO

# Run the application
CMD ["python", "main.py"]
