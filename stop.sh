#!/bin/bash
# Kutuphane development sunucularini durdur

echo "Durduruluyor..."
pkill -f "uvicorn app.main:app --host 0.0.0.0 --port 8001" 2>/dev/null
pkill -f "vite --host 0.0.0.0 --port 5173" 2>/dev/null
echo "Durduruldu."
