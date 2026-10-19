@echo off
rem Serves the quiz folder locally (browsers block reading JSON files over file://)
cd /d "%~dp0"
start "" http://localhost:8000/
python -m http.server 8000
