import json
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from .models import Conversation, Message

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.conversation_id = self.scope["url_route"]["kwargs"]["conversation_id"]
        if not await self.is_participant():
            await self.close(code=4403)
            return
        self.room_group_name = f"conversation_{self.conversation_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        body = (json.loads(text_data).get("body") or "").strip()
        if not body or len(body) > 4000:
            return
        message = await self.save_message(body)
        await self.channel_layer.group_send(self.room_group_name, {"type": "chat.event", "event": "message.created", "message": message})

    async def chat_event(self, event):
        await self.send(text_data=json.dumps({"event": event["event"], "message": event["message"]}))

    @database_sync_to_async
    def is_participant(self):
        return Conversation.objects.filter(id=self.conversation_id, participants=self.scope["user"]).exists()

    @database_sync_to_async
    def save_message(self, body):
        message = Message.objects.create(conversation_id=self.conversation_id, sender=self.scope["user"], body=body)
        return {"id": message.id, "body": message.body, "sender": {"id": message.sender_id, "username": message.sender.username},
                "created_at": message.created_at.isoformat(), "image_url": None, "is_pinned": False}
