# 🔗 Social Media Connections - Complete Technical Documentation

## 📋 Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Supported Platforms](#supported-platforms)
- [Database Schema](#database-schema)
- [OAuth 2.0 Flow](#oauth-20-flow)
- [API Endpoints](#api-endpoints)
- [Request & Response Formats](#request--response-formats)
- [Token Management](#token-management)
- [Posting Flow](#posting-flow)
- [Error Handling](#error-handling)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)

---

## Overview

This application uses **OAuth 2.0** to connect users' social media accounts and enable automated posting across multiple platforms. The system stores access tokens securely in the database and associates them with individual user accounts for multi-user support.

### Key Features
- ✅ Multi-platform OAuth 2.0 authentication
- ✅ Secure token storage per user
- ✅ PKCE (Proof Key for Code Exchange) for enhanced security
- ✅ Token refresh capabilities
- ✅ Multi-user support with isolated credentials
- ✅ Popup-based and redirect-based OAuth flows

---

## Architecture

### High-Level Flow
```
User → Dashboard UI → Connect Request → OAuth Provider → Callback Handler → Token Storage → Database
                                     ↓
                                 User Grants Permission
                                     ↓
                             Provider Redirects Back
                                     ↓
                          Backend Exchanges Code for Token
                                     ↓
                           Store Token in Database
```

### Components

1. **Client-Side (`client/src/`)**
   - `components/dashboard/social-media-manager.tsx` - OAuth connection UI
   - `lib/oauth-redirect.ts` - OAuth redirect helper (mobile-friendly)

2. **Server-Side (`server/`)**
   - `routes.ts` - OAuth endpoints (connect, callback)
   - `services/socialMedia.ts` - Posting service
   - `storage.ts` - Database interaction layer

3. **Database**
   - `social_media_accounts` table - Stores OAuth tokens per user

---

## Supported Platforms

| Platform | OAuth Version | PKCE Required | Scopes |
|----------|---------------|---------------|--------|
| **Twitter/X** | OAuth 2.0 | ✅ Yes (S256) | `tweet.read tweet.write users.read offline.access` |
| **LinkedIn** | OAuth 2.0 | ❌ No | `openid profile email w_member_social` |
| **Facebook** | OAuth 2.0 | ❌ No | `pages_manage_posts pages_read_engagement` |
| **Instagram** | OAuth 2.0 (via Facebook) | ❌ No | `instagram_content_publish pages_manage_posts` |
| **YouTube** | OAuth 2.0 (Google) | ❌ No | `youtube.upload youtube.force-ssl` |
| **TikTok** | OAuth 2.0 | ✅ Yes (S256) | `user.info.basic video.publish video.upload` |

---

## Database Schema

### Table: `social_media_accounts`

Stores OAuth tokens and connection status for each user's connected social media accounts.

```typescript
{
  id: varchar (UUID, primary key)
  userId: varchar (references users.id)
  platform: text // 'facebook', 'instagram', 'linkedin', 'x', 'twitter', 'youtube', 'tiktok'
  accessToken: text // OAuth access token (encrypted at rest)
  refreshToken: text // OAuth refresh token (for token renewal)
  tokenExpiresAt: timestamp // Token expiration time
  isConnected: boolean // Connection status (default: false)
  accountUsername: text // Social media username/handle
  accountId: text // Platform-specific account ID
  metadata: jsonb // Platform-specific data (profile info, etc.)
  lastSynced: timestamp // Last sync/validation time
  createdAt: timestamp
  connectedAt: timestamp
}
```

### Related Tables

#### `users` Table
Stores user profile URLs for social platforms:
```typescript
{
  id: varchar (UUID)
  username: text
  email: text
  facebookUrl: text
  instagramUrl: text
  linkedinUrl: text
  xUrl: text
  youtubeUrl: text
  tiktokUrl: text
  // ... other user fields
}
```

#### `social_api_keys` Table (Legacy)
Stores API keys/credentials (deprecated in favor of OAuth):
```typescript
{
  id: varchar (UUID)
  userId: varchar
  facebookAppId: text
  facebookAppSecret: text
  instagramToken: text
  twitterApiKey: text
  linkedinAccessToken: text
  youtubeApiKey: text
  // ... other platform credentials
}
```

### Database Indexes
- Index on `userId` for fast user lookup
- Index on `platform` for platform filtering
- Composite index on `(userId, platform)` for unique constraints

---

## OAuth 2.0 Flow

### Step 1: Initiate Connection

**Client Request:**
```javascript
// User clicks "Connect" button
const response = await fetch('/api/social/connect/linkedin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
});

const data = await response.json();
// { authUrl: "https://linkedin.com/oauth/v2/authorization?..." }
```

**Server Process:**
1. Verify user authentication (`requireAuth` middleware)
2. Extract stable database user ID from session (`req.user.id`)
3. Generate `state` parameter: `base64({ userId, platform })`
4. For PKCE platforms (Twitter, TikTok):
   - Generate `codeVerifier` (43-128 characters)
   - Calculate `codeChallenge` = SHA256(codeVerifier)
   - Store verifier in database with 10-minute expiration
5. Build OAuth authorization URL with required parameters
6. Return `authUrl` to client

**Authorization URL Structure:**
```
https://provider.com/oauth/authorize?
  response_type=code
  &client_id=${CLIENT_ID}
  &redirect_uri=${CALLBACK_URL}
  &scope=${SCOPES}
  &state=${STATE}
  &code_challenge=${CHALLENGE}      // PKCE platforms only
  &code_challenge_method=S256        // PKCE platforms only
```

### Step 2: User Authorization

1. Client opens popup window or redirects to `authUrl`
2. User logs in to social platform (if not already logged in)
3. User reviews and grants permissions
4. Provider redirects to callback URL with `code` and `state`

### Step 3: Callback Handling

**Endpoint:** `GET /api/social/callback/:platform`

**Query Parameters:**
- `code` - Authorization code from provider
- `state` - State parameter (base64 encoded)
- `error` - Error code (if authorization failed)

**Server Process:**

```typescript
// 1. Decode state to get userId
const stateData = JSON.parse(
  Buffer.from(state, 'base64').toString()
);
const userId = stateData.userId;

// 2. For PKCE platforms: Retrieve code verifier
const verifier = await getPKCE(state);

// 3. Exchange authorization code for access token
const tokenResponse = await fetch(PROVIDER_TOKEN_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: CALLBACK_URL,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code_verifier: verifier  // PKCE platforms only
  })
});

// 4. Extract tokens from response
const { access_token, refresh_token, expires_in } = await tokenResponse.json();

// 5. Save to database
await storage.createSocialMediaAccount({
  userId: userId,
  platform: platform,
  accessToken: access_token,
  refreshToken: refresh_token,
  tokenExpiresAt: new Date(Date.now() + expires_in * 1000),
  isConnected: true
});

// 6. Return success page with postMessage to close popup
res.send(`
  <html>
    <body>
      <h1>✅ Connected Successfully!</h1>
      <script>
        window.opener?.postMessage({ success: true, platform: '${platform}' }, '*');
        setTimeout(() => window.close(), 2000);
      </script>
    </body>
  </html>
`);
```

### Step 4: Token Storage

Tokens are stored in the `social_media_accounts` table with the following data:

```typescript
{
  userId: "user-uuid-123",
  platform: "linkedin",
  accessToken: "AQXdSP_N_....very-long-token",
  refreshToken: "AQXdSP_N_....refresh-token",
  tokenExpiresAt: "2026-03-22T10:30:00Z",
  isConnected: true,
  accountUsername: "johndoe",
  metadata: {
    profileId: "abc123",
    profileName: "John Doe",
    profileEmail: "john@example.com"
  }
}
```

---

## API Endpoints

### 1. Connect Endpoint

**POST** `/api/social/connect/:platform`

Start OAuth flow for a social media platform.

**Authentication:** Required (Bearer token or session cookie)

**Parameters:**
- `:platform` - Platform name (`facebook`, `instagram`, `linkedin`, `x`, `twitter`, `youtube`, `tiktok`)

**Request:**
```bash
curl -X POST https://app.example.com/api/social/connect/linkedin \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response (200 OK):**
```json
{
  "authUrl": "https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=...",
  "message": "OAuth URL generated successfully"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "OAuth not configured for linkedin",
  "message": "Please add LINKEDIN_CLIENT_ID to Replit Secrets to enable OAuth"
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "User not authenticated"
}
```

---

### 2. Callback Endpoint

**GET** `/api/social/callback/:platform`

Handle OAuth callback from provider.

**Authentication:** Not required (state parameter validates user)

**Query Parameters:**
- `code` - Authorization code from provider
- `state` - Base64-encoded state (contains userId and platform)
- `error` (optional) - Error code if authorization failed

**Success Response:**
Returns HTML page with JavaScript to close popup and notify parent window.

**Error Redirect:**
Redirects to app homepage with error query parameter:
```
https://app.example.com/?oauth_error=token_exchange_failed
```

---

### 3. Disconnect Endpoint

**POST** `/api/social/disconnect/:platform`

Disconnect a social media account.

**Authentication:** Required

**Request:**
```bash
curl -X POST https://app.example.com/api/social/disconnect/linkedin \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "linkedin account disconnected successfully",
  "account": {
    "id": "account-uuid-123",
    "platform": "linkedin",
    "isConnected": false
  }
}
```

**Response (404 Not Found):**
```json
{
  "error": "Account not found",
  "message": "No linkedin account found for this user"
}
```

---

### 4. Status Endpoint

**GET** `/api/social/status/:platform`

Check connection status for a platform.

**Response:**
```json
{
  "connected": true,
  "platform": "linkedin",
  "accountUsername": "johndoe",
  "lastSynced": "2026-02-22T10:30:00Z"
}
```

---

### 5. Posting Endpoints

#### Twitter/X Post

**POST** `/api/twitter/post`

Post a tweet to Twitter/X.

**Authentication:** Required

**Request Body:**
```json
{
  "content": "Check out our new restaurant menu! 🍕",
  "photoUrls": ["https://example.com/photo1.jpg"],
  "videoUrls": []
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "postId": "1234567890123456789",
  "message": "Posted to Twitter successfully"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Twitter account not connected. Please connect your Twitter/X account first."
}
```

---

#### LinkedIn Post

**POST** `/api/linkedin/post`

Share content on LinkedIn.

**Request Body:**
```json
{
  "content": "Exciting news from our team! 🎉",
  "photoUrls": ["https://example.com/photo.jpg"]
}
```

**Response:**
```json
{
  "success": true,
  "postId": "urn:li:share:1234567890",
  "message": "Posted to LinkedIn successfully"
}
```

---

#### Facebook Post

**POST** `/api/facebook/post`

Post to Facebook page.

**Request Body:**
```json
{
  "content": "Join us for dinner tonight!",
  "pageId": "123456789012345",
  "photoUrls": ["https://example.com/photo.jpg"]
}
```

---

#### Instagram Post

**POST** `/api/instagram/post`

Create Instagram post.

**Request Body:**
```json
{
  "content": "Delicious food alert! 📸",
  "imageUrl": "https://example.com/photo.jpg",
  "instagramUserId": "123456789"
}
```

---

#### YouTube Upload

**POST** `/api/youtube/post`

Upload video to YouTube.

**Request:** Multipart form-data
```
title: "Property Tour Video"
description: "Amazing 3BR home in downtown"
video: [file upload]
```

**Response:**
```json
{
  "success": true,
  "postId": "dQw4w9WgXcQ",
  "watchUrl": "https://youtube.com/watch?v=dQw4w9WgXcQ",
  "studioUrl": "https://studio.youtube.com/video/dQw4w9WgXcQ/edit"
}
```

---

## Request & Response Formats

### Common Error Response Format

```json
{
  "error": "Error type or message",
  "message": "Detailed error description",
  "details": {
    "code": "ERROR_CODE",
    "field": "fieldName"
  }
}
```

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful request |
| 201 | Created | Resource created (new connection) |
| 400 | Bad Request | Invalid parameters or missing credentials |
| 401 | Unauthorized | Authentication required or failed |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Account or resource not found |
| 500 | Server Error | Internal server error |

---

## Token Management

### Token Retrieval

```typescript
// Server-side: Get user's access token for a platform
const accounts = await storage.getSocialMediaAccounts(userId);
const linkedinAccount = accounts.find(acc => acc.platform === 'linkedin');

if (!linkedinAccount || !linkedinAccount.isConnected) {
  throw new Error('LinkedIn account not connected');
}

const accessToken = linkedinAccount.accessToken;
```

### Token Refresh (LinkedIn Example)

```typescript
async function refreshLinkedInToken(refreshToken: string): Promise<string> {
  const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!
    })
  });
  
  const data = await response.json();
  
  // Update database with new token
  await storage.updateSocialMediaAccount(accountId, {
    accessToken: data.access_token,
    tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000)
  });
  
  return data.access_token;
}
```

### Token Expiration Handling

Most platforms provide tokens that expire after a certain period:

| Platform | Access Token Lifetime | Refresh Token |
|----------|----------------------|---------------|
| Twitter/X | 2 hours | Yes (never expires) |
| LinkedIn | 60 days | Yes |
| Facebook | 60 days (user token) / Never (page token) | Yes |
| Instagram | 60 days | Yes |
| YouTube | 1 hour | Yes (never expires) |
| TikTok | 24 hours | Yes |

---

## Posting Flow

### Overview
```
User Creates Content → Select Platforms → API Call → Retrieve Tokens → Post to Each Platform → Return Results
```

### Detailed Flow

1. **Content Creation**
   - User creates post in dashboard
   - Selects target platforms
   - Optionally uploads media

2. **Token Retrieval**
   ```typescript
   const accounts = await storage.getSocialMediaAccounts(userId);
   const platformAccount = accounts.find(acc => acc.platform === platform);
   ```

3. **Platform-Specific Posting**
   - Each platform has its own service method
   - Methods handle API-specific formatting
   - Media upload happens separately (if required)

4. **Error Handling**
   - Token expired → Attempt refresh → Retry
   - Permission denied → Return user-friendly error
   - Rate limit → Queue for later retry

### Example: Multi-Platform Post

```typescript
async function postToMultiplePlatforms(
  userId: string,
  content: string,
  platforms: string[],
  photoUrls?: string[]
) {
  const results = [];
  
  for (const platform of platforms) {
    try {
      let postId;
      
      switch (platform) {
        case 'twitter':
        case 'x':
          const result = await socialMediaService.postToTwitter(
            userId,
            content,
            undefined,
            { photoUrls }
          );
          postId = result.postId;
          break;
          
        case 'linkedin':
          const linkedinResult = await socialMediaService.postToLinkedIn(
            content,
            userId,
            { photoUrls }
          );
          postId = linkedinResult.postId;
          break;
          
        // ... other platforms
      }
      
      results.push({
        platform,
        success: true,
        postId
      });
      
    } catch (error) {
      results.push({
        platform,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
}
```

---

## Error Handling

### Common Errors

#### 1. Missing Credentials
```json
{
  "error": "OAuth not configured for linkedin",
  "message": "Please add LINKEDIN_CLIENT_ID to environment variables"
}
```

**Fix:** Add required environment variables

---

#### 2. Token Expired
```json
{
  "error": "Twitter authentication failed. Your token may have expired. Please reconnect your Twitter account."
}
```

**Fix:** User must reconnect the account

---

#### 3. Permission Denied
```json
{
  "error": "Twitter posting permission denied: Your account may not have tweet.write permission."
}
```

**Fix:** Check app permissions in developer portal

---

#### 4. Invalid State
```json
{
  "oauth_error": "invalid_state"
}
```

**Fix:** OAuth flow interrupted or tampered with - retry connection

---

#### 5. Duplicate Content
```json
{
  "error": "Twitter posting failed: This content has already been posted. Twitter doesn't allow duplicate tweets."
}
```

**Fix:** Modify content slightly before reposting

---

### Error Codes Reference

| Code | Platform | Description | Resolution |
|------|----------|-------------|------------|
| `missing_credentials` | All | API credentials not configured | Add env variables |
| `token_exchange_failed` | All | Failed to exchange code for token | Check redirect URI in app settings |
| `invalid_state` | All | State parameter mismatch | Retry OAuth flow |
| `user_not_found` | All | User ID from state not found | Check user session |
| `duplicate_content` | Twitter | Duplicate tweet detected | Modify content |
| `403` | Twitter | Permission denied | Reconnect with correct scopes |
| `401` | All | Authentication failed | Token expired - reconnect |
| `429` | All | Rate limit exceeded | Wait and retry later |

---

## Environment Variables

### Required Variables by Platform

#### Twitter/X
```bash
TWITTER_CLIENT_ID=your_client_id
TWITTER_CLIENT_SECRET=your_client_secret
```

#### LinkedIn
```bash
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret
```

#### Facebook
```bash
FACEBOOK_CLIENT_ID=your_app_id        # or FACEBOOK_APP_ID
FACEBOOK_CLIENT_SECRET=your_app_secret # or FACEBOOK_APP_SECRET
```

#### Instagram (uses Facebook OAuth)
```bash
FACEBOOK_CLIENT_ID=your_app_id
FACEBOOK_CLIENT_SECRET=your_app_secret
```

#### YouTube
```bash
YOUTUBE_CLIENT_ID=your_client_id        # Google OAuth
YOUTUBE_CLIENT_SECRET=your_client_secret
```

#### TikTok
```bash
TIKTOK_CLIENT_KEY=your_client_key
TIKTOK_CLIENT_SECRET=your_client_secret
```

### General Configuration
```bash
BASE_URL=https://your-app.example.com  # For OAuth redirects
DB_SCHEMA=public                        # Database schema name
DATABASE_URL=postgresql://...           # Database connection
```

---

## Troubleshooting

### Issue 1: OAuth Popup Blocked

**Symptom:** Popup window doesn't open when clicking "Connect"

**Solution:**
```javascript
// Use redirect-based flow instead
import { initiateOAuthRedirect } from '@/lib/oauth-redirect';
await initiateOAuthRedirect('linkedin', 'connect');
```

---

### Issue 2: Redirect URI Mismatch

**Symptom:** Error after OAuth authorization: "redirect_uri_mismatch"

**Solution:**
1. Check `BASE_URL` environment variable
2. Verify redirect URI in platform developer portal matches:
   - `https://your-app.com/api/social/callback/platform`
3. Include trailing slash if required by platform

---

### Issue 3: Token Not Persisting

**Symptom:** User must reconnect on every page refresh

**Solution:**
- Verify database connection is stable
- Check that `userId` in state matches database user ID
- Look for server restarts during OAuth flow

```typescript
// Debug logging
console.log('User ID from session:', req.user.id);
console.log('User ID from state:', stateData.userId);
```

---

### Issue 4: PKCE Verifier Not Found

**Symptom:** `oauth_error=pkce_verifier_not_found`

**Causes:**
- Server restarted between connect and callback
- PKCE expired (>10 minutes)
- State parameter tampered with

**Solution:**
- Retry connection flow
- Ensure server stays running
- Check PKCE storage implementation

---

### Issue 5: "User Not Found" Error

**Symptom:** Callback fails with user lookup error

**Debug Steps:**
```typescript
// In callback handler
console.log('State decoded:', stateData);
console.log('Looking up user:', userId);

const accounts = await storage.getSocialMediaAccounts(userId);
console.log('Found accounts:', accounts.length);
```

**Common Causes:**
- User ID type mismatch (string vs number)
- Using wrong user ID (MemStorage UUID vs DB ID)
- User deleted between connect and callback

---

### Issue 6: Posting Failed with 403

**Symptom:** "Permission denied" when posting

**Solutions:**
1. **Check App Permissions**
   - Twitter: Ensure app has "Read and write" permissions
   - LinkedIn: Verify scopes include `w_member_social`
   - Facebook: Check page permissions and tokens

2. **Verify Token Scopes**
   ```typescript
   const { scopes } = await getTwitterAccessToken(userId);
   console.log('Token scopes:', scopes);
   // Should include: tweet.write, users.read
   ```

3. **Reconnect Account**
   - Disconnect and reconnect to get fresh token with correct permissions

---

### Diagnostic Commands

#### Check User Accounts
```typescript
import { storage } from './server/storage';

const accounts = await storage.getSocialMediaAccounts('user-id-123');
console.log('Connected accounts:', accounts.map(a => ({
  platform: a.platform,
  connected: a.isConnected,
  hasToken: !!a.accessToken,
  expires: a.tokenExpiresAt
})));
```

#### Test Token Validity
```bash
# Twitter
curl -X GET "https://api.twitter.com/2/users/me" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# LinkedIn
curl -X GET "https://api.linkedin.com/v2/userinfo" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### Check Environment Variables
```typescript
console.log('Twitter credentials:', {
  clientId: !!process.env.TWITTER_CLIENT_ID,
  clientSecret: !!process.env.TWITTER_CLIENT_SECRET
});
```

---

## Database Queries

### Get All Connected Accounts for a User
```sql
SELECT 
  platform,
  is_connected,
  account_username,
  token_expires_at,
  last_synced,
  created_at
FROM social_media_accounts
WHERE user_id = 'user-uuid-123'
  AND is_connected = true;
```

### Find Expired Tokens
```sql
SELECT 
  user_id,
  platform,
  token_expires_at
FROM social_media_accounts
WHERE is_connected = true
  AND token_expires_at < NOW();
```

### Clean Up Disconnected Accounts
```sql
DELETE FROM social_media_accounts
WHERE is_connected = false
  AND created_at < NOW() - INTERVAL '30 days';
```

### User Connection Statistics
```sql
SELECT 
  COUNT(*) as total_connections,
  COUNT(DISTINCT user_id) as unique_users,
  platform,
  COUNT(*) FILTER (WHERE is_connected = true) as active_connections
FROM social_media_accounts
GROUP BY platform;
```

---

## Best Practices

### 1. Security
- ✅ Always use HTTPS for OAuth redirects
- ✅ Encrypt tokens at rest in database
- ✅ Use PKCE for mobile and SPA flows
- ✅ Validate state parameter on callback
- ✅ Set short expiration for PKCE verifiers
- ✅ Don't log access tokens
- ✅ Implement rate limiting on OAuth endpoints

### 2. User Experience
- ✅ Show clear connection status in UI
- ✅ Handle popup blockers gracefully
- ✅ Provide helpful error messages
- ✅ Auto-refresh expired tokens when possible
- ✅ Allow easy disconnection
- ✅ Show last sync time for each account

### 3. Error Handling
- ✅ Catch and log all OAuth errors
- ✅ Provide user-friendly error messages
- ✅ Implement retry logic for transient failures
- ✅ Track failed connection attempts
- ✅ Alert users when tokens are about to expire

### 4. Performance
- ✅ Cache valid tokens in memory (with TTL)
- ✅ Batch multi-platform posts
- ✅ Use connection pooling for database
- ✅ Implement request queuing for rate limits
- ✅ Clean up expired tokens regularly

---

## Additional Resources

### Official Documentation
- [Twitter OAuth 2.0](https://developer.twitter.com/en/docs/authentication/oauth-2-0)
- [LinkedIn OAuth 2.0](https://docs.microsoft.com/en-us/linkedin/shared/authentication/authentication)
- [Facebook Login](https://developers.facebook.com/docs/facebook-login)
- [Instagram Basic Display API](https://developers.facebook.com/docs/instagram-basic-display-api)
- [YouTube Data API](https://developers.google.com/youtube/v3)
- [TikTok Login Kit](https://developers.tiktok.com/doc/login-kit-web)

### Related Files in Codebase
- `server/routes.ts` - OAuth endpoints
- `server/services/socialMedia.ts` - Posting service
- `server/storage.ts` - Database operations
- `client/src/components/dashboard/social-media-manager.tsx` - UI
- `client/src/lib/oauth-redirect.ts` - OAuth helpers
- `shared/schema.ts` - Database schema
- `docs/x-oauth-guide.md` - Twitter-specific guide
- `docs/replit-social-sync.md` - Deployment guide

---

## Summary

The social media connection system provides a robust, secure, and user-friendly way to connect multiple social media accounts using OAuth 2.0. Key highlights:

- **Multi-user support** - Each user has isolated credentials
- **Secure token storage** - Database-backed with encryption
- **PKCE security** - Enhanced security for public clients
- **Platform abstraction** - Unified API for multiple platforms
- **Error resilience** - Comprehensive error handling and recovery
- **Production-ready** - Tested with real OAuth providers

For platform-specific implementation details, refer to the individual platform guides in the `docs/` directory.

---

**Last Updated:** February 22, 2026  
**Version:** 1.0.0  
**Maintainer:** Development Team
