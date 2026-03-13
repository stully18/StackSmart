# Authentication Testing Guide

A complete testing guide for the StackSmart authentication system. This document outlines how to manually test every authentication flow in the application.

## Prerequisites

Before starting any authentication tests, ensure:

1. **Supabase Project Created**
   - Go to https://supabase.com and create a new project
   - Note your Project URL and Anon Key
   - Enable "Email Auth" in Authentication > Providers

2. **Environment Variables Configured**
   - Backend: Copy `.env.example` to `.env` and fill in:
     - `SUPABASE_URL`: Your Supabase project URL
     - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
   - Frontend: Create `.env.local` with:
     - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anon key

3. **Services Running**
   - Backend running at `http://localhost:8000`
   - Frontend running at `http://localhost:3000`
   - Both services running without errors

4. **Browser Setup**
   - Clear browser cache/cookies before starting
   - Use a modern browser (Chrome, Firefox, Safari, Edge)
   - Open DevTools Console (F12) to watch for errors

## Test 1: Sign Up Flow

This test verifies that new users can create accounts successfully.

### Steps

1. Open browser to `http://localhost:3000/auth/signup`
2. Enter the following:
   - **Full Name**: "Test User One"
   - **Email**: "testuser1@example.com"
   - **Password**: "TestPass123456!" (12+ chars, upper/lower/numbers/special)
   - **Confirm Password**: Same as above

### Expected Behavior

- Password strength indicator shows "Strong" (green bar fills completely)
- "Sign Up" button changes to "Creating account..." while loading
- After 1-2 seconds, page redirects to `/auth/verify-email` page
- In DevTools Console, no errors appear
- User sees message about verification email (check spam folder)

### What to Check in Supabase Dashboard

1. Go to https://app.supabase.com > Your Project > Authentication > Users
2. Verify "testuser1@example.com" appears in the users list
3. Click the user and verify:
   - Email is correct
   - User has a unique ID
   - Created at timestamp is recent
   - User metadata shows "full_name": "Test User One"

4. Go to SQL Editor and run:
```sql
SELECT id, email, full_name FROM users_public
WHERE email = 'testuser1@example.com';
```
5. Should return one row with matching data

### If Something Goes Wrong

| Problem | Solution |
|---------|----------|
| "Invalid email" error | Use a properly formatted email (e.g., user@example.com) |
| "Password must be at least 8 characters" | Use 8+ character password |
| "Passwords do not match" | Ensure confirm password matches exactly |
| User created but no profile record | Check if `users_public` table exists and has proper permissions |
| "NEXT_PUBLIC_SUPABASE_URL is not defined" | Check `.env.local` has correct env variables |
| RedirectError in console | Might be normal - check if email verification page loads |

---

## Test 2: Email Verification

After signing up, users need to verify their email address.

### Prerequisites
- Complete Test 1 (Sign Up Flow) first

### Steps

1. After sign up, user should be on `/auth/verify-email` page
2. Look for:
   - Message saying "Check your email for verification link"
   - Instructions mentioning spam folder
   - "Resend verification email" button

### Expected Behavior

- Page displays instructions clearly
- If clicking "Resend verification email", page shows confirmation message
- In Supabase dashboard: User's email_confirmed_at should still be null (until they click link)

### Simulating Email Verification

Since this is local development, you have two options:

**Option A: Skip Email Verification (Development Only)**
In Supabase dashboard:
1. Go to Authentication > Providers > Email
2. Turn OFF "Confirm email"
3. Restart frontend

**Option B: Get the Real Verification Link**
In Supabase dashboard:
1. Go to Authentication > Users
2. Click on the user
3. Look for verification link in user details
4. Copy and open in browser - it will confirm the email

### If Something Goes Wrong

| Problem | Solution |
|---------|----------|
| Verify page shows error | Check Supabase URL is correct in `.env.local` |
| Resend button doesn't work | Check backend has correct SUPABASE_URL and SERVICE_ROLE_KEY |
| Email never arrives | Check spam folder; in dev, use Option B above |

