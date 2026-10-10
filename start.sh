#!/bin/bash
# Kutuphane - Development ortamini baslat
# Backend'i 8001'de, Frontend'i 5173'te calistirir

echo "=== Kutuphane Development Server ==="
echo ""

# Backend
echo "[1/2] Backend baslatiliyor (port 8001)..."
cd "$(dirname "$0")/backend"
source venv/bin/activate
nohup ./backend_watchdog.sh > /dev/null 2>&1 &
BACKEND_PID=$!
echo "  PID: $BACKEND_PID"

# Frontend
echo "[2/2] Frontend baslatiliyor (port 5173)..."
cd "$(dirname "$0")/../frontend"
nohup npx vite --host 0.0.0.0 --port 5173 > /tmp/kutuphane_frontend.log 2>&1 &
FRONTEND_PID=$!
echo "  PID: $FRONTEND_PID"

echo ""
echo "=== Hazir! ==="
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8001"
echo "  API Docs: http://localhost:8001/docs"
echo ""
echo "Durdurmak icin: kill $BACKEND_PID $FRONTEND_PID"
