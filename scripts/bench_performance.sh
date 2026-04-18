#!/bin/bash

# Simple Code GUI Performance Benchmark Script
# Compares Tauri/Rust vs (assumed) Legacy Electron baseline

echo "--- Performance Audit: Tauri/Rust vs Baseline ---"

# 1. Measure Startup Time (Cold Boot to WEBVIEW_READY)
echo -n "Measuring Cold Startup Time... "
START_TIME=$(date +%s%3N)
# Start the app and kill it once it reports ready
# We use stdbuf to avoid buffering
timeout 15s stdbuf -oL cargo run --manifest-path src-tauri/Cargo.toml 2>&1 | grep -m 1 "WEBVIEW_READY" > /dev/null
END_TIME=$(date +%s%3N)
STARTUP_MS=$((END_TIME - START_TIME))
echo "${STARTUP_MS}ms"

# 2. Measure Memory Footprint
echo -n "Measuring Memory Footprint (RSS)... "
# Start the app in background
cargo run --manifest-path src-tauri/Cargo.toml > /dev/null 2>&1 &
APP_PID=$!
sleep 5 # Give it time to settle
MEM_KB=$(ps -o rss= -p $APP_PID)
MEM_MB=$(echo "$MEM_KB" | awk '{printf "%.2f", $1 / 1024}')
echo "${MEM_MB}MB"
kill $APP_PID

# 3. Summary
echo ""
echo "--- Results Summary ---"
echo "Startup: ${STARTUP_MS}ms"
echo "Memory:  ${MEM_MB}MB"
