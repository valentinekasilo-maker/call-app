# Supabase Integration — Setup & Run Guide

## Overview

The app now uses **Supabase** for authentication, user profiles, unique App IDs, contacts, and call history. The existing **WebRTC/Socket.io signaling** is completely unchanged.

---

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign in
2. Click **New project**
3. Choose a name (e.g. `callapp`) and a strong database password
4. Select a region close to you
5. Wait for the project to initialize (~2 minutes)

---

## Step 2: Run the Database Migration

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **New query**
3. Open the file [`supabase/migrations/20260915000001_initial_schema.sql`](file:///e:/PROJECTS/call%20app/supabase/migrations/20260915000001_initial_schema.sql)
4. Copy the entire content and paste it into the SQL Editor
5. Click **Run** (or press Ctrl+Enter)

This creates:
- `profiles` table (linked to `auth.users`)
- `calls` table
- `contacts` table
- `devices` table
- App ID generator function (`generate_unique_app_id()`)
- Auto-profile trigger (creates profile + App ID on signup)
- All Row Level Security policies

**Verify with these queries in the SQL Editor:**
```sql
-- Check tables exist with RLS enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- Expected: profiles=true, calls=true, contacts=true, devices=true

-- Check trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Check functions exist
SELECT proname FROM pg_proc WHERE proname IN ('generate_unique_app_id', 'handle_new_user');
```

---

## Step 3: Get Your Credentials

Go to **Project Settings → API** in your Supabase dashboard:

| Variable | Location | Used In |
|----------|----------|---------|
| `SUPABASE_URL` | "Project URL" | Server + Web |
| `SUPABASE_PUBLISHABLE_KEY` | "Project API keys → anon/public" | Web only |
| `SUPABASE_SERVICE_ROLE_KEY` | "Project API keys → service_role" | Server only |
| `SUPABASE_JWT_SECRET` | "JWT Settings → JWT Secret" | Server only |

> ⚠️ **NEVER commit the service_role key or JWT secret. Never put them in frontend code.**

---

## Step 4: Configure Environment Variables

### Server (`apps/server/.env`)
```env
PORT=5055
STUN_SERVERS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302

SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...  (service_role key)
SUPABASE_JWT_SECRET=your-jwt-secret-from-dashboard

# Optional TURN server
TURN_URL=
TURN_USERNAME=
TURN_CREDENTIAL=
```

### Web App (`apps/web/.env`)
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...  (anon/public key only)
```

---

## Step 5: Configure Supabase Auth Settings

In your Supabase dashboard, go to **Authentication → Settings**:

1. **Email Confirmations**: For local development, **disable** "Confirm email" (or your users will need to confirm before they can log in)
   - Setting: Auth → Providers → Email → "Confirm email" → toggle OFF

2. **Site URL**: Set to `http://localhost:3000` for local development

3. **Redirect URLs**: Add `http://localhost:3000`

---

## Step 6: Run the Application

Open **3 terminal windows**:

**Terminal 1 — Signaling Server:**
```bash
cd "e:\PROJECTS\call app"
npm run dev:server
```
Expected output:
```
✅ Supabase connection verified
====================================================
🚀 Call App Signaling & Auth Server is RUNNING
📡 URL: http://localhost:5055
🗄️ Database: Supabase PostgreSQL
🌐 STUN Servers: stun:stun.l.google.com:19302, ...
====================================================
```

**Terminal 2 — Web App:**
```bash
cd "e:\PROJECTS\call app"
npm run dev:web
```
Opens at http://localhost:3000

**Terminal 3 — Second Browser (for testing two users):**
- Open http://localhost:3000 in a second browser or incognito window

---

## Step 7: Test the Full Flow

### Create User A (Browser A)
1. Go to http://localhost:3000
2. Click **Sign Up**
3. Enter: Name: `Valence`, Email: `valence@test.com`, Password: `password123`
4. App ID is automatically assigned (e.g. `0748321905`)

### Create User B (Browser B — incognito)
1. Go to http://localhost:3000
2. Click **Sign Up**
3. Enter: Name: `John`, Email: `john@test.com`, Password: `password456`
4. App ID is automatically assigned (e.g. `0612884177`)

### Make a Call
1. In Browser A, go to the **Keypad** tab
2. Enter John's App ID: `0612884177`
3. Click Call
4. In Browser B, the incoming call appears
5. John accepts → WebRTC audio connects
6. Both can hear each other
7. Click **End Call**
8. Check **Recent** tab — call history is saved

---

## Step 8: Run E2E Tests (with real Supabase credentials)

Once you have two test users with tokens, you can run the full E2E suite:

```bash
# Get tokens by signing in and copying session.access_token from browser console:
# supabase.auth.getSession().then(s => console.log(s.data.session.access_token))

set TEST_USER_A_TOKEN=eyJ...tokenA
set TEST_USER_A_APP_ID=0748321905
set TEST_USER_A_NAME=Valence
set TEST_USER_B_TOKEN=eyJ...tokenB
set TEST_USER_B_APP_ID=0612884177
set TEST_USER_B_NAME=John

npm --workspace=@callapp/server run test
```

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (apps/web)                                          │
│                                                              │
│  AuthContext ──→ supabase.auth.signUp/signInWithPassword()   │
│               ←── session.access_token (Supabase JWT)        │
│                                                              │
│  CallContext ──→ Socket.io (auth: { token: access_token })   │
│             ←──→ WebRTC peer connection (audio only)         │
└──────────────────────────┬──────────────────────────────────┘
                           │ Socket.io
┌──────────────────────────▼──────────────────────────────────┐
│  Signaling Server (apps/server)                              │
│                                                              │
│  Socket Auth Middleware:                                      │
│    jwt.verify(token, SUPABASE_JWT_SECRET)                    │
│    → fetch profile from Supabase → get appId + name         │
│                                                              │
│  CallManager: in-memory call state (unchanged)               │
│  WebRTC relay: offer/answer/ICE (unchanged)                  │
│                                                              │
│  CallRepository → Supabase (call history)                    │
│  UserRepository → Supabase (App ID lookups)                  │
│  ContactRepository → Supabase (contacts)                     │
└──────────────────────────┬──────────────────────────────────┘
                           │ service_role key
┌──────────────────────────▼──────────────────────────────────┐
│  Supabase                                                    │
│                                                              │
│  auth.users ──→ trigger ──→ profiles (app_id auto-generated) │
│  profiles   (display_name, app_id unique 10-digit)           │
│  calls      (caller_id, receiver_id UUIDs, status, duration) │
│  contacts   (user_id, contact_user_id, unique pair)          │
│                                                              │
│  RLS: enforced for all client-side queries                   │
│  service_role: bypasses RLS for trusted server writes        │
└─────────────────────────────────────────────────────────────┘
```

---

## Security Summary

| What | How |
|------|-----|
| Auth | Supabase Auth (email/password) |
| Password hashing | Supabase (bcrypt, server-side) |
| Session persistence | Supabase `localStorage` (auto-refresh) |
| Token verification | `jwt.verify(token, SUPABASE_JWT_SECRET)` on server |
| App ID trust | Always fetched from DB; never trusted from client |
| RLS | Enforced on all client queries (anon key) |
| Service role | Server-side only; never in browser |
| Call records | Written by server (trusted); clients read-only via RLS |
