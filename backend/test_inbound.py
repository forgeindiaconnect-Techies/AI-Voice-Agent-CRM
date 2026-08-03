import asyncio
# pyrefly: ignore [missing-import]
from twilio.rest import Client
from app.core.config import settings
from app.core.database import users_col

async def run():
    agent = await users_col.find_one({'role': {'$in': ['agent', 'team_leader', 'supervisor']}, 'status': 'active'})
    if not agent:
        print('No active agent/supervisor found in the database.')
        return
        
    client = Client(settings.TWILIO_API_KEY, settings.TWILIO_API_SECRET, settings.TWILIO_ACCOUNT_SID)
    
    agent_id = str(agent['_id'])
    print(f'Ringing client:{agent_id}...')
    call = client.calls.create(
        to=f'client:{agent_id}',
        from_='+12345678900',
        twiml='<Response><Say>Hello! This is a completely free simulated incoming call from the Twilio API!</Say></Response>'
    )
    print(f'Success! Call SID: {call.sid}')

asyncio.run(run())
