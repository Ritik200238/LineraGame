#!/bin/bash

echo "🚀 Preparing Tower Defense for GitHub..."

# Check if this is a git repo
if [ ! -d ".git" ]; then
    echo "Initializing git repository..."
    git init
fi

# Create .gitignore if it doesn't exist
cat > .gitignore << 'GITIGNORE'
node_modules/
.DS_Store
*.log
.env
.cache/
tmp*
.playwright-browsers/
playwright-report/
test-results/
*.backup
GITIGNORE

echo "✅ .gitignore created"

# Stage all files
echo "📦 Staging files..."
git add .

echo "
✅ Files staged! Ready to commit.

Next steps:
1. git commit -m 'Add Tower Defense game for Linera Buildathon'
2. git remote add origin <your-github-url>
3. git push -u origin main

Or quick command:
git commit -m 'Tower Defense - Linera Buildathon submission' && git push
"
