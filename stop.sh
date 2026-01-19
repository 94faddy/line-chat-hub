#!/bin/bash
# Path: stop.sh

APPNAME="line-chat-hub"

echo "🛑 Stopping line-chat-hub..."

pm2 delete $APPNAME 2>/dev/null

echo "✅ PM2 processes stopped."
