#!/bin/bash

# Quick script to commit and push to GitHub
# Run this after you have your GitHub repository URL

echo "🚀 Committing to GitHub..."
echo ""
echo "⚠️  Make sure you have:"
echo "   1. Created a GitHub repository"
echo "   2. Have the repository URL (e.g., https://github.com/username/repo.git)"
echo ""

# Get repository URL from user
read -p "Enter your GitHub repository URL: " REPO_URL

if [ -z "$REPO_URL" ]; then
  echo "❌ No URL provided. Exiting."
  exit 1
fi

# Initialize Git (if not already done)
if [ ! -d ".git" ]; then
  echo "📦 Initializing Git repository..."
  git init
fi

# Add remote (remove existing if present)
echo "🔗 Connecting to GitHub repository..."
git remote remove origin 2>/dev/null
git remote add origin "$REPO_URL"

# Stage all files
echo "📝 Staging all files..."
git add .

# Commit
echo "💾 Committing files..."
git commit -m "Add enhanced recommendation system with statistical analysis

- Implemented multi-factor scoring algorithm (6 factors)
- Added statistical analysis from session data
- Dynamic customer profile generation
- Explanation generation system
- Mix & Match outfit generator
- Frontend integration with recommendation display"

# Create main branch if needed
git branch -M main 2>/dev/null

# Push to GitHub
echo "📤 Pushing to GitHub..."
echo ""
echo "⚠️  You may need to authenticate:"
echo "   - Use your GitHub username"
echo "   - Use a Personal Access Token (not password)"
echo "   - Generate token at: https://github.com/settings/tokens"
echo ""

git push -u origin main || git push -u origin master

echo ""
echo "✅ Done! Check your GitHub repository to see your files."

