# Quick Start

## Prerequisites

- Python 3 with venv support (`sudo apt install python3.12-venv` if missing)
- Node.js / npm

## Running the Application

```bash
cd net-worth-optimizer
./start.sh
```

That's it. The script will install all dependencies (first run only), then launch both servers:

- Frontend: http://localhost:3000
- Backend:  http://localhost:8000
- API docs: http://localhost:8000/docs

Press **Ctrl+C** to stop both servers.

## Troubleshooting

**Port already in use**
```bash
sudo lsof -ti:8000 | xargs kill -9
sudo lsof -ti:3000 | xargs kill -9
```

**"Cannot find module 'next'"**
```bash
cd frontend && rm -rf node_modules package-lock.json && npm install
```

**venv creation fails**
```bash
sudo apt install python3.12-venv
```
