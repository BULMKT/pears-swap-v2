#!/bin/bash

# PEARS Swap Quick Start Script

echo "🍐 Starting PEARS Swap Server..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install express cors dotenv
fi

# Start the server
echo "🚀 Launching server on http://localhost:3001"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

node server.js