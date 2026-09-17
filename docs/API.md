# CallApp Developer API Specification (`v1`)

Welcome to the **CallApp Calling Identity & Developer API**.

## Core Concept: API Key = Complete Calling Identity

In CallApp, an API Key is not just an application-level token—it represents a **Complete Calling Identity**.

```
Calling Identity (Lucia)
├── Name: "Lucia"
├── Public 10-Digit App ID: 0834567123
├── Account ID: UUID
├── Type: AI
├── Status: active
└── Permissions: ["call", "receive_call", "lookup", "presence", "call_history"]
    │
    ▼
Private API Credential (call_live_...)
    │
    ▼
External Application / Agent (Lucia)
```

### Public Identity vs. Private Credential
* **Public Calling Identity**: The **10-Digit App ID** (e.g. `0834567123`). This is what humans type into the keypad to call Lucia, or what appears on the receiver's screen when Lucia calls them.
* **Private Authentication Credential**: The **API Key** (`call_live_...`). This authenticates the external application and is stored securely by the agent.
* **No Spoofing**: When an external app makes a call request (`POST /api/v1/calls`), the caller identity is **strictly derived from the authenticated API Key**. The client only specifies `"to": "0748321905"`.

---

## 1. Authentication & Key Management

### Headers
```http
Authorization: Bearer call_live_7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c
Content-Type: application/json
```
Alternatively:
```http
X-API-Key: call_live_7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c
```

### Security Properties
* **High Entropy**: Cryptographically generated with 192 bits of entropy (`call_live_...` or `sk_live_...`).
* **Hashed at Rest**: Stored using SHA-256 hashes (`api_credentials`). Plaintext keys are never stored in the database.
* **Single Disclosure**: Plaintext keys are returned **ONLY ONCE** upon creation or rotation.
* **Rotatable & Revocable**: Rotating an API key generates a new secret while keeping the **10-Digit App ID unchanged**.

---

## 2. API Endpoints Reference

Base URL: `http://localhost:5055/api/v1` (or `https://your-domain.com/api/v1`)

---

### A. Calling Identities

#### 1. Create Calling Identity
Create a new Complete Calling Identity (e.g. for Lucia AI, Vancix, or Home Assistant). The server automatically generates a unique 10-digit App ID and returns the primary API key.

* **Endpoint**: `POST /api/v1/identities`
* **Request Body**:
```json
{
  "name": "Lucia",
  "type": "ai",
  "permissions": ["call", "receive_call", "lookup", "presence", "call_history"],
  "metadata": {
    "engine": "Lucia-Voice",
    "version": "2.0"
  }
}
```
*Supported `type` values*: `'human' | 'ai' | 'bot' | 'service' | 'device' | 'application'`

* **Response** (`201 Created`):
```json
{
  "identity_id": "b182d8d4-53c4-469b-8109-1e39a3f29a70",
  "name": "Lucia",
  "app_id": "0834567123",
  "type": "ai",
  "status": "active",
  "permissions": ["call", "receive_call", "lookup", "presence", "call_history"],
  "api_key": "call_live_7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c",
  "key_prefix": "call_live_7f8a9b",
  "created_at": "2026-09-17T22:00:00.000Z"
}
```

* **Example `curl`**:
```bash
curl -X POST "http://localhost:5055/api/v1/identities" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lucia",
    "type": "ai"
  }'
```

---

#### 2. List Calling Identities
List registered identities. Secrets are never exposed.

* **Endpoint**: `GET /api/v1/identities`
* **Response** (`200 OK`):
```json
{
  "identities": [
    {
      "id": "b182d8d4-53c4-469b-8109-1e39a3f29a70",
      "name": "Lucia",
      "appId": "0834567123",
      "type": "ai",
      "status": "active",
      "permissions": ["call", "receive_call", "lookup", "presence", "call_history"],
      "keyPrefix": "call_live_7f8a9b",
      "createdAt": "2026-09-17T22:00:00.000Z",
      "updatedAt": "2026-09-17T22:00:00.000Z"
    }
  ]
}
```

---

#### 3. Rotate API Key
Generates a new API key and revokes old keys. The public **10-Digit App ID remains exactly the same**.

* **Endpoint**: `POST /api/v1/identities/:id/rotate-key`
* **Response** (`200 OK`):
```json
{
  "identity_id": "b182d8d4-53c4-469b-8109-1e39a3f29a70",
  "name": "Lucia",
  "app_id": "0834567123",
  "api_key": "call_live_9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d",
  "key_prefix": "call_live_9a8b7c",
  "rotated_at": "2026-09-17T22:30:00.000Z"
}
```

---

#### 4. Revoke Identity
Disables the identity. Prevents authentication, initiating calls, and receiving calls.

* **Endpoint**: `POST /api/v1/identities/:id/revoke`
* **Response** (`200 OK`):
```json
{
  "success": true,
  "message": "Identity Lucia (0834567123) has been revoked."
}
```

---

#### 5. Reactivate Identity
Re-enables a revoked identity.

* **Endpoint**: `POST /api/v1/identities/:id/activate`
* **Response** (`200 OK`):
```json
{
  "success": true,
  "message": "Identity Lucia (0834567123) is now active."
}
```

