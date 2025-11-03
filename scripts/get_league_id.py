#!/usr/bin/env python3
"""
Helper script to get your Yahoo Fantasy Basketball league ID
"""

import os
import sys
from dotenv import load_dotenv
from yfpy.query import YahooFantasySportsQuery

# Load environment variables
load_dotenv()

YAHOO_CLIENT_ID = os.getenv('YAHOO_CLIENT_ID')
YAHOO_CLIENT_SECRET = os.getenv('YAHOO_CLIENT_SECRET')

def get_user_leagues():
    """Get all leagues for the authenticated user"""

    print("\n" + "="*60)
    print("🏀 Yahoo Fantasy Basketball - Get League ID")
    print("="*60 + "\n")

    # Check credentials
    if not all([YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET]):
        print("✗ Missing Yahoo credentials in .env")
        sys.exit(1)

    try:
        # Initialize Yahoo Fantasy Query for current season (2025)
        yahoo = YahooFantasySportsQuery(
            league_id=None,  # Not needed for getting user's leagues
            game_code='nba',
            game_id=2025,
            yahoo_consumer_key=YAHOO_CLIENT_ID,
            yahoo_consumer_secret=YAHOO_CLIENT_SECRET
        )

        print("🔐 Authenticating with Yahoo...")
        print("   (A browser window will open for OAuth authorization)")
        print()

        # Get user's leagues
        # This will trigger OAuth flow if not already authenticated
        user_leagues = yahoo.get_all_user_leagues()

        if not user_leagues or len(user_leagues) == 0:
            print("✗ No leagues found for your account")
            print("   Make sure you've joined a Fantasy Basketball league for the 2025-26 season")
            sys.exit(1)

        print(f"✓ Found {len(user_leagues)} league(s):\n")

        for i, league in enumerate(user_leagues, 1):
            league_key = league.league_key
            league_id = league.league_id
            league_name = league.name
            num_teams = league.num_teams if hasattr(league, 'num_teams') else 'N/A'

            print(f"[{i}] {league_name}")
            print(f"    League Key: {league_key}")
            print(f"    League ID: {league_id}")
            print(f"    Teams: {num_teams}")
            print()

        # Return the first league ID
        first_league = user_leagues[0]
        league_id = first_league.league_id

        print("="*60)
        print(f"📋 Use this League ID: {league_id}")
        print("="*60)
        print()
        print("Now you can run:")
        print(f"  venv/bin/python backfill_data.py {league_id} 2024-25 5")
        print()

        return league_id

    except KeyboardInterrupt:
        print("\n\n⚠️  Cancelled by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    get_user_leagues()
