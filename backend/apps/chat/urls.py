from django.urls import path

from apps.chat.views import (
    ChatParticipantListView,
    SupportMessageListCreateView,
    SupportThreadListCreateView,
)


urlpatterns = [
    path("participants/", ChatParticipantListView.as_view(), name="chat-participants"),
    path("threads/", SupportThreadListCreateView.as_view(), name="chat-threads"),
    path("threads/<int:thread_id>/messages/", SupportMessageListCreateView.as_view(), name="chat-messages"),
]
