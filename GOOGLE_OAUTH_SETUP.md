# Google OAuth Setup Guide

## Overview
This application supports Google OAuth login. Users can sign in with their Google account, and new accounts are automatically created.

## Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **Create Credentials** > **OAuth 2.0 Client ID**
5. Choose **Web application**
6. Add authorized redirect URIs:
   - `http://localhost:5173` (for development frontend)
   - `http://localhost:5000` (for development backend)
   - `http://localhost:5000/api/auth/google/callback` (OAuth callback)
   - Your production URLs (e.g., `https://yourdomain.com`)

7. Copy your **Client ID** and **Client Secret**

## Step 2: Server Configuration

### Create `.env` file in the server directory with:

```env
# Existing variables
JWT_SECRET=supersecret123
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your_email@gmail.com
MAIL_PASS=your_app_password

# Google OAuth (New)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
```

## Step 3: Client Configuration

### Create `.env` file in the client directory with:

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

Or add to `.env.local`:

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

## Step 4: Install Dependencies

### Backend:
```bash
cd server
npm install
```

The following packages will be installed:
- `passport` - Authentication middleware
- `passport-google-oauth20` - Google OAuth strategy
- `express-session` - Session management
- `axios` - HTTP client for token verification

### Frontend:
```bash
cd client
npm install
```

The following packages will be installed:
- `@react-oauth/google` - Google OAuth button component

## Step 5: How Google Login Works

### Backend Flow:
1. User clicks "Sign in with Google" button
2. Google returns a credential token
3. Backend verifies token at `https://oauth2.googleapis.com/tokeninfo`
4. If valid:
   - Check if user exists in database
   - If exists: Update last login time
   - If new: Create user account (default role: "annotator")
5. Generate JWT token
6. Return user data and token to frontend

### Frontend Flow:
1. `GoogleLogin` component displays Google OAuth button
2. On successful authentication, `handleGoogleLogin` is called
3. Sends credential to `/api/auth/google-login`
4. Stores token and user info in localStorage
5. Navigates to appropriate dashboard based on user role

## Database Changes

No database schema changes are required. The system uses existing `users` table with:
- Auto-generated IDs
- Email as unique identifier
- Default role: "annotator"
- is_active: 1 (automatically enabled)

## Login Behavior

### Existing Users:
- Google login with email that already exists → Logs in to existing account
- Password not required for Google OAuth users

### New Users:
- Google login with new email → Automatically creates account
- Default role: "annotator"
- Account is automatically active (is_active = 1)
- Password field has placeholder "google_oauth" (not used)

## Testing

### Local Testing:
1. Start server: `cd server && npm run dev`
2. Start client: `cd client && npm run dev`
3. Go to http://localhost:5173/login
4. Click "Sign in with Google" button
5. Sign in with your Google account
6. Should redirect to appropriate dashboard

### Test Scenarios:
1. **New User**: Sign in with a Google account that doesn't exist in the database
   - New account created automatically as "annotator"
2. **Existing User**: Sign in with a Google account that already exists
   - Logs into existing account
3. **Different Roles**: After login, check the dashboard matches user role
4. **Token Verification**: Token should be valid for 24 hours

## Troubleshooting

### "Invalid client ID" error:
- Check `VITE_GOOGLE_CLIENT_ID` matches your credentials
- Ensure it's set in `.env` file in client directory
- Restart the dev server after updating .env

### "Google login failed" message:
- Check browser console for specific error
- Verify token hasn't expired
- Check backend logs for verification errors
- Ensure Google credentials are valid

### CORS errors:
- Verify redirect URIs are configured in Google Cloud Console
- Check that localhost URLs are authorized
- For production, add your domain to authorized URIs

### User not created:
- Check server database connection
- Verify email isn't already in database
- Check server logs for database errors
- Ensure user table exists with correct schema

## Security Notes

1. **Token Verification**: Uses Google's official token endpoint for verification
2. **HTTPS**: Use HTTPS in production
3. **Client ID in Frontend**: Client ID is not sensitive (publicly visible in code)
4. **Client Secret**: Keep secret server-side only, never expose in frontend
5. **Session Tokens**: JWT tokens expire after 24 hours
6. **Auto-Created Accounts**: New users get "annotator" role (lowest permissions)

## Additional Configuration

### Change default role for new Google users:
Edit [auth.routes.js](server/src/routes/auth.routes.js#L440):
```javascript
const defaultRole = "annotator"; // Change this to another role
```

### Disable auto-account creation:
Modify the backend to reject new users instead of creating accounts

### Add email verification for Google users:
Email is verified by Google, but you can add additional verification if needed

## Support

For issues with Google OAuth setup:
- Google Cloud Console: https://console.cloud.google.com
- Google OAuth Documentation: https://developers.google.com/identity/protocols/oauth2
- @react-oauth/google: https://www.npmjs.com/package/@react-oauth/google
