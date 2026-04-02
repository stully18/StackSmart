#!/bin/bash

# Master setup and run script for StackSmart
# Installs dependencies if needed, then launches backend and frontend
# Use --setup-only to install dependencies without launching servers

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

ROOT="$(cd "$(dirname "$0")" && pwd)"
SETUP_ONLY=false

# Check for --setup-only flag
if [ "$1" = "--setup-only" ]; then
    SETUP_ONLY=true
fi

echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}   StackSmart - Setup & Launch${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo ""

# --- Preflight checks ---
if ! command -v python3 &>/dev/null; then
    echo -e "${RED}Error: python3 is not installed${NC}"
    exit 1
fi

if ! command -v npm &>/dev/null; then
    echo -e "${RED}Error: npm is not installed${NC}"
    exit 1
fi

# --- Backend setup ---
echo -e "${GREEN}Setting up backend...${NC}"
cd "$ROOT/backend" || { echo -e "${RED}Failed to enter backend directory${NC}"; exit 1; }

# Use explicit paths to venv python/pip
VENV_PIP="$ROOT/backend/venv/bin/pip"
VENV_PYTHON="$ROOT/backend/venv/bin/python"

# Check if venv exists and is valid
if [ ! -f "$VENV_PIP" ] || [ ! -f "$VENV_PYTHON" ]; then
    if [ -d "venv" ]; then
        echo "  Removing corrupted virtual environment..."
        rm -rf venv
    fi
    echo "  Creating virtual environment..."
    python3 -m venv venv || { echo -e "${RED}Failed to create venv. Try: apt install python3-full${NC}"; exit 1; }
fi

# Upgrade pip and setuptools (continue even if this fails)
echo "  Upgrading pip and setuptools..."
"$VENV_PIP" install --upgrade pip setuptools wheel --quiet 2>/dev/null || echo "  (pip upgrade skipped, will continue)"

echo "  Installing Python dependencies..."
if [ ! -f "requirements.txt" ]; then
    echo -e "${RED}Error: requirements.txt not found in backend directory${NC}"
    exit 1
fi
"$VENV_PIP" install -r requirements.txt --quiet || { echo -e "${RED}pip install failed${NC}"; exit 1; }

# --- Frontend setup ---
echo -e "${GREEN}Setting up frontend...${NC}"
cd "$ROOT/frontend" || { echo -e "${RED}Failed to enter frontend directory${NC}"; exit 1; }

if [ ! -d "node_modules" ] || [ ! -f "node_modules/.bin/next" ]; then
    echo "  Installing Node dependencies..."
    npm install || { echo -e "${RED}npm install failed${NC}"; exit 1; }
else
    echo "  Node dependencies already installed"
fi

# If --setup-only flag was passed, exit after setup
if [ "$SETUP_ONLY" = true ]; then
    echo ""
    echo -e "${GREEN}✓ Setup complete! All dependencies installed.${NC}"
    echo ""
    exit 0
fi

# --- Cleanup handler ---
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down...${NC}"
    kill "$BACKEND_PID" 2>/dev/null
    kill "$FRONTEND_PID" 2>/dev/null
    wait 2>/dev/null
    echo -e "${BLUE}Done${NC}"
}
trap cleanup EXIT INT TERM

# --- Launch backend ---
echo ""
echo -e "${GREEN}Starting backend on http://localhost:8000${NC}"
cd "$ROOT/backend" || { echo -e "${RED}Failed to enter backend directory${NC}"; exit 1; }
"$VENV_PIP" install uvicorn --quiet || true  # Ensure uvicorn is installed
"$VENV_PYTHON" -m uvicorn app.main:app --reload &
BACKEND_PID=$!

# Give backend a moment to start
sleep 2

# --- Launch frontend ---
echo -e "${GREEN}Starting frontend on http://localhost:3000${NC}"
cd "$ROOT/frontend" || { echo -e "${RED}Failed to enter frontend directory${NC}"; exit 1; }
npm run dev &
FRONTEND_PID=$!

echo ""
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "  Frontend: ${GREEN}http://localhost:3000${NC}"
echo -e "  Backend:  ${GREEN}http://localhost:8000${NC}"
echo -e "  API docs: ${GREEN}http://localhost:8000/docs${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

wait
