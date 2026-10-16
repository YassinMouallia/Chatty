from django.urls import path
from .views import ConversationListCreateView, MessageDetailView, MessageListView, RegisterView, UserListView

urlpatterns = [
    path("users/", UserListView.as_view()),
    path("auth/register/", RegisterView.as_view()),
    path("conversations/", ConversationListCreateView.as_view()),
    path("conversations/<int:conversation_id>/messages/", MessageListView.as_view()),
    path("conversations/<int:conversation_id>/messages/<int:pk>/", MessageDetailView.as_view()),
]
