import asyncio
import json
import logging
from typing import AsyncGenerator

logger = logging.getLogger(__name__)

class Notifier:
    def __init__(self):
        self.connections: list[asyncio.Queue] = []

    async def subscribe(self) -> AsyncGenerator[str, None]:
        queue = asyncio.Queue()
        self.connections.append(queue)
        logger.info("New SSE client connected. Total connections: %d", len(self.connections))
        try:
            while True:
                data = await queue.get()
                yield f"data: {data}\n\n"
        finally:
            self.connections.remove(queue)
            logger.info("SSE client disconnected. Total connections: %d", len(self.connections))

    async def publish(self, message: dict):
        if not self.connections:
            return
        
        data = json.dumps(message)
        logger.debug("Broadcasting message to %d clients: %s", len(self.connections), data)
        for queue in self.connections:
            await queue.put(data)

notifier = Notifier()
