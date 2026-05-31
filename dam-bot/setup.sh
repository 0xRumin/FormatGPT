#!/bin/bash
# Quick setup script for DAM Checker Bot
# Run on your VPS: bash setup.sh

set -e

echo "📦 Installing Python dependencies..."
pip3 install -r requirements.txt

echo ""
echo "📝 Setting up .env..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "   Created .env from .env.example"
  echo "   ⚠️  Edit .env and set your BOT_TOKEN!"
  echo ""
  echo "   nano .env"
  echo ""
else
  echo "   .env already exists, skipping."
fi

echo ""
echo "🚀 To run the bot:"
echo "   python3 bot.py"
echo ""
echo "🔁 To run as a background service:"
echo "   nohup python3 bot.py > bot.log 2>&1 &"
echo ""
echo "📋 Or create a systemd service:"
echo "   sudo nano /etc/systemd/system/dam-bot.service"
echo ""
cat << 'SERVICE'
[Unit]
Description=DAM Checker Telegram Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/dam-bot
ExecStart=/usr/bin/python3 /root/dam-bot/bot.py
Restart=always
RestartSec=5
EnvironmentFile=/root/dam-bot/.env

[Install]
WantedBy=multi-user.target
SERVICE

echo ""
echo "   Then: sudo systemctl enable dam-bot && sudo systemctl start dam-bot"
