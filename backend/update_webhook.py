import os
from twilio.rest import Client
from dotenv import load_dotenv

load_dotenv()

account_sid = os.getenv('TWILIO_ACCOUNT_SID')
auth_token = os.getenv('TWILIO_AUTH_TOKEN')
twiml_app_sid = os.getenv('TWILIO_TWIML_APP_SID')
tunnel_url = "https://grumpy-impalas-teach.loca.lt"

print(f"Updating TwiML App {twiml_app_sid} to use {tunnel_url}/api/calls/twiml")

try:
    client = Client(account_sid, auth_token)
    
    app = client.applications(twiml_app_sid).update(
        voice_url=f"{tunnel_url}/api/calls/twiml",
        voice_method="POST"
    )
    print("Successfully updated TwiML App Voice URL!")
except Exception as e:
    print(f"Error updating TwiML app: {e}")
