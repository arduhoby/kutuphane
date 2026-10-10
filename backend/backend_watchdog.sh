#!/bin/bash

# Log dosyası ayarları
LOG_FILE="/tmp/kutuphane_backend_watchdog.log"
APP_LOG="/tmp/kutuphane_backend.log"

echo "=== Backend Watchdog Başlatıldı: $(date) ===" >> $LOG_FILE

# Venv aktivasyonu (start.sh içinden çağrıldığı için dizin zaten backend olmalı)
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi

# Sonsuz döngü: Süreç çökerse yeniden başlat
while true; do
    echo "[$(date)] Uvicorn başlatılıyor..." >> $LOG_FILE
    
    # Gerçek backend'i çalıştır
    uvicorn app.main:app --host 0.0.0.0 --port 8001 >> $APP_LOG 2>&1
    
    EXIT_CODE=$?
    
    echo "[$(date)] Uvicorn beklenmedik şekilde sonlandı. Çıkış kodu: $EXIT_CODE" >> $LOG_FILE
    echo "Hata detayları için $APP_LOG dosyasına bakabilirsiniz." >> $LOG_FILE
    
    # Yeniden başlatmadan önce aşırı hızlı çökme döngüsünü (crash loop) önlemek için 2 saniye bekle
    echo "[$(date)] 2 saniye içinde yeniden başlatılacak..." >> $LOG_FILE
    sleep 2
done
