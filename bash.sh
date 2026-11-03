chmod +x install.msh run.ash
git add .
git commit -m "Configure ESLint, Prettier, and GitHub CI Actions"
git push origin main
# 1. Provide system execution permissions permissions flags
chmod +x install.msh run.ash

# 2. Compile every framework asset model automatically
./install.msh

# 3. Fire up the unified concurrent processing browser environment
./run.ash