---

## Test 3: Login Flow

This test verifies users can sign in with their credentials.

### Prerequisites
- Complete Test 1 (Sign Up Flow)
- Email verified (either via link or disable email confirmation in Supabase)

### Steps

1. Open browser to `http://localhost:3000/auth/login`
2. Enter:
   - **Email**: "testuser1@example.com"
   - **Password**: "TestPass123456!"
3. Click "Sign In" button

### Expected Behavior

- "Sign In" button changes to "Signing in..." while loading
- After 1-2 seconds, page redirects to `/dashboard`
- Dashboard shows user's data (or empty if first time)
- Top navigation bar shows user's email
- No console errors

### What to Check

1. **Session Created**
   - Open DevTools > Application > Local Storage
   - Look for `sb-[PROJECT-ID]-auth-token`
   - Token should contain user info

2. **User Context**
   - Dashboard page loads without redirecting
   - Settings link in navigation is clickable
   - User menu shows logged-in state

### If Something Goes Wrong

| Problem | Solution |
|---------|----------|
| "Invalid login credentials" | Ensure email/password are correct and email is verified |
| Redirects to login page | Email might not be verified - complete Test 2 first |
| "NEXT_PUBLIC_SUPABASE_URL is not defined" | Check frontend `.env.local` |
| Token not in localStorage | Check browser allows localStorage; try clearing cache |
| Can't sign in but email is correct | Verify user exists in Supabase: Auth > Users |

---

## Test 4: Protected Routes

This test verifies that unauthenticated users cannot access protected pages.

### Prerequisites
- Complete Test 1 and Test 3 (Sign Up and Login)

### Scenario A: Try Accessing Dashboard Without Login

1. Open a **new private/incognito browser window**
2. Go to `http://localhost:3000/dashboard`

### Expected Behavior

- Page should immediately redirect to `/auth/login`
- User should NOT see any dashboard data
- User should be on login page with form visible

### Scenario B: Try Accessing Settings Without Login

1. Open a **new private/incognito browser window**
2. Go to `http://localhost:3000/settings`

### Expected Behavior

- Page should immediately redirect to `/auth/login`
- No settings form visible
- Login page displays

### Scenario C: Try Accessing Calculator Without Login (Public Route)

1. Open a **new private/incognito browser window**
2. Go to `http://localhost:3000/calculator`

### Expected Behavior

- Page loads successfully (calculator is public)
- User can use calculator without logging in
- No redirect to login

### What to Check

1. In DevTools Console, verify no authentication errors
2. Session storage should be empty (since not logged in)
3. Navigation bar should show "Sign In" and "Sign Up" links

### If Something Goes Wrong

| Problem | Solution |
|---------|----------|
| Dashboard page loads without redirecting | AuthProvider might not be checking auth state; check AuthContext.tsx |
| Redirect takes too long | Loading state might be stuck; check isLoading in AuthContext |
| Settings page allows access without login | Check ProtectedRoute middleware in settings/page.tsx |
| Console shows 401 errors | Token might be invalid; clear cache and login again |

---

## Test 5: Login with Wrong Credentials

This test verifies proper error handling for incorrect login attempts.

### Prerequisites
- Complete Test 1 (Sign Up Flow)

### Steps

1. Go to `http://localhost:3000/auth/login`
2. Enter:
   - **Email**: "testuser1@example.com"
   - **Password**: "WrongPassword123!"
3. Click "Sign In"

### Expected Behavior

- Error message displays: "Invalid login credentials"
- Page does NOT redirect
- User stays on login form
- Form fields remain filled so user can correct
- No console errors

### Steps for Nonexistent Email

1. Go to `http://localhost:3000/auth/login`
2. Enter:
   - **Email**: "nonexistent@example.com"
   - **Password**: "SomePassword123!"
3. Click "Sign In"

### Expected Behavior

- Error message displays: "Invalid login credentials" (same message for security)
- User stays on login form
- No console errors

### If Something Goes Wrong

