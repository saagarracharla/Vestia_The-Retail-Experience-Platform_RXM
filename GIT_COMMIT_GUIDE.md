# 📤 How to Commit to GitHub - Step by Step

## 🔍 First: Check Your Setup

### **Step 1: Check if you have a GitHub repository**

You need to know:
- ✅ **Do you already have a GitHub repository** for this project?
- ✅ **What's the repository URL?** (e.g., `https://github.com/yourusername/vestia-poc`)

### **Step 2: Check if Git is initialized**

Run this command:
```bash
cd /Users/devp173/Downloads/Vestia_The-Retail-Experience-Platform_RXM-FigmaScreens-3
git status
```

**If you see**: "Not a git repository" → You need to initialize Git first

**If you see**: File list → Git is already initialized ✅

---

## 🚀 Two Scenarios

### **Scenario A: You DON'T have a GitHub repository yet**

You need to:
1. ✅ **Create a new repository on GitHub** (go to github.com and create a new repo)
2. ✅ **Initialize Git** in this folder (if not already done)
3. ✅ **Connect this folder to your GitHub repository**
4. ✅ **Commit and push your files**

---

### **Scenario B: You ALREADY have a GitHub repository**

You need to:
1. ✅ **Connect this folder to your existing GitHub repository** (if not already connected)
2. ✅ **Commit and push your files**

---

## 📋 Complete Instructions

### **Step 1: Create GitHub Repository (if you don't have one)**

1. Go to **GitHub.com** and sign in
2. Click **"+"** (top right) → **"New repository"**
3. Fill in:
   - **Repository name**: `Vestia-Retail-Experience-Platform` (or whatever you want)
   - **Description**: "Retail Experience Platform with Enhanced Recommendation System"
   - **Visibility**: Public or Private (your choice)
   - **DO NOT** check "Initialize with README" (we already have files)
4. Click **"Create repository"**
5. **Copy the repository URL** that appears (e.g., `https://github.com/yourusername/Vestia-Retail-Experience-Platform.git`)

---

### **Step 2: Initialize Git (if not already done)**

Open terminal in your project folder and run:

```bash
cd /Users/devp173/Downloads/Vestia_The-Retail-Experience-Platform_RXM-FigmaScreens-3

# Initialize git (if not already done)
git init

# Check if .gitignore exists (it should)
cat .gitignore
```

---

### **Step 3: Connect to GitHub**

Run these commands (replace `YOUR_GITHUB_URL` with your actual repository URL):

```bash
# Add your GitHub repository as "origin"
git remote add origin YOUR_GITHUB_URL

# Example:
# git remote add origin https://github.com/yourusername/Vestia-Retail-Experience-Platform.git
```

**To check if connected**:
```bash
git remote -v
```

You should see your repository URL listed.

---

### **Step 4: Stage All Files**

```bash
# Add all files to staging
git add .

# Check what will be committed
git status
```

---

### **Step 5: Commit Your Files**

```bash
# Commit with a descriptive message
git commit -m "Add enhanced recommendation system with statistical analysis

- Implemented multi-factor scoring algorithm (6 factors)
- Added statistical analysis from session data
- Dynamic customer profile generation
- Explanation generation system
- Mix & Match outfit generator
- Frontend integration with recommendation display"
```

---

### **Step 6: Push to GitHub**

```bash
# Push to main branch (or master, depending on your repo)
git push -u origin main

# If main branch doesn't exist, try:
# git push -u origin master
```

**If you get an authentication error**, you'll need to:
- Use a **Personal Access Token** (instead of password)
- Or set up **SSH keys**

---

## 🔐 Authentication Options

### **Option 1: Personal Access Token (Easiest)**

1. Go to GitHub.com → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Click **"Generate new token (classic)"**
3. Name it: "Vestia Project"
4. Select scopes: ✅ **repo** (full control of private repositories)
5. Click **"Generate token"**
6. **Copy the token** (you won't see it again!)
7. When Git asks for password, **paste the token** instead

### **Option 2: SSH Keys (More Secure, One-Time Setup)**

Follow GitHub's guide: https://docs.github.com/en/authentication/connecting-to-github-with-ssh

---

## ✅ Quick Checklist

- [ ] GitHub repository created (or exists)
- [ ] Git initialized in project folder
- [ ] Remote repository connected (`git remote -v` shows your repo)
- [ ] All files staged (`git add .`)
- [ ] Files committed (`git commit`)
- [ ] Files pushed to GitHub (`git push`)

---

## 🐛 Common Issues

### **Issue: "remote origin already exists"**
**Solution**:
```bash
# Remove existing remote
git remote remove origin

# Add your repository again
git remote add origin YOUR_GITHUB_URL
```

### **Issue: "authentication failed"**
**Solution**: Use Personal Access Token (see above)

### **Issue: "branch 'main' does not exist"**
**Solution**: 
```bash
# Create main branch
git branch -M main

# Or use master
git push -u origin master
```

---

## 📝 Recommended Commit Message

```
Add enhanced recommendation system with statistical analysis

- Implemented multi-factor scoring algorithm (6 factors: color, brand, price, style, co-occurrence, color patterns)
- Added statistical analysis from session data (category transitions, color pairs, item co-occurrence)
- Dynamic customer profile generation from session behavior
- Explanation generation system for transparent recommendations
- Mix & Match outfit generator with combinatorial algorithm
- Frontend integration with recommendation display, scores, and explanations
- Image mapping and display fixes
```

---

## 🎯 What Files Will Be Committed?

- ✅ `backend/index.js` - Enhanced recommendation engine
- ✅ `frontend/src/app/kiosk/session/page.tsx` - UI integration
- ✅ All other project files (except node_modules, which is in .gitignore)

**Files NOT committed** (automatically ignored):
- ❌ `node_modules/` folders
- ❌ `.git/` folder
- ❌ Environment files (if in .gitignore)

---

**Ready?** Start with Step 1 above! 🚀

