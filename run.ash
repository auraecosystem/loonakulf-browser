#!/bin/bash
# run.ash - Unified developer workspace testing runtime script
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
echo "⚡ [Loonakulf Browser] Synchronizing Framework Application Execution Processes..."

cd shared-react-ui
npm start &
REACT_PID=$!
cd ..

echo "⏳ Waiting for shared dashboard compilation server socket..."
while ! nc -z localhost 3000 &>/dev/null; do 
    sleep 0.5
done
echo "🌐 Local web panel active on port :3000"

if [ -f "electron-shell/main.js" ]; then
    echo "💻 Launching Electron Chromium window environments..."
    cd electron-shell && npm start
else
    echo "🐍 Falling back to compile local PyQt container platforms..."
    cd pyqt-shell && python main.py
fi

kill $REACT_PID 2>/dev/null
echo "🏁 [Loonakulf Browser] Local development session terminated cleanly."
