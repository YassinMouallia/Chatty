from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Conversation, Message

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username")

class RegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    class Meta:
        model = User
        fields = ("username", "password")
    def create(self, validated_data):
        return User.objects.create_user(**validated_data)

class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    image_url = serializers.SerializerMethodField()
    class Meta:
        model = Message
        fields = ("id", "body", "sender", "created_at", "image", "image_url", "is_pinned")
        read_only_fields = ("sender", "image_url")
        extra_kwargs = {"image": {"write_only": True, "required": False}}
    def get_image_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.image.url) if obj.image else None
    def validate_image(self, image):
        if image.size > 10 * 1024 * 1024:
            raise serializers.ValidationError("Images must be smaller than 10 MB.")
        return image

class ConversationSerializer(serializers.ModelSerializer):
    participants = UserSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    class Meta:
        model = Conversation
        fields = ("id", "participants", "last_message", "created_at")
    def get_last_message(self, obj):
        message = obj.messages.select_related("sender").last()
        return MessageSerializer(message).data if message else None
