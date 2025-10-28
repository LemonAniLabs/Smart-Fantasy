#!/bin/bash

# Test Yahoo API Weekly Stats Endpoint
# This script calls the test endpoint to directly inspect Yahoo API responses

echo "=== Yahoo API Weekly Stats Test ==="
echo ""
echo "This script will test the Yahoo API weekly stats endpoint"
echo "You need to:"
echo "  1. Be signed in to the app at https://fantasy-basketball-iicr0ivbm-lemonlabs-projects.vercel.app"
echo "  2. Get your team key from the browser console or URL"
echo ""

# Check if team key is provided
if [ -z "$1" ]; then
    echo "Usage: ./test-yahoo-api.sh YOUR_TEAM_KEY"
    echo "Example: ./test-yahoo-api.sh 428.l.95226.t.1"
    echo ""
    echo "To find your team key:"
    echo "  1. Open browser console on the matchup page"
    echo "  2. Look for 'myTeamKey' in the console logs"
    echo "  3. Or check the URL parameters"
    exit 1
fi

TEAM_KEY="$1"
BASE_URL="https://fantasy-basketball-iicr0ivbm-lemonlabs-projects.vercel.app"

echo "Team Key: $TEAM_KEY"
echo "Calling: $BASE_URL/api/yahoo/test?myTeamKey=$TEAM_KEY"
echo ""
echo "=== Response ==="
echo ""

# Make the request and format the JSON output
curl -s "$BASE_URL/api/yahoo/test?myTeamKey=$TEAM_KEY" | python3 -m json.tool

echo ""
echo "=== Done ==="