| Problem | Solution |
|---------|----------|
| Wrong error message shown | Check LoginForm.tsx error handling |
| Page redirects anyway | Ensure error checking is in place before redirect |
| No error displayed | Check that signIn function returns error properly |

---

## Test 6: Settings Page - Update Profile

This test verifies that logged-in users can update their profile information.

### Prerequisites
- Complete Test 1 and Test 3 (Sign Up and Login)
- User should be logged in and on `/settings` page

### Steps

1. Go to `http://localhost:3000/settings` (or click Settings in navigation)
2. You should see a "Profile" section with:
   - Current full name
   - Edit button
3. Click edit (or see editable field)
4. Change name to "Updated Test User"
5. Click "Save Profile" button

### Expected Behavior

- Button changes to "Saving..." while loading
- After 1-2 seconds, success message appears
- Name updates on page
- In Supabase: users_public table shows updated full_name
- No console errors

### What to Check in Supabase

1. Go to SQL Editor and run:
```sql
SELECT id, email, full_name FROM users_public
WHERE email = 'testuser1@example.com';
```
2. Verify full_name is "Updated Test User"

### If Something Goes Wrong

| Problem | Solution |
|---------|----------|
| Settings page redirects to login | Ensure you're logged in; check session in localStorage |
| Can't click edit button | Check if component is properly rendered |
| "Save Profile" doesn't work | Check that updateProfile function in auth.ts is correct |
| Error: "Not authenticated" | Token might be expired; try logging in again |
| Supabase data doesn't update | Check users_public table has correct permissions (RLS policies) |

---

## Test 7: Settings Page - Change Password

This test verifies that logged-in users can securely change their password.

### Prerequisites
- Complete Test 1 and Test 3 (Sign Up and Login)
- User should be logged in on `/settings` page

### Steps

1. Go to `http://localhost:3000/settings`
2. Scroll to "Change Password" section
3. Enter:
   - **Current Password**: "TestPass123456!"
   - **New Password**: "NewPass123456!!"
   - **Confirm New Password**: "NewPass123456!!"
4. Click "Change Password" button

### Expected Behavior

- Button changes to "Updating..." while loading
- After 1-2 seconds, success message: "Password changed successfully"
- Form clears
- User remains logged in
- No console errors

### Verify Password Change Works

1. Click "Sign Out" in navigation
2. Go to login page
3. Try logging in with:
   - **Email**: "testuser1@example.com"
   - **Old Password**: "TestPass123456!" (should fail)
4. Try again with:
   - **Email**: "testuser1@example.com"
   - **New Password**: "NewPass123456!!" (should succeed)

### Password Change Error Scenarios

**Scenario A: Wrong current password**
1. Enter:
   - Current: "WrongPassword123!"
   - New: "AnotherPass123456!"
2. Expected: Error message "Incorrect password" or similar

**Scenario B: Mismatched new passwords**
1. Enter:
   - Current: "TestPass123456!"
   - New: "NewPass123456!!"
   - Confirm: "DifferentPass123!!"
2. Expected: Error "Passwords do not match" before submission

### If Something Goes Wrong

| Problem | Solution |
|---------|----------|
| "Current password is incorrect" error when correct | Might be token issue; try logging out and in |
| Password doesn't change in Supabase | Check that updatePassword function calls correct endpoint |
| Can't log in with new password | Password might not have saved; try changing again |
| Form doesn't show validation errors | Check ChangePasswordForm component error handling |

---

## Test 8: Logout Flow

This test verifies users can securely log out.

### Prerequisites
- User logged in (after Test 3)

### Steps

1. While logged in, look for logout button in:
   - Navigation bar (likely in top right)
   - Settings page
   - User menu/dropdown
2. Click "Sign Out" or "Logout" button

### Expected Behavior

- Button changes to "Signing out..." while loading
- After 1-2 seconds, page redirects to home page or login
- Login/Sign Up links appear in navigation
- User's email no longer visible in header
- No console errors

### What to Check

