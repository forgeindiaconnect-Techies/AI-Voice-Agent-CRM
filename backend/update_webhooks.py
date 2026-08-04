import sys
import os
from twilio.rest import Client
from dotenv import load_dotenv

load_dotenv()

if len(sys.argv) < 2:
    print("Usage: python update_webhooks.py <TUNNEL_URL>")
    sys.exit(1)

tunnel_url = sys.argv[1].rstrip('/')
account_sid = os.getenv('TWILIO_ACCOUNT_SID')
auth_token = os.getenv('TWILIO_AUTH_TOKEN')
twiml_app_sid = os.getenv('TWILIO_TWIML_APP_SID')
phone_number = os.getenv('TWILIO_PHONE_NUMBER')

print(f"Updating Webhooks to use {tunnel_url}/api/calls/twiml")

try:
    client = Client(account_sid, auth_token)
    
    # 1. Update TwiML App
    client.applications(twiml_app_sid).update(
        voice_url=f"{tunnel_url}/api/calls/twiml",
        voice_method="POST"
    )
    print("Successfully updated TwiML App Voice URL!")
    
    # 2. Update Incoming Phone Number
    numbers = client.incoming_phone_numbers.list(phone_number=phone_number)
    if numbers:
        sid = numbers[0].sid
        client.incoming_phone_numbers(sid).update(
            voice_url=f"{tunnel_url}/api/calls/twiml",
            voice_method="POST"
        )
        print("Successfully updated Phone Number Voice URL!")
    else:
        print("Phone number not found in account.")
        
except Exception as e:
    print(f"Error updating Webhooks: {e}")
