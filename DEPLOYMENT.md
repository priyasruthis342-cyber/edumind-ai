# EduMind AI — Production Cloud Deployment Guide

This guide details how to deploy EduMind AI to production cloud hosting platforms like **Render**, **Railway**, and **Vercel**.

---

## 🚀 Deployment Options

### Option 1: Full-Stack All-in-One Deployment (Render or Railway)
Deploy the entire project (Express API + Vite React Single Page Application) as a single Web Service on Render or Railway. Express automatically serves the compiled static frontend from `/dist` while handling all `/api/*` endpoints.

#### Render / Railway Web Service Settings:
* **Environment:** Node.js
* **Build Command:**
  ```bash
  npm run build:all
  ```
  *(Runs `npm run build` for the frontend and `cd .bolt/backend && npm install` for the backend)*
* **Start Command:**
  ```bash
  npm start
  ```
  *(Executes `node .bolt/backend/server.js`)*
* **Health Check Path:** `/api/health`

---

### Option 2: Split Deployment (Vercel Frontend + Render/Railway Backend)

#### A. Backend (Render / Railway Web Service):
* **Root Directory:** `.bolt/backend`
* **Build Command:** `npm install`
* **Start Command:** `npm start`
* **Health Check Path:** `/api/health`
* **Environment Variables:** Set all backend variables (see below).

#### B. Frontend (Vercel or Netlify):
* **Root Directory:** `.` (Repository root)
* **Framework Preset:** Vite
* **Build Command:** `npm run build`
* **Output Directory:** `dist`
* **Environment Variables:**
  * `VITE_API_URL`: Your backend URL (e.g., `https://edumind-backend.onrender.com`)
  * `VITE_SUPABASE_URL`: Supabase project URL
  * `VITE_SUPABASE_ANON_KEY`: Supabase anon key
  * `VITE_RAZORPAY_KEY_ID`: Razorpay key ID

---

## 🔐 Required Environment Variables Reference

| Variable Name | Required By | Description | Example / Recommended Value |
|---|---|---|---|
| `PORT` | Backend | Port number for the Express server (auto-assigned on Render/Railway) | `5050` |
| `NODE_ENV` | Backend | Runtime mode | `production` |
| `MONGODB_URI` | Backend | MongoDB Atlas Connection String | `mongodb+srv://user:pass@cluster.mongodb.net/edumaind?retryWrites=true&w=majority` |
| `GEMINI_API_KEY` | Backend | Google Gemini API Key for Anna University Exam Q&A and Story synthesis | `AQ.Ab8RN6...` |
| `GROQ_API_KEY` | Backend | Groq API Key (high-speed fallback model `openai/gpt-oss-120b`) | `gsk_...` |
| `RAZORPAY_KEY_ID` | Both | Razorpay Key ID for ₹1 Daily Pass checkout | `rzp_test_TwxrpdkuvcZNdH` |
| `RAZORPAY_KEY_SECRET` | Backend | Razorpay Secret for order creation & signature verification | `996rZ...` |
| `CORS_ORIGIN` | Backend | Allowed frontend origins (comma-separated or `*`) | `*` or `https://edumind.vercel.app` |
| `VITE_API_URL` | Frontend | Cloud backend base URL (omit or leave empty for same-domain full-stack) | `https://edumind-backend.onrender.com` |
| `VITE_SUPABASE_URL` | Frontend | Supabase project URL | `https://yspneuzrsraonftghccm.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Supabase anonymous public key | `sb_publishable_...` |

---

## 🛡️ Critical Production Checklist

1. **MongoDB Atlas IP Whitelist:**
   * Go to **MongoDB Atlas** -> **Network Access** -> **IP Access List**.
   * Add `0.0.0.0/0` (Allow access from anywhere). Cloud platforms like Render and Railway use dynamic outbound IP addresses.
2. **CORS Configuration:**
   * If splitting frontend and backend across domains (e.g. Vercel and Render), set `CORS_ORIGIN=https://your-frontend.vercel.app` or keep `CORS_ORIGIN=*`.
3. **Razorpay Webhooks & Test Mode:**
   * Keys configured match the Razorpay Test Mode environment.
   * End-users can complete test transactions using standard Razorpay Test UPI (`success@razorpay`) or Test Cards (`4111 1111 1111 1111`).
4. **Vite Dynamic API Routing:**
   * `src/lib/apiConfig.ts` automatically detects production mode and prevents accidental connections to `localhost:5050`.

