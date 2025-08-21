#!/bin/bash

# Sales Tax Tracker - Stop All Services Script

echo "🛑 Stopping Sales Tax Tracker services..."

# Kill application servers
if [ -f ".backend.pid" ]; then
    BACKEND_PID=$(cat .backend.pid)
    if kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo "🔴 Stopping backend server (PID: $BACKEND_PID)"
        kill "$BACKEND_PID"
        rm .backend.pid
    fi
fi

if [ -f ".frontend.pid" ]; then
    FRONTEND_PID=$(cat .frontend.pid)
    if kill -0 "$FRONTEND_PID" 2>/dev/null; then
        echo "🔴 Stopping frontend server (PID: $FRONTEND_PID)"
        kill "$FRONTEND_PID"
        rm .frontend.pid
    fi
fi

if [ -f ".context7.pid" ]; then
    CONTEXT7_PID=$(cat .context7.pid)
    if kill -0 "$CONTEXT7_PID" 2>/dev/null; then
        echo "🔴 Stopping Context7 MCP server (PID: $CONTEXT7_PID)"
        kill "$CONTEXT7_PID"
        rm .context7.pid
    fi
fi

# Kill any remaining processes
echo "🧹 Cleaning up remaining processes..."
pkill -f "firecrawl-mcp" 2>/dev/null || true
pkill -f "@clerk/agent-toolkit" 2>/dev/null || true
pkill -f "@playwright/mcp" 2>/dev/null || true
pkill -f "@upstash/context7-mcp" 2>/dev/null || true
pkill -f "ts-node.*server" 2>/dev/null || true
pkill -f "vite.*dev" 2>/dev/null || true

# Stop Redis if it was started by us
if command -v redis-cli &> /dev/null; then
    redis-cli shutdown 2>/dev/null || true
fi

echo "✅ All services stopped!"
echo "💡 To restart: ./full-startup.sh"