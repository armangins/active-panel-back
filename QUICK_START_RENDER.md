# Quick Start: Deploy to Render in 5 Minutes

## 🚀 Fastest Way to Deploy

### Step 1: Fill in `.env.production` file

1. Open `.env.production` in your backend folder
2. Replace these values:
   - `FRONTEND_URL` → Your frontend URL (e.g., `https://yourdomain.com`)
   - `MONGODB_URI` → Get from Render MongoDB service (after creating it)
   - `SESSION_SECRET` → Generate with: `openssl rand -base64 32`
   - `ENCRYPTION_KEY` → Generate with: `openssl rand -base64 32`
   - `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` → If using Google login

### Step 2: Push to GitHub

```bash
cd "/Users/armangins/Desktop/Active Panel Back"
git init
git add .
git commit -m "Backend ready for Render"
git remote add origin https://github.com/YOUR_USERNAME/active-panel-backend.git
git push -u origin main
```

### Step 3: Create MongoDB on Render

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"MongoDB"**
3. Name: `active-panel-db`
4. Click **"Create Database"**
5. Wait 1-2 minutes
6. Copy the connection string

### Step 4: Update `.env.production` with MongoDB URI

- Paste the MongoDB connection string into `MONGODB_URI` in `.env.production`

### Step 5: Create Web Service on Render

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `active-panel-backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

### Step 6: Upload Environment Variables

1. In your web service → **"Environment"** tab
2. Click **"Add from .env"** button
3. Select your `.env.production` file
4. ✅ All variables imported!

### Step 7: Deploy

1. Click **"Manual Deploy"** → **"Deploy latest commit"**
2. Wait 2-5 minutes
3. ✅ Your backend is live!

### Step 8: Get Your Backend URL

- Your backend URL will be: `https://active-panel-backend.onrender.com`
- Update your frontend `VITE_API_URL` to: `https://active-panel-backend.onrender.com/api`

---

## 🎉 Done!

Your backend is now live on Render!

**Test it**: Visit `https://active-panel-backend.onrender.com/health`

---

## 📝 Notes

- **`.env.production` is in `.gitignore`** - it won't be committed to Git ✅
- **Save your `ENCRYPTION_KEY`** - you'll need it if you redeploy!
- **Free tier services sleep** after 15 minutes of inactivity
- **First request after sleep** may be slow (cold start)

---

## 🔧 Generate Secrets

```bash
# Session Secret
openssl rand -base64 32

# Encryption Key
openssl rand -base64 32
```

---

For detailed instructions, see `RENDER_DEPLOYMENT.md`