1. **Session Cleared**
   - Open DevTools > Application > Local Storage
   - `sb-[PROJECT-ID]-auth-token` should be gone
   - Cookies should be cleared

2. **Protected Routes Blocked**
   - Try going to `/dashboard` directly
   - Should redirect to login
   - Try going to `/settings`
   - Should redirect to login

3. **Auth State Reset**
   - AuthContext should show user: null
   - Navigation should show "Sign In" link

### If Something Goes Wrong

| Problem | Solution |
|---------|----------|
| Logout button doesn't appear | Check Navigation component includes logout |
| Logout doesn't complete | Check signOut function in auth.ts |
| User still logged in after logout | localStorage might not clear; try clearing browser cache |
| Session persists after logout | Check that session storage is properly cleared in AuthContext |
| Redirect to wrong page | Check where logout redirects users to |

---

## Test 9: Session Persistence

This test verifies that user sessions persist across page refreshes and browser restarts.

### Prerequisites
- User logged in (after Test 3)

### Scenario A: Page Refresh

1. Go to `http://localhost:3000/dashboard` (logged in)
2. Note the page loaded
3. Press F5 to refresh the page
4. After refresh, page should still show (not redirect to login)
5. User should still be logged in

### Scenario B: Navigate Away and Back

1. Go to `http://localhost:3000/dashboard` (logged in)
2. Click on calculator link (public page)
3. Calculator page loads
4. Click on dashboard in navigation
5. Dashboard page loads without login

### Scenario C: Close and Reopen Browser Tab (Same Session)

1. Go to `http://localhost:3000/dashboard` (logged in)
2. Close browser tab
3. Open new tab and go to `http://localhost:3000/dashboard`
4. Should still be logged in (if within same browser session)

### Expected Behavior

- User remains logged in across all scenarios
- Session token persists in localStorage
- AuthContext correctly restores user state on mount
- No auth-related redirects for logged-in user

### What to Check

1. DevTools > Application > Local Storage
   - `sb-[PROJECT-ID]-auth-token` should persist
   - Token should be valid

2. Network tab
   - Should not see repeated login requests
   - Auth requests should use cached token

### If Something Goes Wrong

| Problem | Solution |
|---------|----------|
| Logged out after page refresh | AuthContext not reading localStorage on mount |
| Session expires too quickly | Token might have short expiry; check Supabase settings |
| Can't access dashboard after closing tab | localStorage was cleared; check browser settings |
| Multiple auth requests | AuthContext might be re-initializing; check useEffect dependencies |

---

## Test 10: Backend Authentication

This test verifies backend endpoints properly authenticate requests.

### Prerequisites
- User logged in (have access token)
- Postman, cURL, or similar API testing tool
- Backend running at `http://localhost:8000`

### Steps

