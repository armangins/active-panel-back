# MongoDB Atlas Connection Troubleshooting

## SSL Alert Internal Error 80 - Multiple Potential Causes

The error `tlsv1 alert internal error` (SSL alert 80) can have several causes. Check them in order:

### 1. ✅ IP Whitelisting (Most Common)

**Check:** MongoDB Atlas → Network Access → IP Access List

**Fix:**
- Add `0.0.0.0/0` (allows all IPs) for testing
- Or add Render's specific IP ranges
- Wait 1-2 minutes after adding IPs

### 2. ⚠️ Node.js Version Compatibility

**Issue:** Node.js 22 might have SSL/TLS compatibility issues with MongoDB Atlas

**Your current:** Node.js v22.16.0 (from error logs)

**Fix options:**

**Option A: Pin Node.js 20 LTS in Render**
1. Go to Render Dashboard → Your Service → Settings
2. Find "Node Version" or "Environment"
3. Set to: `20` or `20.x.x` (LTS version)
4. Save and redeploy

**Option B: Add `.nvmrc` file** (recommended)
Create `.nvmrc` in root directory:
```
20
```

Then Render will use Node.js 20 automatically.

### 3. 🔧 Connection String Format

**Verify your `MONGODB_URI` format:**

✅ **Correct format:**
```
mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
```

❌ **Common mistakes:**
- Missing `mongodb+srv://` prefix
- Special characters in password not URL-encoded
- Wrong database name
- Missing query parameters

**Check in Render:**
1. Go to Environment tab
2. Check `MONGODB_URI` value
3. Verify it matches MongoDB Atlas connection string exactly

### 4. 🔐 Database User Permissions

**Check:** MongoDB Atlas → Database Access → Your User

**Required permissions:**
- **Atlas admin** (for full access), OR
- **Read and write to any database** (minimum)

**Fix:**
1. Edit your database user
2. Set permissions to "Read and write to any database"
3. Save changes

### 5. 🌐 OpenSSL Security Level (Ubuntu 24.04)

**Issue:** Render might use Ubuntu 24.04 with OpenSSL security level 2, causing compatibility issues

**Check:** This is usually handled automatically, but if issues persist:
- Try downgrading Node.js to version 20
- Or update Mongoose to latest version

### 6. 📦 Mongoose/MongoDB Driver Version

**Your current:** Mongoose 9.0.0

**Check compatibility:**
- Mongoose 9.x should work with MongoDB Atlas
- But if issues persist, try updating to latest patch version

**Update command:**
```bash
npm update mongoose mongodb
```

### 7. 🔍 Connection String Source

**Important:** Are you using:
- ✅ MongoDB Atlas connection string (from Atlas dashboard)?
- ❌ Render MongoDB connection string (if you created MongoDB on Render)?

**If using Render MongoDB:**
- Use the **Internal Connection String** (not external)
- Format: `mongodb://username:password@host:port/database`
- Should NOT use `mongodb+srv://` format

**If using MongoDB Atlas:**
- Use connection string from Atlas → Connect → Connect your application
- Format: `mongodb+srv://username:password@cluster.mongodb.net/database`

## Diagnostic Steps

### Step 1: Check Connection String Format

In Render Dashboard → Environment → `MONGODB_URI`:
- Does it start with `mongodb+srv://`? (Atlas)
- Or `mongodb://`? (Render MongoDB or self-hosted)

### Step 2: Test Connection String Locally

```bash
# Test from your local machine
node -e "
const mongoose = require('mongoose');
mongoose.connect('YOUR_CONNECTION_STRING')
  .then(() => console.log('✅ Connected'))
  .catch(err => console.error('❌ Error:', err.message));
"
```

### Step 3: Check Render Logs

Look for these log messages:
- `🔌 Connecting to MongoDB...`
- `📍 URI: mongodb+srv://...` (password hidden)
- `✅ MongoDB Connected:` (success)
- `❌ MongoDB Connection Error:` (failure with details)

### Step 4: Verify All Environment Variables

In Render → Environment tab, ensure:
- ✅ `MONGODB_URI` is set and correct
- ✅ `NODE_ENV` = `production`
- ✅ `FRONTEND_URL` is set
- ✅ `SESSION_SECRET` is set
- ✅ `ENCRYPTION_KEY` is set

## Quick Fix Checklist

Try these in order:

1. [ ] **IP Whitelisting**: Add `0.0.0.0/0` to MongoDB Atlas Network Access
2. [ ] **Node.js Version**: Pin to Node.js 20 LTS in Render settings
3. [ ] **Connection String**: Verify format and copy from MongoDB Atlas exactly
4. [ ] **Database User**: Check permissions in MongoDB Atlas
5. [ ] **Update Code**: Push latest `database.js` changes
6. [ ] **Redeploy**: Trigger new deployment on Render

## Still Not Working?

1. **Check MongoDB Atlas Status**: https://status.mongodb.com/
2. **Check Render Status**: https://status.render.com/
3. **Review Full Error Logs**: Render Dashboard → Logs → Copy full error
4. **Test Connection String**: Use MongoDB Compass or `mongosh` to test connection string directly

## Alternative: Use Render MongoDB Instead

If MongoDB Atlas continues to have issues, consider using Render's MongoDB:

1. **Create MongoDB on Render:**
   - Render Dashboard → New → MongoDB
   - Name: `active-panel-db`
   - Database: `activepanel`
   - User: `activepanel`

2. **Get Internal Connection String:**
   - MongoDB Service → Connect → Internal Connection String
   - Format: `mongodb://username:password@host:port/database`

3. **Update MONGODB_URI in Render:**
   - Web Service → Environment → `MONGODB_URI`
   - Paste internal connection string

4. **No IP whitelisting needed** (internal network)
