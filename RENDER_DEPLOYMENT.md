# 🚀 Deploying Call App to Render

This guide explains how to deploy the entire Call App (Signaling Server + REST API + WebRTC + Web App UI) to [Render](https://render.com).

---

## 🏗️ Architecture on Render

```
                                 [ Render Cloud ]
                         ┌──────────────────────────────┐
                         │   Unified Web Service        │
                         │   https://<app>.onrender.com │
                         │                              │
                         │  • Express REST API (/api/*) │
                         │  • WebRTC Signaling (WS)     │
                         │  • React Web UI (HTML/CSS/JS)│
                         └──────────────┬───────────────┘
                                        │
                         ┌──────────────┴───────────────┐
                         │       Supabase Cloud         │
                         │   Auth • PostgreSQL Database │
                         └──────────────────────────────┘
```

---

## ⚡ Method 1: Deploy with Render Blueprint (Recommended - 1 Click)

1. Push your repository to **GitHub** or **GitLab**.
2. Log into your [Render Dashboard](https://dashboard.render.com).
3. Click **New +** → **Blueprint**.
4. Connect your repository containing `render.yaml`.
5. Render will automatically detect `render.yaml` and configure the service.
6. Enter the required environment variables:
   * `SUPABASE_URL`: `https://your-project.supabase.co`
   * `SUPABASE_SECRET_KEY`: `your_supabase_secret_key`
   * `SUPABASE_SERVICE_ROLE_KEY`: `your_supabase_service_role_key`
   * `VITE_SUPABASE_URL`: `https://your-project.supabase.co`
   * `VITE_SUPABASE_PUBLISHABLE_KEY`: `your_supabase_publishable_key`
7. Click **Apply**. Render will build and deploy your app.

---

## 🛠️ Method 2: Manual Web Service Setup on Render

If you prefer setting up the Web Service manually in the Render UI:

1. Click **New +** → **Web Service**.
2. Connect your Git repository.
3. Configure the following settings:
   * **Name**: `callapp` (or your preferred name)
   * **Region**: Choose closest to you (e.g., `Oregon`, `Frankfurt`, `Singapore`)
   * **Branch**: `main` (or your default branch)
   * **Root Directory**: Leave blank (root of repository)
   * **Runtime**: `Node`
   * **Build Command**: `npm install && npm run build:render`
   * **Start Command**: `npm run start`
   * **Plan**: `Free` or `Starter`

4. In **Advanced** → **Environment Variables**, add:

| Key | Value | Description |
|---|---|---|
| `NODE_ENV` | `production` | Production environment |
| `SUPABASE_URL` | `https://your-project.supabase.co` | Your Supabase project URL |
| `SUPABASE_SECRET_KEY` | `your_supabase_secret_key` | Server-side secret key |
| `SUPABASE_SERVICE_ROLE_KEY` | `your_supabase_service_role_key` | Service role key |
| `VITE_SUPABASE_URL` | `https://your-project.supabase.co` | Supabase URL for Frontend |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `your_supabase_publishable_key` | Anon publishable key |
| `STUN_SERVERS` | `stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302` | STUN servers for WebRTC |

5. Set **Health Check Path** to:
   ```
   /api/health
   ```

6. Click **Create Web Service**.

---

## 🐳 Method 3: Deploy with Docker on Render

1. Click **New +** → **Web Service**.
2. Select your repository.
3. Under **Runtime**, select **Docker**.
4. Render will automatically build using the included [Dockerfile](file:///e:/PROJECTS/call%20app/Dockerfile).
5. Add the environment variables listed above.
6. Click **Deploy**.

---

## 🔍 Verifying the Deployment

Once Render finishes deploying:

1. Open your Render URL: `https://<your-app-name>.onrender.com`
2. Check health endpoint:
   ```bash
   curl https://<your-app-name>.onrender.com/api/health
   ```
   *Expected Response:*
   ```json
   {
     "status": "ok",
     "service": "Internet Call App Signaling Server",
     "timestamp": "..."
   }
   ```
3. Test the Calling Identity API:
   ```bash
   curl https://<your-app-name>.onrender.com/api/v1/identities
   ```
4. Access the web client directly in your browser at `https://<your-app-name>.onrender.com` to make and receive calls.
