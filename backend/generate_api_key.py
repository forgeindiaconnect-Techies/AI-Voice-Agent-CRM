import os
from twilio.rest import Client
from dotenv import load_dotenv, set_key

load_dotenv()

account_sid = os.getenv('TWILIO_ACCOUNT_SID')
auth_token = os.getenv('TWILIO_AUTH_TOKEN')
env_path = ".env"

try:
    client = Client(account_sid, auth_token)
    
    # Create a new API Key
    new_key = client.new_keys.create(friendly_name="Forge CRM WebRTC Key")
    print(f"Created new API Key: {new_key.sid}")
    
    # Update the .env file
    set_key(env_path, "TWILIO_API_KEY", new_key.sid)
    set_key(env_path, "TWILIO_API_SECRET", new_key.secret)
    print("Successfully updated .env with new TWILIO_API_KEY and TWILIO_API_SECRET!")
except Exception as e:
    print(f"Failed to create API key: {e}")
