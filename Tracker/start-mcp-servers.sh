#!/bin/bash

# MCP Server Startup Script
# Ensures all required MCP servers are running for Claude Code

echo "🚀 Starting MCP servers for Claude Code..."

# Kill any existing MCP processes to prevent conflicts
pkill -f "firecrawl-mcp" 2>/dev/null
pkill -f "@clerk/agent-toolkit" 2>/dev/null  
pkill -f "@playwright/mcp" 2>/dev/null
pkill -f "@upstash/context7-mcp" 2>/dev/null

sleep 2

# Start MCP servers in background
echo "📡 Starting Firecrawl MCP server..."
FIRECRAWL_API_KEY=fc-5384a3da92064921a48599dda5b5edcb npx -y firecrawl-mcp &

echo "🔐 Starting Clerk MCP server..."
npx -y @clerk/agent-toolkit -p=local-mcp &

echo "🎭 Starting Playwright MCP server..."
npx @playwright/mcp@latest &

echo "🧠 Starting Context7 MCP server..."
CONTEXT7_PROJECT_PATH="/Users/johnliddy/sales-tax-tracker" NODE_ENV="development" npx @upstash/context7-mcp --transport stdio &

sleep 5

echo "✅ All MCP servers started!"
echo "🔍 Testing connections..."

# Test MCP server health
claude mcp list

echo "🎉 MCP servers ready for Claude Code!"