1. **Get Access Token**
   - Log in via frontend
   - Open DevTools > Application > Local Storage
   - Find `sb-[PROJECT-ID]-auth-token`
   - Copy the token value (it's a JWT)

2. **Test Authenticated Endpoint**
   - Open Postman or cURL
   - Make POST request to `http://localhost:8000/api/plans`
   - Headers:
     ```
     Authorization: Bearer <YOUR_TOKEN_HERE>
     Content-Type: application/json
     ```
   - Should return: `{"plans": []}`

3. **Test Without Token**
   - Same POST to `http://localhost:8000/api/plans`
   - NO Authorization header
   - Should return: `401 Unauthorized` with error message

4. **Test with Invalid Token**
   - Same POST to `http://localhost:8000/api/plans`
   - Headers:
     ```
     Authorization: Bearer invalid_token_here
     Content-Type: application/json
     ```
   - Should return: `401 Unauthorized`

### Expected Behavior

- Requests with valid token succeed (status 200)
- Requests without token return 401
- Requests with invalid token return 401
- Error messages are clear and helpful

### Example cURL Commands

```bash
# With valid token (replace TOKEN and URL)
curl -X GET http://localhost:8000/api/plans \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"

# Without token (should fail)
curl -X GET http://localhost:8000/api/plans \
  -H "Content-Type: application/json"

# With invalid token (should fail)
curl -X GET http://localhost:8000/api/plans \
  -H "Authorization: Bearer invalid" \
  -H "Content-Type: application/json"
```

### If Something Goes Wrong

| Problem | Solution |
|---------|----------|
| 401 with valid token | Token might be expired; get new token by logging in |
| Endpoint returns 401 always | Check SUPABASE_URL and SERVICE_ROLE_KEY in backend .env |
| No Authorization header needed | Check middleware is properly applied in main.py |
| Token format issues | Ensure token is in `Bearer <token>` format (with space) |

---

## Test Checklist

Copy and paste this checklist, then check off each test as you complete it:

```
SIGN UP & VERIFICATION
[ ] Test 1: Sign Up Flow - User creates new account successfully
[ ] Test 2: Email Verification - Email verification works or can be skipped
[ ] Test 5: Wrong Credentials - Error handling on bad password

LOGIN
[ ] Test 3: Login Flow - User signs in with correct credentials
[ ] Test 4: Protected Routes - Unauthenticated users redirected
[ ] Test 9: Session Persistence - User stays logged in across pages

SETTINGS
[ ] Test 6: Update Profile - User can change their name
[ ] Test 7: Change Password - User can change password

LOGOUT & API
[ ] Test 8: Logout Flow - User signs out successfully
[ ] Test 10: Backend Auth - API endpoints validate tokens

EDGE CASES
[ ] Try accessing protected route in incognito window
[ ] Try logging in with different email than signed up with
[ ] Try changing password with wrong current password
[ ] Clear browser cache and sign in again
[ ] Refresh page while logged in (should stay logged in)
[ ] Test on mobile browser (iPhone/Android)

SUPABASE VERIFICATION
[ ] Verify user created in Supabase auth
[ ] Verify user profile in users_public table
[ ] Verify user data updates after profile change
[ ] Verify password change in Supabase
[ ] Check RLS policies allow authenticated access
```

---

## Troubleshooting Quick Reference

### General
- **Clear browser cache**: Ctrl+Shift+Del (or Cmd+Shift+Del on Mac)
- **Check console errors**: F12 > Console tab
- **Check network requests**: F12 > Network tab
- **Check local storage**: F12 > Application > Local Storage

### Environment
- **NEXT_PUBLIC_* not found**: Make sure `.env.local` exists in `/frontend`
- **SUPABASE_* not found**: Make sure `.env` exists in `/backend`
- **CORS errors**: Check CORS middleware in `backend/app/main.py` includes localhost:3000

### Auth Issues
- **Redirects to login on every page**: Check AuthContext useEffect dependencies
- **Can't get token**: Ensure email is verified (skip in dev if needed)
- **Token invalid**: Token might be expired; try logging in again
- **Session not persisting**: Check localStorage isn't disabled in browser

### Database Issues
- **User created but no profile**: Check users_public table exists
- **Profile won't update**: Check RLS policies on users_public table
- **Can't read user data**: Check RLS policies allow authenticated SELECT

### Still Stuck?
1. Check browser console for specific error messages
2. Check backend logs (check terminal where you ran `uvicorn`)
3. Check Supabase project logs: Dashboard > Logs
4. Try the test steps in a different browser
5. Clear all cache and restart both services

---

## Next Steps After Testing

Once all tests pass:

1. **Deploy to Production**
   - Set environment variables in production deployment
   - Update Supabase allowed origins
   - Enable email verification (if using email auth)

2. **Add Social Login** (Optional)
   - Google/GitHub OAuth via Supabase
   - Follow SUPABASE-SETUP.md for provider setup

3. **Password Reset Flow**
   - Implement forgot password page at `/auth/forgot-password`
   - Uses `resetPassword` function in `lib/auth.ts`

4. **Admin Dashboard**
   - Monitor user logins
   - Manage user accounts
   - Check authentication logs

5. **Security Review**
   - Audit RLS policies
   - Review token expiry settings
   - Check CORS configuration
   - Enable rate limiting on auth endpoints
