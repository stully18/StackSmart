# Environment Configuration Setup

This guide explains how to set up environment variables for the StackSmart application (frontend and backend).

## Overview

The application uses environment variables to configure API keys, database connections, and service credentials. There are two types of configuration files:

1. **`.env.example` files** - Templates showing required variables (COMMITTED to git, no secrets)
2. **`.env` and `.env.local` files** - User's actual credentials (NEVER committed, in .gitignore)

## File Locations

- **Backend template:** `/backend/.env.example`
- **Backend secrets:** `/backend/.env` (excluded from git)
- **Frontend template:** `/frontend/.env.local` (template with examples)
- **Frontend secrets:** `/frontend/.env.local` (user fills in actual values, excluded from git)

## Backend Environment Variables

### Required Variables

#### Supabase Configuration (Authentication & Database)

Get these values from [Supabase Dashboard](https://app.supabase.com):

| Variable | Purpose | Where to Get |
|----------|---------|--------------|
| `SUPABASE_URL` | Supabase project URL | Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side authentication key with full database access | Project Settings → API → Service Role Key |
| `DATABASE_URL` | PostgreSQL connection string | Project Settings → Database → Connection Pooling (or use Supabase-provided string) |

**Example:**
```env
SUPABASE_URL=https://fbgrtbkwdsjiwxyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DATABASE_URL=postgresql://postgres:your_password@fbgrtbkwdsjiwxyz.supabase.co:5432/postgres
```

**Security Warning:** The `SUPABASE_SERVICE_ROLE_KEY` has full database access. Never commit it to git or expose it in client-side code.

#### Plaid Configuration (Bank Connections)

Get these from [Plaid Dashboard](https://dashboard.plaid.com):

| Variable | Purpose | Default/Example |
|----------|---------|-----------------|
| `PLAID_CLIENT_ID` | Plaid API Client ID | Your Client ID from dashboard |
| `PLAID_SECRET` | Plaid API Secret | Sandbox secret for testing |
| `PLAID_ENV` | Environment (sandbox or production) | `sandbox` for development |

**Example:**
```env
PLAID_CLIENT_ID=your_client_id_abc123
PLAID_SECRET=your_sandbox_secret_xyz789
PLAID_ENV=sandbox
```

For production, update `PLAID_ENV=production` and use your production secret.

#### Alpha Vantage (Optional - Stock Data)

| Variable | Purpose | Default |
|----------|---------|---------|
| `ALPHA_VANTAGE_API_KEY` | Stock market data API | `demo` (limited) |

Get a free API key from [alphavantage.co](https://www.alphavantage.co/support/#api-key).

**Note:** If not set, the application falls back to Yahoo Finance (no API key required).

## Frontend Environment Variables

### Required Variables

All frontend variables use the `NEXT_PUBLIC_` prefix, which means they're embedded in the browser (don't put secrets here).

#### Supabase Configuration

Get these from [Supabase Dashboard](https://app.supabase.com):

| Variable | Purpose | Where to Get |
|----------|---------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (public) | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public authentication key (limited permissions) | Project Settings → API → Anon Key |

**Example:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://fbgrtbkwdsjiwxyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Security Note:** The anon key is designed to be public - it has limited permissions and is safe to expose in the browser.

#### Backend API URL

| Variable | Purpose | Development | Production |
|----------|---------|-------------|-----------|
| `NEXT_PUBLIC_API_URL` | Backend server address | `http://localhost:8000` | `https://api.yoursite.com` |

**Example:**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Setup Steps

### 1. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd net-worth-optimizer/backend
   ```

2. Copy the template:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and fill in your actual credentials:
   ```bash
   nano .env
   ```

4. Verify `.env` is in `.gitignore` (it should be):
   ```bash
   grep "^\.env$" .gitignore
   ```

### 2. Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd net-worth-optimizer/frontend
   ```

2. Edit `.env.local` with your credentials:
   ```bash
   nano .env.local
   ```

3. Update these values from Supabase:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

4. Verify `.env.local` is in `.gitignore` (should match `.env*.local`):
   ```bash
   grep "\.env" .gitignore
   ```

## Getting Supabase Credentials

1. Go to [app.supabase.com](https://app.supabase.com)
2. Sign in or create an account
3. Create a new project (or open existing one)
4. Go to **Project Settings** → **API**
5. Copy the following:
   - **Project URL** → Use as `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`
   - **Service Role Key** → Use as `SUPABASE_SERVICE_ROLE_KEY` (backend only, secret!)
   - **Anon Key** → Use as `NEXT_PUBLIC_SUPABASE_ANON_KEY` (frontend, public)
   - **Database password** → Use in `DATABASE_URL`

For detailed Supabase setup including database schema, see [SUPABASE-SETUP.md](./SUPABASE-SETUP.md).

## Important Security Notes

1. **Never commit `.env` files to git** - They contain sensitive credentials
2. **Never expose `SUPABASE_SERVICE_ROLE_KEY`** - It has full database access
3. **Never use production secrets in development** - Keep sandbox/test credentials for dev
4. **Use `.env.local` for frontend secrets** - Next.js automatically excludes `*.local` files
5. **Rotate API keys regularly** - Especially if you suspect exposure
6. **Use `.env.example` as documentation** - It shows required variables without exposing secrets

## Development vs Production

### Development
- Use `PLAID_ENV=sandbox` with sandbox credentials
- Use `ALPHA_VANTAGE_API_KEY=demo` or a free tier key
- Use `NEXT_PUBLIC_API_URL=http://localhost:8000`

### Production
- Update to production API keys and secrets
- Use `PLAID_ENV=production` with production credentials
- Set `NEXT_PUBLIC_API_URL` to your production API domain
- Ensure all secrets are stored securely (environment variables in hosting platform)

## Troubleshooting

### Environment Variables Not Loading

**Backend (Python/FastAPI):**
```python
from dotenv import load_dotenv
load_dotenv()  # Must be called before accessing os.environ
```

**Frontend (Next.js):**
- Restart the dev server after changing `.env.local`
- Variables must be accessed at build time for static generation
- Use `NEXT_PUBLIC_` prefix for variables needed in browser

### Missing Credentials Error

1. Verify all required variables are set in `.env` or `.env.local`
2. Check that credentials haven't expired
3. Regenerate API keys in respective dashboards if needed
4. Ensure file is in the correct location (backend/ or frontend/)

### Connection Refused

- Verify `NEXT_PUBLIC_API_URL` matches your backend server address
- Ensure backend is running on the specified port
- Check firewall/network settings

## Related Documentation

- [Supabase Setup Guide](./SUPABASE-SETUP.md) - Detailed Supabase configuration
- [Supabase Quick Reference](./SUPABASE-QUICK-REFERENCE.md) - Quick lookup guide
- [Database Schema](./DATABASE-SCHEMA.md) - Database structure reference
