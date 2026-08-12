import os
# pyrefly: ignore [missing-import]
from twilio.rest import Client
from app.core.config import settings

client = Client(settings.TWILIO_API_KEY, settings.TWILIO_API_SECRET, settings.TWILIO_ACCOUNT_SID)
calls = client.calls.list(limit=5)
for c in calls:
    print(f'Call SID: {c.sid}')
    from_num = getattr(c, 'from', getattr(c, '_from', ''))
    print(f'To: {c.to}, From: {from_num}, Status: {c.status}')
    try:
        notes = client.calls(c.sid).notifications.list()
        for n in notes:
            print(f'  Notification [{n.error_code}]: {n.message_text} (URL: {getattr(n, "request_url", "")})')
    except Exception as e:
        print(f'  Could not fetch notifications: {e}')
    print('-'*20)
