# Yahoo API Weekly Stats Test Endpoint

## Purpose

This test endpoint makes direct API calls to Yahoo Fantasy Sports to inspect the raw weekly stats responses. This helps us debug why the time range filtering is not working (returns empty stats for 最近 1 週/2 週/4 週).

## Test Endpoint

**URL**: `https://fantasy-basketball-iicr0ivbm-lemonlabs-projects.vercel.app/api/yahoo/test`

**Parameters**:
- `myTeamKey` (required) - Your team key, e.g., `428.l.95226.t.1`

## How to Use

### Option 1: Using the provided script

```bash
./test-yahoo-api.sh YOUR_TEAM_KEY
```

Example:
```bash
./test-yahoo-api.sh 428.l.95226.t.1
```

### Option 2: Using curl directly

```bash
curl "https://fantasy-basketball-iicr0ivbm-lemonlabs-projects.vercel.app/api/yahoo/test?myTeamKey=YOUR_TEAM_KEY" | python3 -m json.tool
```

### Option 3: Using your browser

1. Sign in to the app at https://fantasy-basketball-iicr0ivbm-lemonlabs-projects.vercel.app
2. Navigate to the 本週對戰 (Weekly Matchup) page
3. Open browser console (F12)
4. Find your team key in the console logs (look for `myTeamKey`)
5. Visit: `https://fantasy-basketball-iicr0ivbm-lemonlabs-projects.vercel.app/api/yahoo/test?myTeamKey=YOUR_TEAM_KEY`

## What the Test Does

The endpoint will:

1. Get the current week number from league metadata
2. Fetch your team roster
3. Test the first 3 players on your roster
4. For each player, test Yahoo API weekly stats for:
   - Current week (week 2)
   - Previous week (week 1)
   - Week before that (week 0, if available)

## What to Look For

The response will show for each player and each week:

```json
{
  "currentWeek": 2,
  "leagueKey": "428.l.95226",
  "myTeamKey": "428.l.95226.t.1",
  "testResults": [
    {
      "playerName": "Stephen Curry",
      "playerKey": "428.p.4612",
      "weeks": {
        "week2": {
          "status": 200,
          "hasData": false,
          "statsCount": 0,
          "rawStats": [],
          "fullResponse": { ... }
        },
        "week1": {
          "status": 200,
          "hasData": true,
          "statsCount": 15,
          "rawStats": [ ... ],
          "fullResponse": { ... }
        }
      }
    }
  ]
}
```

**Key fields**:
- `status`: HTTP status code (200 = success)
- `hasData`: Whether the Yahoo API returned actual stats
- `statsCount`: Number of stat categories returned
- `rawStats`: The actual stats array from Yahoo
- `fullResponse`: The complete Yahoo API response

## Expected Findings

Based on the issue, we expect to see:

1. **Week 2 (current week)**: `hasData: false`, `statsCount: 0` - Empty stats because the week is still in progress
2. **Week 1 (previous week)**: `hasData: true`, `statsCount: > 0` - Complete stats because the week has finished

This will confirm whether:
- The API endpoint URL is correct
- The authentication is working
- Yahoo simply doesn't provide stats for in-progress weeks

## Next Steps Based on Results

### If week 2 is empty but week 1 has data:
✅ This confirms our hypothesis: Yahoo doesn't provide weekly stats for in-progress weeks
→ Solution: Use the most recent **completed** week instead of current week

### If both weeks are empty:
❌ There's a different issue
→ Check the `fullResponse` for error messages or investigate the API response structure

### If both weeks have data:
❌ The issue is in our data processing logic
→ Review how we parse and aggregate the weekly stats

## Production Logs

To see the detailed server-side logs, check Vercel:

```bash
vercel logs fantasy-basketball-iicr0ivbm-lemonlabs-projects.vercel.app --follow
```

This will show all the console.log output including:
- Exact API URLs being called
- Full Yahoo API responses
- Any errors encountered
