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
