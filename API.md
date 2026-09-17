# CallApp Calling Identity API (`v1`)

> Complete developer documentation is available at [`docs/API.md`](docs/API.md).

## Core Principle: API Key = Complete Calling Identity

* **Public Calling Identity**: **10-Digit App ID** (e.g. `0834567123`).
* **Private Credential**: **API Key** (`call_live_...` or `sk_live_...`).
* **Automatic Caller Resolution**: The server resolves the caller identity from the API key. External apps cannot spoof caller App IDs.

## Endpoints Quick Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/identities` | Create a Complete Calling Identity (Lucia AI) with auto 10-digit App ID & API Key |
| `GET` | `/api/v1/identities` | List all registered calling identities (safe metadata) |
| `GET` | `/api/v1/identities/:id` | Get details of a calling identity |
| `POST` | `/api/v1/identities/:id/rotate-key` | Rotate API key (App ID remains unchanged) |
| `POST` | `/api/v1/identities/:id/revoke` | Revoke/disable an identity and invalidate its keys |
| `POST` | `/api/v1/identities/:id/activate` | Reactivate a revoked identity |
| `GET` | `/api/v1/me` | "Who am I?" verification endpoint |
| `GET` | `/api/v1/users/:appId` | Public lookup & real-time presence (`online`, `offline`, `in_call`) |
| `POST` | `/api/v1/calls` | Initiate a call to a 10-digit App ID (caller derived from API key) |
| `GET` | `/api/v1/calls/:callId` | Query call details & status |
| `POST` | `/api/v1/calls/:callId/accept` | Accept an incoming call |
| `POST` | `/api/v1/calls/:callId/decline` | Decline an incoming call |
| `POST` | `/api/v1/calls/:callId/end` | End an active call |
| `POST` | `/api/v1/devices` | Report online presence status (`online`, `offline`, `busy`) |
| `POST` | `/api/v1/webhooks` | Register a webhook endpoint for real-time call notifications |
| `GET` | `/api/v1/webhooks` | List registered webhook endpoints |
| `DELETE` | `/api/v1/webhooks/:id` | Delete a webhook endpoint |

---

## Example Lucia AI Call Request

```bash
curl -X POST "http://localhost:5055/api/v1/calls" \
  -H "Authorization: Bearer call_live_xxxxxxxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "0748321905"
  }'
```
*(Server automatically sets caller to Lucia's App ID `0834567123`).*

See [`docs/API.md`](docs/API.md) for full guide and webhook signature verification details.
