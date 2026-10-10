import sqlite3

# Adım 1: SQLite veritabanına bağlanın
conn = sqlite3.connect('kutuphane.db')
cursor = conn.cursor()

# Adım 2: Yeni metin kolonunu ekleyin
# Burada 'yeni_kolon' adında bir metin kolonu ekleyelim
# 'veriler' tablosunun adını ve mevcut kolonları ve tiplerini güncellemeniz gerekebilir.
try:
    cursor.execute("ALTER TABLE kitaplar ADD COLUMN etiket TEXT")
    conn.commit()
    print("Yeni kolon başarıyla eklendi.")
except sqlite3.OperationalError as e:
    print("Hata:", e)

# Adım 3: Mevcut verilere sıfır değerini ekleyin
try:
    cursor.execute("UPDATE kitaplar SET etiket = '0' WHERE etiket IS NULL")
    conn.commit()
    print("Mevcut verilere sıfır değeri eklendi.")
except sqlite3.OperationalError as e:
    print("Hata:", e)

# Veritabanı bağlantısını kapatın
conn.close()
