import asyncio
from app.services.vapi_client import build_outbound_call_payload, start_outbound_call

class MockClient:
    id = "7a55d5b9-be1e-4d40-af8c-a6308449087a"
    full_name = "Test User"
    phone_number = "+12345678901"
    timezone = "UTC"
    follow_up_context = "test context"
    previous_interaction = "test"
    notes = "test notes"
    custom_fields = {"foo": "bar"}

async def main():
    client = MockClient()
    try:
        res = await start_outbound_call(client)
        print("Success:", res)
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    asyncio.run(main())
