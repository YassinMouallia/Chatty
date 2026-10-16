# Chatty Feature Documentation

## Product scope

Chatty provides private, one-to-one conversations with a browser-based interface. Users can create accounts, find other users, open conversations, exchange text and images, and manage their own messages while connected in real time.

## Feature inventory

### 1. Account registration

Users can create an account with a username and password.

- UI: authentication screen in `frontend/src/main.jsx`.
- API: `POST /api/auth/register/`.
- Validation: password must be at least eight characters; Django validates and hashes the password through `create_user`.
- Access: registration is the only unauthenticated application API operation.

### 2. JWT sign-in and sign-out

Users sign in with their username and password.

- API: `POST /api/auth/token/`.
- Refresh API: `POST /api/auth/token/refresh/`.
- Client behavior: the access token and username are stored in `localStorage`.
- Authenticated REST calls include the JWT in the HTTP `Authorization` header.
- Sign-out clears local browser storage and returns to the authentication screen.

### 3. Username search

Authenticated users can search for other users by a case-insensitive partial username.

- API: `GET /api/users/?search=<text>`.
- The current user is excluded from results.
- The result is limited to 20 users.
- The frontend debounces requests by 250 ms and presents selectable results.

### 4. Private conversation creation

Users can start a conversation by selecting another username.

- API: `POST /api/conversations/` with `{ "username": "other-user" }`.
- A conversation is reused when one already exists for both participants.
- Invalid, missing, or self-referential users receive a `400` response.
- Conversation listing is limited to conversations containing the authenticated user.

### 5. Conversation sidebar

The authenticated workspace displays:

- The current username and avatar initial.
- The number of available conversations.
- A searchable user entry point.
- Existing conversations with the other participant's username.
- The latest message preview when one exists.
- An active conversation indicator.

### 6. Message history

Selecting a conversation loads its messages through:

`GET /api/conversations/<conversation_id>/messages/`

The API returns messages in creation order, including sender identity, timestamp, text, image URL, and pin state. Non-participants cannot read another conversation's history.

### 7. Real-time text messaging

When a conversation is opened, the frontend establishes:

`WS /ws/conversations/<conversation_id>/?token=<access-token>`

Text messages are sent as JSON with a `body` field. The backend validates empty and overlong bodies, persists valid messages, and broadcasts `message.created` to the conversation group. All connected clients receive the event.

### 8. Image attachments

Users can attach an image from the message composer.

- Transport: multipart `POST /api/conversations/<conversation_id>/messages/`.
- Accepted alongside optional message text.
- Maximum image size: 10 MB.
- Storage: Django media storage under `chat-images/YYYY/MM/`.
- Display: the API returns an absolute `image_url`, which the frontend renders in the message bubble.

### 9. Pin and unpin messages

Users can toggle a message's pinned state through the message action menu.

- API: `PATCH /api/conversations/<conversation_id>/messages/<message_id>/`.
- Payload used by the frontend: `{ "is_pinned": true|false }`.
- The updated message is broadcast as `message.updated` by the REST view.
- Pinned messages show a pin indicator in the UI.

### 10. Delete own messages

The sender of a message can delete it.

- API: `DELETE /api/conversations/<conversation_id>/messages/<message_id>/`.
- Authorization: only the original sender may delete.
- Broadcast event: `message.deleted` with the deleted message ID.
- Clients remove the message from their current message list.

### 11. Live connection and conversation presence

The conversation header shows a connected state while a conversation socket is active. The backend authenticates the WebSocket, checks conversation membership, and closes unauthorized connections with code `4403`.

### 12. Responsive authentication experience

The authentication page has:

- A branded two-column desktop layout.
- A single-column mobile layout.
- Registration/sign-in mode switching.
- Loading feedback during authentication.
- User-facing validation and API error messages.

### 13. Containerized deployment

The supplied Compose configuration starts:

- PostgreSQL with a persistent `postgres_data` volume.
- Redis for Channels.
- Django/Daphne on port `8000`.
- Nginx-served frontend on port `5173`.
- A persistent `media_data` volume for uploaded images.

## API reference

| Method | Endpoint | Purpose | Auth |
|---|---|---|---|
| POST | `/api/auth/register/` | Register a user | Public |
| POST | `/api/auth/token/` | Obtain JWT access/refresh tokens | Public |
| POST | `/api/auth/token/refresh/` | Refresh an access token | Public |
| GET | `/api/users/?search=...` | Search users | JWT |
| GET | `/api/conversations/` | List user's conversations | JWT |
| POST | `/api/conversations/` | Create/reuse a conversation | JWT |
| GET | `/api/conversations/<id>/messages/` | List conversation messages | JWT + participant |
| POST | `/api/conversations/<id>/messages/` | Create text/image message | JWT + participant |
| PATCH | `/api/conversations/<id>/messages/<message-id>/` | Update message, including pin state | JWT + participant |
| DELETE | `/api/conversations/<id>/messages/<message-id>/` | Delete own message | JWT + participant + sender |
| GET | `/media/<path>` | Serve an uploaded image | Deployment route |

## Main event contract

WebSocket packets sent to the browser have the shape:

```json
{
  "event": "message.created",
  "message": {
    "id": 1,
    "body": "Hello",
    "sender": {
      "id": 2,
      "username": "alex"
    },
    "created_at": "2026-10-16T10:00:00+00:00",
    "image_url": null,
    "is_pinned": false
  }
}
```

Observed event names:

- `message.created`
- `message.updated`
- `message.deleted`

## User journey

1. Open Chatty and choose **Create an account** or sign in.
2. After sign-in, search for another username.
3. Select a search result to create or open a private conversation.
4. Load the conversation history.
5. Send text through WebSocket or an image/text message through REST.
6. Receive new messages and message changes in real time.
7. Pin/unpin messages or delete messages sent by the current user.
8. Sign out from the application header.

## Behavior not currently implemented

The source does not show group conversations, read receipts, typing indicators, message editing UI, password reset, email verification, push notifications, pagination, client-side routing, or a dedicated moderation/admin UI beyond Django admin.
