#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting StackSmart Application${NC}"
echo ""

# Check if backend directory exists
if [ ! -d "backend" ]; then
    echo "❌ Error: backend directory not found"
    echo "Please run this script from the net-worth-optimizer directory"
    exit 1
fi

# Check if frontend directory exists
if [ ! -d "frontend" ]; then
    echo "❌ Error: frontend directory not found"
    echo "Please run this script from the net-worth-optimizer directory"
    exit 1
fi

# Function to start backend
start_backend() {
    echo -e "${GREEN}Starting Backend (port 8000)...${NC}"
    (
        cd backend

        # Check if virtual environment exists
        if [ ! -d "venv" ]; then
            echo "Creating virtual environment..."
            python3 -m venv venv
        fi

        # Install dependencies
        echo "Installing dependencies..."
        ./venv/bin/pip install -q -r requirements.txt 2>/dev/null || ./venv/bin/pip install -r requirements.txt

        # Start backend with uvicorn
        echo "Backend starting on http://localhost:8000"
        ./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
    )
}

# Function to start frontend
start_frontend() {
    echo -e "${GREEN}Starting Frontend (port 3000)...${NC}"
    (
        cd frontend

        if [ ! -d "node_modules" ]; then
            echo "Installing dependencies..."
            npm install --silent
        fi

        echo "Frontend starting on http://localhost:3000"
        npm run dev
    )
}

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down services...${NC}"
    pkill -P $$ -f "uvicorn"
    pkill -P $$ -f "next dev"
    wait 2>/dev/null
    echo -e "${BLUE}Services stopped${NC}"
}

# Set up trap to cleanup on exit
trap cleanup EXIT INT TERM

# Start both services in background
start_backend &
BACKEND_PID=$!

start_frontend &
FRONTEND_PID=$!

echo ""
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Both services started!${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo ""
echo -e "📱 Frontend: ${GREEN}http://localhost:3000${NC}"
echo -e "🔧 Backend:  ${GREEN}http://localhost:8000${NC}"
echo ""
echo "Press ${YELLOW}Ctrl+C${NC} to stop both services"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
