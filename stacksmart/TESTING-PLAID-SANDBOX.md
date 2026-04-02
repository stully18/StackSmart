# Testing Plaid Integration - Avoiding Phone Verification

## The Issue
Some test banks in Plaid's sandbox ask for phone number verification. This is normal sandbox behavior, but we can avoid it by using specific test institutions.

## Solution: Use "First Platypus Bank"

When the Plaid Link modal opens, follow these steps:

### Step 1: Search for the Right Test Bank
In the search box, type: **"First Platypus Bank"**

This is Plaid's primary test bank that has the simplest authentication flow.

### Step 2: Use Test Credentials
- **Username:** `user_good`
- **Password:** `pass_good`

**DO NOT** use phone or email for login - just use the username/password fields.

### Step 3: Skip MFA (if shown)
If asked for MFA code, enter: `1234`

---

## Alternative Test Banks (No Phone Required)

If you want to test different scenarios:

1. **First Platypus Bank** - Standard test bank
   - Username: `user_good`
   - Password: `pass_good`

2. **Tattersall Federal Credit Union** - Another simple test bank
   - Username: `user_good`
   - Password: `pass_good`

3. **Tartan Bank** - OAuth flow (no credentials needed)
   - Just click through the OAuth screens

---

## What to Avoid

Some test banks will ask for phone verification:
- Chase (sometimes)
- Bank of America (sometimes)
- Wells Fargo (sometimes)

These are intentional sandbox behaviors to test different authentication flows. **Stick with "First Platypus Bank" for the simplest experience.**

---

## Expected Flow

```
1. Click "Connect Bank" button
2. Plaid modal opens
3. Search: "First Platypus Bank"
4. Enter: user_good / pass_good
5. Select accounts (2-3 test accounts shown)
6. Click "Continue"
7. Modal closes
8. Spare Cash field auto-fills with suggested amount
```

---

## If You Still Get Phone Verification

If First Platypus Bank still asks for phone:

1. **Enter any 10-digit number**: `5555555555`
2. **Enter verification code**: `1234`

The sandbox will accept any phone number and the code `1234`.

---

## Testing Different Balances

Want to see different balance calculations?

Use these test credentials with First Platypus Bank:

- `user_good` - Standard balances (~$10k-$15k total)
- `user_custom` - Custom balances (you can modify in sandbox)

---

## Restart the App (if needed)

If you made changes to the backend, restart:

```bash
cd ~/Development/FinanceFolder/net-worth-optimizer
# Kill existing processes
pkill -f "uvicorn"
pkill -f "next"

# Restart
./setup-and-run.sh
```

---

## Success Indicators

You'll know it worked when:
- Modal opens without errors
- Login succeeds with user_good/pass_good
- You see test accounts (Plaid Checking, Plaid Savings)
- Modal closes automatically
- **Spare Cash field updates to suggested amount**

---

## Next Steps

Once you verify it works:
1. Try different test users to see different balance calculations
2. Test the full optimization flow with the auto-filled amount
3. Check that the investment recommendations update correctly
