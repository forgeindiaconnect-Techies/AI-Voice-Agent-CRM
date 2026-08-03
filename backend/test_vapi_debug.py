import os, asyncio, httpx
from dotenv import load_dotenv
load_dotenv('.env')

async def test_vapi():
    vapi_payload = {
        'assistantId': os.getenv('VAPI_ASSISTANT_ID'),
        'phoneNumberId': os.getenv('VAPI_PHONE_NUMBER_ID'),
        'customer': {
            'number': '+919444667411',
            'name': 'Customer'
        }
    }
    
    headers = {
        'Authorization': f'Bearer {os.getenv("VAPI_API_KEY")}',
        'Content-Type': 'application/json'
    }
    
    print(vapi_payload)
    
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post('https://api.vapi.ai/call', json=vapi_payload, headers=headers)
            print(f'Status: {res.status_code}, Body: {res.text}')
        except Exception as e:
            print(e)

asyncio.run(test_vapi())
