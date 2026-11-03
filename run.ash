# 1. Initialize and launch your React dashboard
cd shared-react-ui
npm install
npm start &

# 2. To test your Electron desktop app shell (In a second terminal window)
cd ../electron-shell
npm init -y
npm install electron --save-dev
npx electron main.js &

# 3. To test your Python setup environment
cd ../pyqt-shell
pip install PyQt5 PyQtWebEngine
python main.py
#!/bin/bash
# run.ash - Unified developer workspace testing runtime script

echo "⚡ [Loonakulf Browser] Synchronizing Framework Application Execution Processes..."

# 1. Start your shared React interface background engine thread
cd shared-react-ui
npm start &
REACT_PID=$!
cd ..

# 2. Introduce a deliberate loop hold to let the local network port stabilize
echo "⏳ Waiting for shared dashboard compilation server socket..."
while ! nc -z localhost 3000 &>/dev/null; do 
    sleep 0.5
done
echo "🌐 Local web panel active on port :3000"

# 3. Determine if launching primary Electron containers or fallback Python engines
if [ -f "electron-shell/main.js" ]; then
    echo "💻 Launching Electron Chromium window environments..."
    cd electron-shell && npm start
else
    echo "🐍 Falling back to compile local PyQt container platforms..."
    cd pyqt-shell && python main.py
fi

# Clean execution kill pipeline wrapper tracking states when closing windows
kill $REACT_PID 2>/dev/null
echo "🏁 [Loonakulf Browser] Local development session terminated cleanly."
