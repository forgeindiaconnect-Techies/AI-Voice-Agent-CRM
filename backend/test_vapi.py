import httpx
import os
import asyncio

# Your Vapi details
api_key = "20b78f68-3910-48f5-8d64-6fb983871589"
assistant_id = "e53179b4-cb2e-4244-a533-b3e1130bf346"
customer_number = "+919360365679"

url = "https://api.vapi.ai/call/phone"
headers = {
    "Authorization": f"Bearer {api_key}",
    "Content-Type": "application/json"
}
payload = {
    "assistantId": assistant_id,
    "phoneNumberId": "3c8be3e8-d469-4954-816b-a737d19a7175",
    "customer": {
        "number": customer_number
    }
}

async def main():
    print(f"Triggering call to {customer_number} via Vapi...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload)
            print(f"Status Code: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
