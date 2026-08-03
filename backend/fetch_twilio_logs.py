import os
from twilio.rest import Client
from app.core.config import settings

client = Client(settings.TWILIO_API_KEY, settings.TWILIO_API_SECRET, settings.TWILIO_ACCOUNT_SID)
calls = client.calls.list(limit=5)
for c in calls:
    print(f'Call SID: {c.sid}')
    print(f'To: {c.to}, From: {c.from_}, Status: {c.status}')
    if c.subresource_uris and 'notifications' in c.subresource_uris:
        try:
            url = client.get_version('api').domain + c.subresource_uris['notifications']
            notifications = client.request('GET', url)
            if hasattr(notifications, 'json'):
                data = notifications.json()
                if 'notifications' in data and data['notifications']:
                    for n in data['notifications']:
                        msg = n.get('message_text')
                        print(f'  Error: {msg}')
        except Exception as e:
            print(f'  Could not fetch notifications: {e}')
    print('-'*20)
