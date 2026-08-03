import os, asyncio, httpx
from dotenv import load_dotenv
load_dotenv('.env')

async def test_exotel():
    exotel_payload = {
        'From': '9444667411',
        'To': '9444667411',
        'CallerId': os.getenv('EXOTEL_CALLER_ID')
    }
    auth_tuple = (os.getenv('EXOTEL_API_KEY'), os.getenv('EXOTEL_API_TOKEN'))
    sid = os.getenv('EXOTEL_ACCOUNT_SID')
    url = f'https://api.exotel.com/v1/Accounts/{sid}/Calls/connect.json'
    
    async with httpx.AsyncClient() as client:
        res = await client.post(url, data=exotel_payload, auth=auth_tuple)
        print(f'Status: {res.status_code}')
        print(res.text)

asyncio.run(test_exotel())
