# Environment Variables Checklist for Production

## Critical Environment Variables

### Backend (Render/Server)

1. **FRONTEND_URL** ⚠️ CRITICAL
   - Must be the exact frontend URL (e.g., `https://yourdomain.com`)
   - No trailing slash
   - Must use HTTPS in production
   - Must match exactly what the browser sees
   - Example: `https://activepanel.com` (NOT `https://activepanel.com/`)

2. **BACKEND_URL** (Optional but recommended)
   - Your backend URL (e.g., `https://active-panel-back.onrender.com`)
   - Used to construct Google OAuth callback URL if `GOOGLE_CALLBACK_URL` is not set
   - Should use HTTPS

3. **GOOGLE_CALLBACK_URL** (Optional)
   - Explicit Google OAuth callback URL
   - Format: `https://your-backend.onrender.com/api/auth/google/callback`
   - Must match EXACTLY what's registered in Google Cloud Console
   - If not set, will be auto-constructed from `BACKEND_URL` or service URL

4. **SESSION_SECRET** ⚠️ CRITICAL
   - Must be set in production
   - Should be a long, random string
   - Generate with: `openssl rand -base64 32`

5. **MONGODB_URI** ⚠️ CRITICAL
   - Your MongoDB connection string
   - Must be set

6. **GOOGLE_CLIENT_ID** (Required for Google OAuth)
   - From Google Cloud Console

7. **GOOGLE_CLIENT_SECRET** (Required for Google OAuth)
   - From Google Cloud Console

### Frontend (Vite/React)

1. **VITE_API_URL** ⚠️ CRITICAL
   - Must be your backend API URL
   - Format: `https://your-backend.onrender.com/api` or just `/api` if same domain
   - Must use HTTPS in production
   - Example: `https://active-panel-back.onrender.com/api`

## Common Issues

### Issue: Redirected back to login after Google OAuth

**Possible Causes:**
1. ❌ `FRONTEND_URL` doesn't match the actual frontend domain
2. ❌ `FRONTEND_URL` has trailing slash (should NOT have one)
3. ❌ `FRONTEND_URL` uses HTTP instead of HTTPS
4. ❌ CORS origin doesn't match (check backend logs)
5. ❌ Session cookie not being set (check browser DevTools → Application → Cookies)
6. ❌ `GOOGLE_CALLBACK_URL` doesn't match Google Cloud Console
7. ❌ `SESSION_SECRET` not set or changed (invalidates existing sessions)

### How to Debug

1. **Check Backend Logs:**
   - Look for "Frontend URL configured: ..." message
   - Check for CORS errors
   - Check for session errors

2. **Check Browser DevTools:**
   - Network tab: Check if `/api/auth/me` returns 401
   - Application tab → Cookies: Check if `connect.sid` cookie exists
   - Console: Check for CORS errors

3. **Verify Environment Variables:**
   ```bash
   # On Render, check environment variables in dashboard
   # Make sure:
   # - FRONTEND_URL = https://yourdomain.com (no trailing slash)
   # - SESSION_SECRET is set
   # - GOOGLE_CALLBACK_URL matches Google Cloud Console
   ```

4. **Test Session Cookie:**
   - After OAuth redirect, check if `connect.sid` cookie exists
   - Cookie should have:
     - `Secure` flag (HTTPS only)
     - `SameSite=None` (for cross-origin)
     - `HttpOnly` flag
     - Path: `/`

## Quick Fix Checklist

- [ ] `FRONTEND_URL` is set correctly (no trailing slash, HTTPS)
- [ ] `SESSION_SECRET` is set and not empty
- [ ] `GOOGLE_CALLBACK_URL` matches Google Cloud Console exactly
- [ ] `VITE_API_URL` points to correct backend
- [ ] CORS allows the frontend domain
- [ ] Session cookie is being set (check browser)
- [ ] Both frontend and backend use HTTPS

## Testing

1. Clear browser cookies
2. Try Google OAuth login
3. Check browser DevTools → Application → Cookies for `connect.sid`
4. Check Network tab for `/api/auth/me` response
5. If cookie exists but still redirected, check CORS and `FRONTEND_URL` match

