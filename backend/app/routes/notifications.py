from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.services.notifier import notifier

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("/events")
async def events():
    return StreamingResponse(
        notifier.subscribe(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
        },
    )
