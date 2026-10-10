import shutil
import os
from kutuphane import fullzaman
import logging

def setup_yedekle_ve_kopyala(dosya_adı, yedek_dizin):
    try:
        # Kaynak dosyanın yolunu oluşturun
        kaynak_dosya_yolu = dosya_adı

        # Yedek dosyanın yolunu oluşturun (yedek dizin + dosya adı)
        yedek_dosya_yolu = os.path.join(yedek_dizin, os.path.basename(dosya_adı))

        # Dosyayı yedek dizinine kopyala
        shutil.copy(kaynak_dosya_yolu, yedek_dosya_yolu)

        print(f"{dosya_adı} dosyası {yedek_dizin} dizinine başarıyla kopyalandı.")
    except FileNotFoundError:
        logging.error(f"{dosya_adı} dosyası bulunamadı.")
    except Exception as e:
        logging.error(fullzaman+f'Hata: {str(e)}')

def setup_geri_yukle(backup_dosya_adi, hedef_dosya_adi):
    try:
        # Yedek dosyanın yolunu oluşturun
        backup_dosya_yolu = backup_dosya_adi

        # Hedef dosyanın yolunu oluşturun
        hedef_dosya_yolu = hedef_dosya_adi

        # Yedek dosyayı hedef dosya olarak taşı
        shutil.move(backup_dosya_yolu, hedef_dosya_yolu)

        #print(f"{backup_dosya_adi} başarıyla {hedef_dosya_adi} olarak geri yüklendi.")
    except FileNotFoundError:
        logging.error(f"{backup_dosya_adi} dosyası bulunamadı.")
    except Exception as e:
        logging.error(fullzaman + f'Hata: {str(e)}')