from django.contrib.auth.models import User
from django.db.models import Q
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework import generics, permissions
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.exceptions import PermissionDenied
from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer, RegistrationSerializer, UserSerializer

class RegisterView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = RegistrationSerializer

class UserListView(generics.ListAPIView):
    serializer_class = UserSerializer
    def get_queryset(self):
        query = self.request.query_params.get("search", "")
        return User.objects.exclude(id=self.request.user.id).filter(username__icontains=query)[:20]

class ConversationListCreateView(generics.ListCreateAPIView):
    serializer_class = ConversationSerializer
    def get_queryset(self):
        return Conversation.objects.filter(participants=self.request.user).prefetch_related("participants", "messages")
    def create(self, request, *args, **kwargs):
        username = request.data.get("username")
        other = User.objects.filter(username=username).first()
        if not other or other == request.user:
            from rest_framework.response import Response
            return Response({"detail": "Choose a valid user."}, status=400)
        conversation = Conversation.objects.filter(participants=request.user).filter(participants=other).first()
        if not conversation:
            conversation = Conversation.objects.create()
            conversation.participants.set([request.user, other])
        from rest_framework.response import Response
        return Response(self.get_serializer(conversation).data, status=201)

class MessageListView(generics.ListCreateAPIView):
    serializer_class = MessageSerializer
    parser_classes = (MultiPartParser, FormParser, JSONParser)
    def get_conversation(self):
        conversation = Conversation.objects.filter(id=self.kwargs["conversation_id"], participants=self.request.user).first()
        if not conversation:
            raise PermissionDenied("You are not a participant in this conversation.")
        return conversation
    def get_queryset(self):
        return self.get_conversation().messages.select_related("sender")
    def perform_create(self, serializer):
        message = serializer.save(conversation=self.get_conversation(), sender=self.request.user)
        self.broadcast("message.created", message)
    def broadcast(self, event_type, message):
        layer = get_channel_layer()
        async_to_sync(layer.group_send)(f"conversation_{message.conversation_id}", {
            "type": "chat.event", "event": event_type, "message": MessageSerializer(message, context={"request": self.request}).data,
        })

class MessageDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = MessageSerializer
    def get_message(self):
        conversation = Conversation.objects.filter(id=self.kwargs["conversation_id"], participants=self.request.user).first()
        if not conversation:
            raise PermissionDenied("You are not a participant in this conversation.")
        message = Message.objects.filter(id=self.kwargs["pk"], conversation=conversation).first()
        if not message:
            raise PermissionDenied("Message not found.")
        return message
    def get_object(self):
        return self.get_message()
    def perform_update(self, serializer):
        message = serializer.save()
        self.broadcast("message.updated", message)
    def perform_destroy(self, instance):
        if instance.sender_id != self.request.user.id:
            raise PermissionDenied("You can only delete your own messages.")
        message_id, conversation_id = instance.id, instance.conversation_id
        instance.delete()
        layer = get_channel_layer()
        async_to_sync(layer.group_send)(f"conversation_{conversation_id}", {"type": "chat.event", "event": "message.deleted", "message": {"id": message_id}})
    def broadcast(self, event_type, message):
        layer = get_channel_layer()
        async_to_sync(layer.group_send)(f"conversation_{message.conversation_id}", {
            "type": "chat.event", "event": event_type, "message": MessageSerializer(message, context={"request": self.request}).data,
        })
