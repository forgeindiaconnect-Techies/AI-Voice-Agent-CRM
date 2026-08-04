import os
from twilio.rest import Client
from dotenv import load_dotenv

load_dotenv()

account_sid = os.getenv('TWILIO_ACCOUNT_SID')
api_key = os.getenv('TWILIO_API_KEY')
api_secret = os.getenv('TWILIO_API_SECRET')

try:
    client = Client(api_key, api_secret, account_sid)
    print("Testing API Key...")
    messages = client.messages.list(limit=1)
    print("API Key is VALID!")
except Exception as e:
    print(f"API Key is INVALID: {e}")
