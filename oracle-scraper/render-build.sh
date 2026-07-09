#!/usr/bin/env bash
# exit on error
set -o errexit

# Render's native Node environments since 2023 automatically include all the OS-level libraries 
# required for Puppeteer to run! We don't need apt-get anymore.

echo "Installing Node modules (Puppeteer will automatically download its bundled Chromium)..."
npm install

echo "Building project..."
npm run build
