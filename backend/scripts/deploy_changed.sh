#!/bin/bash

# Configuration
REGION="ca-central-1" # As per backend/README.md

echo "🔍 Searching for modified lambdas..."

# Get a list of changed lambda directories by comparing the current branch with the remote tracking branch
# Alternatively, check against the latest commit or uncommitted changes.
# Here we check for modifications compared to the last commit, as well as uncommitted changes.
CHANGED_LAMBDAS=$(git diff --name-only HEAD | grep "backend/lambdas" | awk -F/ '{print $3}' | sort -u)

# If no uncommitted changes, maybe check against the last push or branch origin?
if [ -z "$CHANGED_LAMBDAS" ]; then
    echo "No uncommitted lambda changes found."
    echo "Checking against origin/main to find recently committed changes..."
    # Adjust 'main' or 'master' depending on your default branch name
    CHANGED_LAMBDAS=$(git diff --name-only origin/HEAD...HEAD | grep "backend/lambdas" | awk -F/ '{print $3}' | sort -u)
fi

if [ -z "$CHANGED_LAMBDAS" ]; then
    echo "👍 No lambda changes found. Nothing to deploy."
    exit 0
fi

echo "Found changes in the following lambdas:"
echo "$CHANGED_LAMBDAS"
echo "----------------------------------------"

for lambda in $CHANGED_LAMBDAS; do
    LAMBDA_DIR="backend/lambdas/$lambda"
    
    if [ -d "$LAMBDA_DIR" ]; then
        echo "🚀 Deploying: $lambda..."
        
        cd "$LAMBDA_DIR" || exit
        
        # 1. Zip the lambda code quietly
        zip -q function.zip index.mjs
        
        # 2. Update the function code in AWS
        echo "   Uploading to AWS region $REGION..."
        aws lambda update-function-code \
            --function-name "$lambda" \
            --zip-file fileb://function.zip \
            --region $REGION > /dev/null
        
        # Check if the upload was successful
        if [ $? -eq 0 ]; then
            echo "✅ Successfully deployed: $lambda"
        else
            echo "❌ Failed to deploy: $lambda"
        fi
            
        # 3. Clean up the zip file
        rm function.zip
        
        # Go back to root
        cd ../../..
    fi
done

echo "🎉 All changed lambdas have been processed!"
