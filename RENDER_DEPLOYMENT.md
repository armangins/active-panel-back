# Deploy Backend to Render - Step by Step Guide

This guide will help you deploy your backend to Render.com.

## Prerequisites

1. ✅ Backend code is ready and secure (no sensitive data in code)
2. ✅ Backend is pushed to GitHub
3. ✅ You have a Render account (sign up at https://render.com)

---

## Step 1: Push Backend to GitHub

1. **Initialize Git** (if not already done):
   ```bash
   cd "/Users/armangins/Desktop/Active Panel Back"
   git init
   git add .
   git commit -m "Initial commit - Backend ready for Render deployment"
   ```

2. **Create a new GitHub repository**:
   - Go to https://github.com/new
   - Name it: `active-panel-backend` (or your preferred name)
   - **Don't** initialize with README, .gitignore, or license
   - Click "Create repository"

3. **Push your code**:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/active-panel-backend.git
   git branch -M main
   git push -u origin main
   ```

---

## Step 2: Create MongoDB Database on Render

1. **Go to Render Dashboard**: https://dashboard.render.com
2. Click **"New +"** → **"MongoDB"**
3. Configure:
   - **Name**: `active-panel-db`
   - **Database Name**: `activepanel`
   - **User**: `activepanel`
   - **Plan**: Free (or choose a paid plan)
4. Click **"Create Database"**
5. **Wait for it to provision** (takes 1-2 minutes)
6. **Copy the connection string** (you'll need it later)

---

## Step 3: Create Web Service on Render

### Option A: Using render.yaml (Recommended)

1. **Go to Render Dashboard**: https://dashboard.render.com
2. Click **"New +"** → **"Blueprint"**
3. **Connect your GitHub repository**:
   - Select your `active-panel-backend` repository
   - Render will detect `render.yaml` automatically
4. Click **"Apply"**
5. Render will create both the database and web service automatically

### Option B: Manual Setup

1. **Go to Render Dashboard**: https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. **Connect GitHub**:
   - Click **"Connect GitHub"** if not already connected
   - Authorize Render to access your repositories
   - Select your `active-panel-backend` repository
4. **Configure the service**:
   - **Name**: `active-panel-backend`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: (leave empty)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or choose a paid plan)

---

## Step 4: Configure Environment Variables

You have **two options** to set environment variables:

### Option A: Upload .env File (Easiest! ⭐)

1. **Open `.env.production`** file in your backend folder
2. **Fill in all the values**:
   - Replace `YOUR_PASSWORD` with your MongoDB password (from Render MongoDB service)
   - Replace `YOUR_SESSION_SECRET_HERE` with a generated secret (see below)
   - Replace `YOUR_ENCRYPTION_KEY_HERE` with a generated key (see below)
   - Replace `https://yourdomain.com` with your actual frontend URL
   - Update MongoDB URI with your actual connection string from Render
3. **Generate secrets** (if needed):
   ```bash
   # Generate SESSION_SECRET
   openssl rand -base64 32
   
   # Generate ENCRYPTION_KEY
   openssl rand -base64 32
   ```
4. **In Render Dashboard**:
   - Go to your web service → **"Environment"** tab
   - Click **"Add from .env"** button
   - Select your `.env.production` file
   - All variables will be imported automatically! ✅

### Option B: Add Variables Manually

In your Render web service dashboard, go to **"Environment"** tab and add each variable:

#### Required Variables:

1. **NODE_ENV**
   - Value: `production`

2. **FRONTEND_URL**
   - Value: Your frontend URL (e.g., `https://yourdomain.com` or `https://your-app.onrender.com`)
   - This is where your React app is hosted

3. **MONGODB_URI**
   - Value: Copy from your MongoDB database service
   - Format: `mongodb://activepanel:PASSWORD@dpg-xxxxx-a/activepanel`
   - Or use the **"Connect"** button in MongoDB service to copy the connection string

4. **SESSION_SECRET**
   - Generate a secure random string:
     ```bash
     openssl rand -base64 32
     ```
   - Or let Render auto-generate it (if using render.yaml with `generateValue: true`)

5. **ENCRYPTION_KEY** ⚠️ **CRITICAL**
   - Generate a secure random string (at least 32 characters):
     ```bash
     openssl rand -base64 32
     ```
   - **IMPORTANT**: Save this key! If you lose it, all encrypted WooCommerce credentials will be unreadable
   - **IMPORTANT**: Use the same key if you redeploy or change services

#### Optional Variables:

6. **GOOGLE_CLIENT_ID**
   - Only if using Google OAuth login
   - Get from: https://console.cloud.google.com/apis/credentials

7. **GOOGLE_CLIENT_SECRET**
   - Only if using Google OAuth login
   - Get from: https://console.cloud.google.com/apis/credentials

---

## Step 5: Update Google OAuth Callback URL (if using Google login)

1. Go to https://console.cloud.google.com/apis/credentials
2. Edit your OAuth 2.0 Client ID
3. Add authorized redirect URI:
   ```
   https://your-backend-name.onrender.com/api/auth/google/callback
   ```
   Replace `your-backend-name` with your actual Render service name

---

## Step 6: Deploy

1. **Save all environment variables** in Render dashboard
2. **Click "Manual Deploy"** → **"Deploy latest commit"**
3. **Wait for deployment** (takes 2-5 minutes)
4. **Check logs** to ensure deployment succeeded

---

## Step 7: Verify Deployment

1. **Check health endpoint**:
   ```
   https://your-backend-name.onrender.com/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

2. **Check root endpoint**:
   ```
   https://your-backend-name.onrender.com/
   ```
   Should return: `{"message":"Active Panel API is running"}`

3. **Check logs** in Render dashboard for any errors

---

## Step 8: Update Frontend API URL

1. **Update your frontend** `.env.production` or GitHub Secrets:
   ```
   VITE_API_URL=https://your-backend-name.onrender.com/api
   ```

2. **Redeploy frontend** (if needed)

---

## Troubleshooting

### Issue: "Cannot connect to MongoDB"

**Solution:**
- Verify `MONGODB_URI` is correct in environment variables
- Check MongoDB service is running in Render dashboard
- Ensure MongoDB service name matches what's in `render.yaml` (if using)

### Issue: "SESSION_SECRET is required"

**Solution:**
- Add `SESSION_SECRET` environment variable in Render dashboard
- Generate with: `openssl rand -base64 32`

### Issue: "ENCRYPTION_KEY is required"

**Solution:**
- Add `ENCRYPTION_KEY` environment variable in Render dashboard
- Generate with: `openssl rand -base64 32`
- **Important**: Use the same key as your local development if you have existing encrypted data

### Issue: CORS errors from frontend

**Solution:**
- Verify `FRONTEND_URL` in backend environment variables matches your frontend URL exactly
- Include protocol (`https://`) and no trailing slash
- Example: `https://yourdomain.com` (not `https://yourdomain.com/`)

### Issue: Service keeps restarting

**Solution:**
- Check logs in Render dashboard
- Verify all required environment variables are set
- Check `package.json` has correct `start` script: `"start": "node src/app.js"`

### Issue: Build fails

**Solution:**
- Check build logs in Render dashboard
- Verify `package.json` is correct
- Ensure all dependencies are in `dependencies` (not `devDependencies`)

---

## Security Checklist

Before deploying, ensure:

- ✅ No `.env` file is committed to Git
- ✅ `.gitignore` excludes `.env`, `*.log`, `*.sqlite`
- ✅ No hardcoded secrets in code
- ✅ `SESSION_SECRET` is set in Render (not using default)
- ✅ `ENCRYPTION_KEY` is set in Render
- ✅ `FRONTEND_URL` matches your actual frontend URL
- ✅ MongoDB connection string is secure

---

## Render Free Tier Limitations

- **Services sleep after 15 minutes of inactivity** (wakes up on next request)
- **First request after sleep may be slow** (cold start)
- **Limited to 750 hours/month** (enough for always-on if single service)
- **MongoDB free tier**: 512 MB storage, shared CPU

**For production**, consider upgrading to a paid plan for:
- Always-on services (no sleep)
- Better performance
- More resources

---

## Next Steps

1. ✅ Backend deployed to Render
2. ✅ Frontend deployed to Hostinger (already done)
3. ✅ Update frontend `VITE_API_URL` to point to Render backend
4. ✅ Test the full application

**Your backend is now live on Render!** 🚀

---

## Useful Commands

**Generate secure random strings:**
```bash
# Session secret
openssl rand -base64 32

# Encryption key
openssl rand -base64 32
```

**Check Render service status:**
- Dashboard: https://dashboard.render.com
- Logs: Available in service dashboard

**Update environment variables:**
- Go to service → Environment tab → Edit variables → Save
