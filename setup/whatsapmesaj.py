import pywhatkit as kit
import datetime

def send_whatsapp_message(phone_number, message, hours, minutes):
    # Current time + specified time delay
    now = datetime.datetime.now()
    send_time = now.replace(hour=hours, minute=minutes) + datetime.timedelta(minutes=1)

    # Send the message
    kit.sendwhatmsg(phone_number, message, send_time.hour, send_time.minute)

# Kullanım
phone_number = '+905322865115'  # Alıcı telefon numarası
whatsapp_message = 'Merhaba, bu bir test mesajıdır.'
message_hours = 22  # Gönderim saati (24 saat formatında)
message_minutes = 14  # Gönderim dakikası

send_whatsapp_message(phone_number, whatsapp_message, message_hours, message_minutes)
