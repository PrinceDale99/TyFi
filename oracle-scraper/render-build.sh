#!/usr/bin/env bash
# exit on error
set -o errexit

# Install required Chrome dependencies for Puppeteer on Render's native Node environment
echo "Installing Puppeteer dependencies..."
apt-get update
apt-get install -y wget gnupg
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list'
apt-get update
apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
  --no-install-recommends
rm -rf /var/lib/apt/lists/*

# Install node modules and build
echo "Installing Node modules..."
npm install

echo "Building project..."
npm run build