---

### B. "Who am I?" (`/api/v1/me`)

#### Verify Authenticated Identity
Allows an external application to verify its calling identity.

* **Endpoint**: `GET /api/v1/me`
* **Authentication**: `Bearer <API_KEY>`
* **Response** (`200 OK`):
```json
{
  "identity_id": "b182d8d4-53c4-469b-8109-1e39a3f29a70",
  "name": "Lucia",
  "app_id": "0834567123",
  "type": "ai",
  "status": "active",
  "permissions": ["call", "receive_call", "lookup", "presence", "call_history"],
  "metadata": {
    "engine": "Lucia-Voice"
  }
}
```

* **Example `curl`**:
```bash
curl -X GET "http://localhost:5055/api/v1/me" \
  -H "Authorization: Bearer call_live_7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c"
```

---

### C. Public User / Identity Lookup

#### Look up User by 10-Digit App ID
* **Endpoint**: `GET /api/v1/users/:appId`
* **Response** (`200 OK`):
```json
{
  "app_id": "0748321905",
  "display_name": "Valence",
  "type": "human",
  "presence": "online"
}
```

---

### D. Calls & Call Control

#### 1. Initiate Call
Initiates a voice call to a target 10-digit App ID. The caller identity is derived directly from the API Key.

* **Endpoint**: `POST /api/v1/calls`
* **Authentication**: `Bearer <API_KEY>`
* **Request Body**:
```json
{
  "to": "0748321905"
}
```
*(No need to send `from`; the server resolves it from your API key).*

* **Response** (`201 Created`):
```json
{
  "call_id": "d98124fa-6c71-4791-a182-f54291881720",
  "status": "ringing",
  "from": "0834567123",
  "to": "0748321905"
}
```

* **Example `curl`**:
```bash
curl -X POST "http://localhost:5055/api/v1/calls" \
  -H "Authorization: Bearer call_live_7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "0748321905"
  }'
```

---

#### 2. Accept Incoming Call
* **Endpoint**: `POST /api/v1/calls/:callId/accept`
* **Authentication**: `Bearer <API_KEY>`
* **Response** (`200 OK`):
```json
{
  "callId": "d98124fa-6c71-4791-a182-f54291881720",
  "status": "accepted",
  "receiverAppId": "0834567123",
  "receiverName": "Lucia",
  "webrtcConfig": {
    "iceServers": [
      { "urls": "stun:stun.l.google.com:19302" }
    ]
  }
}
```

---

#### 3. Decline Incoming Call
* **Endpoint**: `POST /api/v1/calls/:callId/decline`
* **Authentication**: `Bearer <API_KEY>`
* **Request Body**:
```json
{
  "reason": "AI assistant is currently busy."
}
```

---

#### 4. End Active Call
* **Endpoint**: `POST /api/v1/calls/:callId/end`
* **Authentication**: `Bearer <API_KEY>`
* **Response** (`200 OK`):
```json
{
  "success": true,
  "duration": 48,
  "status": "completed",
  "message": "Call ended."
}
```

---

### E. Device Presence

#### Register / Heartbeat Presence
* **Endpoint**: `POST /api/v1/devices`
* **Authentication**: `Bearer <API_KEY>`
* **Request Body**:
```json
{
  "status": "online",
  "platform": "lucia-agent"
}
```
*Options for `status`*: `'online' | 'offline' | 'busy'`

---

### F. Webhook Events

#### 1. Register Webhook
* **Endpoint**: `POST /api/v1/webhooks`
* **Authentication**: `Bearer <API_KEY>`
* **Request Body**:
```json
{
  "url": "https://lucia.local/call-events",
  "events": ["*"]
}
```

#### 2. Webhook Event Payload (`incoming_call`):
```json
{
  "event": "incoming_call",
  "call_id": "d98124fa-6c71-4791-a182-f54291881720",
  "caller": {
    "app_id": "0748321905",
    "name": "Valence",
    "type": "human"
  },
  "receiver": {
    "app_id": "0834567123",
    "name": "Lucia",
    "type": "ai"
  },
  "status": "ringing",
  "timestamp": "2026-09-17T22:30:00.000Z"
}
```
Header: `X-CallApp-Signature: sha256=<HMAC_SHA256_HEX>`

---

## 3. Step-by-Step Lucia AI Integration Flow

```
1. Admin creates Lucia Identity:
   POST /api/v1/identities {"name": "Lucia", "type": "ai"}
   ──> App ID: 0834567123
   ──> API Key: call_live_xxxxxxxxx

2. Lucia verifies its identity:
   GET /api/v1/me (Bearer call_live_xxxxxxxxx)
   ──> "I am Lucia, App ID 0834567123"

3. Lucia sets presence online:
   POST /api/v1/devices {"status": "online"}

4. Lucia initiates call to Valence:
   POST /api/v1/calls {"to": "0748321905"}
   ──> Server rings Valence as "Lucia (0834567123)"

5. Valence calls Lucia:
   Valence dials 0834567123
   ──> Server fires incoming_call webhook to Lucia
   ──> Lucia accepts via POST /api/v1/calls/{id}/accept
   ──> WebRTC audio stream is established
```
