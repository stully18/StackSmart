# Complete Plaid Integration Guide

Follow these steps in order to integrate Plaid into your Net Worth Optimizer app.

---

## 📋 **Part 1: Get Plaid API Credentials** (5 minutes)

### Step 1: Create Plaid Account
1. Open your browser and go to: https://dashboard.plaid.com/signup
2. Fill out the registration form:
   - **Email**: Your email address
   - **Company name**: "Net Worth Optimizer" (or your startup name)
   - **Use case**: Select "Personal Finance" or "Wealth Management"
3. Click **"Sign Up"**
4. Check your email and verify your account

### Step 2: Get Your API Keys
1. Log in to Plaid Dashboard: https://dashboard.plaid.com
2. Click on **"Team Settings"** in the left sidebar
3. Click on **"Keys"**
4. You'll see two keys:
   ```
   client_id: <COPY THIS>
   secret (sandbox): <COPY THIS>
   ```
5. **Save these somewhere temporarily** - you'll need them in the next step

### Step 3: Enable Required Products
1. In the Plaid Dashboard, go to **"Team Settings"** → **"Products"**
2. Make sure these are enabled (check the boxes):
   - ✅ **Auth**
   - ✅ **Transactions**
3. Click **"Save Changes"**

---

## 🔧 **Part 2: Configure Your Local Environment** (5 minutes)

### Step 4: Create Environment File

Open a terminal and run:

```bash
cd ~/Development/FinanceFolder/net-worth-optimizer/backend
cp .env.example .env
```

### Step 5: Add Your Plaid Credentials

Edit the `.env` file:

```bash
nano .env
```

Replace the placeholder values with your actual Plaid credentials:

```bash
PLAID_CLIENT_ID=your_actual_client_id_here
PLAID_SECRET=your_actual_sandbox_secret_here
PLAID_ENV=sandbox
```

**Important:**
- Replace `your_actual_client_id_here` with the `client_id` you copied
- Replace `your_actual_sandbox_secret_here` with the `secret (sandbox)` you copied
- Keep `PLAID_ENV=sandbox` for now (we'll change to production later)

Save and exit:
- Press `Ctrl + X`
- Press `Y` to confirm
- Press `Enter`

### Step 6: Verify the File

Check that your `.env` file looks correct:

```bash
cat .env
```

You should see your actual keys (not the placeholders).

---

## 📦 **Part 3: Install Dependencies** (5 minutes)

### Step 7: Install Backend Dependencies

```bash
cd ~/Development/FinanceFolder/net-worth-optimizer/backend
source venv/bin/activate
pip install -r requirements.txt
```

You should see `plaid-python` being installed.

### Step 8: Install Frontend Dependencies

```bash
cd ~/Development/FinanceFolder/net-worth-optimizer/frontend
npm install
```

You should see `react-plaid-link` being installed.

---

## 🧪 **Part 4: Test the Integration** (5 minutes)

### Step 9: Start the Application

```bash
cd ~/Development/FinanceFolder/net-worth-optimizer
./setup-and-run.sh
```

Wait for both servers to start:
- Backend: http://localhost:8000
- Frontend: http://localhost:3000

### Step 10: Verify Plaid Endpoints

Open a new terminal and test the backend:

```bash
curl http://localhost:8000/api/plaid/create-link-token \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test-user-123"}'
```

**Expected Response:**
You should see a JSON response with a `link_token` field:
```json
{
  "link_token": "link-sandbox-...",
  "expiration": "2024-..."
}
```

**If you see an error:**
- Check that your `.env` file has the correct credentials
- Make sure there are no extra spaces or quotes
- Verify you enabled Auth + Transactions in Plaid Dashboard

---

## 🎯 **Part 5: Test with Plaid's Test Bank** (5 minutes)

Plaid provides test credentials for sandbox mode:

### Test Credentials:
- **Bank**: Select any bank from the list (they're all test banks)
- **Username**: `user_good`
- **Password**: `pass_good`
- **MFA Code** (if prompted): `1234`

### What You'll See:
- Plaid will show 2-3 fake bank accounts
- Balances will be realistic (e.g., $100, $1,000, etc.)
- Transactions will be randomly generated test data

---

## ✅ **Verification Checklist**

Before moving forward, make sure:

- [ ] You can access Plaid Dashboard (https://dashboard.plaid.com)
- [ ] Auth + Transactions products are enabled
- [ ] `.env` file contains your actual credentials (not placeholders)
- [ ] `pip install -r requirements.txt` ran successfully
- [ ] `npm install` ran successfully
- [ ] Backend starts without errors (check terminal for errors)
- [ ] Test API call returns a `link_token`

---

## 🚨 **Common Issues & Solutions**

### Issue 1: "Invalid client_id"
**Solution:**
- Double-check your `PLAID_CLIENT_ID` in `.env`
- Make sure it matches exactly what's in the Plaid Dashboard
- No spaces, no quotes around the value

### Issue 2: "Invalid secret"
**Solution:**
- Make sure you're using the **sandbox secret**, not production
- Copy/paste directly from Plaid Dashboard to avoid typos
- In `.env`, use: `PLAID_SECRET=<your_actual_secret>` (no quotes)

### Issue 3: "Module plaid not found"
**Solution:**
```bash
cd backend
source venv/bin/activate
pip install plaid-python
```

### Issue 4: Backend won't start
**Solution:**
- Check for syntax errors in `/backend/app/main.py`
- Look at the terminal output for specific error messages
- Try: `cd backend && python -c "from app.main import app"`

### Issue 5: ".env file not found"
**Solution:**
```bash
cd ~/Development/FinanceFolder/net-worth-optimizer/backend
ls -la .env  # Verify it exists
cat .env     # Verify it has your keys
```

---

## 🎓 **Next Steps**

Once Plaid is working, you can:

1. **Add "Connect Bank" button** to the frontend (coming next)
2. **Fetch real account balances** → auto-fill spare cash
3. **Analyze transactions** → predict cash flow
4. **Build ML model** → semester spending predictor

---

## 📞 **Need Help?**

If you're stuck:
1. Check the terminal output for error messages
2. Verify all steps above were completed
3. Double-check your Plaid Dashboard settings
4. Review the `.env` file for typos

Ready for the next step? Let me know and I'll help you add the "Connect Bank" button to the frontend!
