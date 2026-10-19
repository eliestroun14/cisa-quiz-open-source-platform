#!/bin/sh
# Serves the quiz folder locally (browsers block reading JSON files over file://)
cd "$(dirname "$0")" || exit 1
echo "Open http://localhost:8000/ (Ctrl+C to stop)"
python3 -m http.server 8000
