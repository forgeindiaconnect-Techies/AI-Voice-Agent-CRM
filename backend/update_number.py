import os
from twilio.rest import Client
from dotenv import load_dotenv

load_dotenv()

account_sid = os.getenv('TWILIO_ACCOUNT_SID')
auth_token = os.getenv('TWILIO_AUTH_TOKEN')
phone_number = os.getenv('TWILIO_PHONE_NUMBER')
tunnel_url = "https://grumpy-impalas-teach.loca.lt"

print(f"Updating Phone Number {phone_number} to use {tunnel_url}/api/calls/twiml")

try:
    client = Client(account_sid, auth_token)
    
    # Find the phone number SID
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
    print(f"Error updating Phone Number: {e}")
