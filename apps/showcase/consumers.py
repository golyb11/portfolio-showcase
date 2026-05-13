import json
import asyncio
from datetime import datetime, timezone
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_name = self.scope["url_route"]["kwargs"].get("room_name", "general")
        self.room_group_name = f"chat_{self.room_name}"
        self.heartbeat_task = None

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        await self.send(
            text_data=json.dumps(
                {
                    "type": "connection_established",
                    "message": f"Connected to room: {self.room_name}",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )
        )

        self.heartbeat_task = asyncio.ensure_future(self._server_heartbeat())

    async def disconnect(self, close_code):
        if self.heartbeat_task:
            self.heartbeat_task.cancel()
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get("type", "chat_message")

            if message_type == "chat_message":
                author = data.get("author", "Anonymous")[:100]
                content = data.get("content", "").strip()[:2000]

                if not content:
                    return

                import bleach
                safe_content = bleach.clean(content, tags=[], strip=True)

                await self._save_message(self.room_name, author, safe_content, "user")

                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        "type": "chat_message",
                        "author": author,
                        "content": safe_content,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                )

            elif message_type == "ping":
                await self.send(
                    text_data=json.dumps(
                        {
                            "type": "pong",
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    )
                )

        except json.JSONDecodeError:
            await self.send(
                text_data=json.dumps({"type": "error", "message": "Invalid JSON payload."})
            )

    async def chat_message(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "chat_message",
                    "author": event["author"],
                    "content": event["content"],
                    "timestamp": event["timestamp"],
                }
            )
        )

    async def server_status(self, event):
        await self.send(text_data=json.dumps(event))

    async def _server_heartbeat(self):
        import psutil
        while True:
            try:
                await asyncio.sleep(5)
                cpu = psutil.cpu_percent(interval=None)
                mem = psutil.virtual_memory()
                await self.send(
                    text_data=json.dumps(
                        {
                            "type": "server_status",
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "cpu_percent": cpu,
                            "memory_percent": mem.percent,
                            "memory_used_mb": round(mem.used / 1024 / 1024, 1),
                        }
                    )
                )
            except asyncio.CancelledError:
                break
            except Exception:
                break

    @database_sync_to_async
    def _save_message(self, room, author, content, message_type):
        from apps.showcase.models import ChatMessage
        ChatMessage.objects.create(
            room=room,
            author=author,
            content=content,
            message_type=message_type,
        )
