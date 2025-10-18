# Fantasy Basketball Draft Assistant 🏀

AI-powered Yahoo Fantasy Basketball draft assistant, optimized for **11-Cat H2H Salary Cap Draft** leagues.

## Live Demo

🔗 **https://fantasy-basketball-ooxkdiy7d-lemonlabs-projects.vercel.app**

## Features

### Core Features
- **Intelligent Ranking System**: Z-Score analysis based on 2024-25 season data (448 qualified players)
- **Flexible League Formats**: Support for 9-Cat, 8-Cat, 11-Cat H2H, Points League, and Roto formats
- **Multiple Draft Types**: Snake Draft, Auction Draft, and Salary Cap Draft modes
- **Real-time Draft Simulation**: Track budget, roster spots, and category coverage
- **Position-specific Rankings**: Detailed breakdowns for PG, SG, SF, PF, C
- **Dynamic Category Coverage**: Adjusts based on your league format

### Yahoo Fantasy Integration (Hybrid Mode)

**Mode 1: Basic Assistant (No Yahoo Account Required)**
- Manual league configuration
- Static player rankings
- General draft strategy

**Mode 2: Yahoo Public Data (Developer Credentials Only)**
- Access latest player stats via Yahoo Fantasy API
- No user login required
- Real-time player data updates

**Mode 3: Personal Integration (Coming Soon)**
- Connect your Yahoo Fantasy account
- Import your league settings automatically
- Sync your team roster
- Personalized draft strategy based on your actual league

## Quick Start

### Installation

```bash
npm install
```

### Environment Setup

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. **For Yahoo API Integration** (Optional - Mode 2 & 3):
   - Go to [Yahoo Developer Network](https://developer.yahoo.com/apps/create/)
   - Create a new application
   - Select "Fantasy Sports" with Read/Write access
   - Set Redirect URI: `http://localhost:3000/api/auth/callback/yahoo`
   - Copy Client ID and Client Secret to `.env`

3. Generate NextAuth secret:
```bash
openssl rand -base64 32
```

### Development

```bash
npm run dev
```

Visit: **http://localhost:3000**

### Test Yahoo API Connection

```bash
curl http://localhost:3000/api/yahoo/test
```

### Data Updates

Fetch latest 2024-25 season stats:

```bash
npx tsx scripts/fetch-2024-25-stats-v2.ts
```

Generate updated draft rankings:

```bash
npx tsx scripts/generate-draft-rankings-2024-25.ts
```

## Top 10 Player Rankings (2024-25 Season)

1. **Nikola Jokić** (DEN) - $100
   - Strengths: FGM, FG%, PTS, OREB, REB, AST, STL, A/T

2. **Victor Wembanyama** (SAS) - $99
   - Strengths: FGM, 3PM, PTS, OREB, REB, STL, BLK

3. **Shai Gilgeous-Alexander** (OKC) - $99
   - Strengths: FGM, FT%, 3PM, PTS, AST, STL, BLK, A/T

4. **Anthony Davis** (LAL) - $98
   - Strengths: FGM, FG%, PTS, OREB, REB, STL, BLK

5. **Tyrese Haliburton** (IND) - $97
   - Strengths: FGM, FT%, 3PM, PTS, AST, STL, A/T

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Data Source**: NBA Stats API (https://github.com/nprasad2077/nbaStats)
- **Deployment**: Vercel
- **Database**: PostgreSQL (Neon) - for future features

## League Configuration

- **Format**: 11-Category H2H
- **Draft Type**: Salary Cap ($200 budget)
- **Teams**: 14
- **Roster**: 16 spots (PG, SG, G, SF, PF, F, C, C, Util, Util, BN×3, IL, IL+×2)

## Project Structure

```
fantasy-basketball-ai/
├── app/
│   ├── components/
│   │   └── DraftAssistant.tsx    # Main draft UI component
│   └── page.tsx                  # Landing page
├── data/
│   ├── player-stats-2024-25.json # Raw player statistics
│   └── draft-rankings-2024-25.json # Calculated rankings
├── lib/
│   └── calculate-player-values.ts # Z-Score calculation engine
├── scripts/
│   ├── fetch-2024-25-stats-v2.ts    # Data fetching script
│   └── generate-draft-rankings-2024-25.ts # Rankings generator
└── public/
    └── data/
        └── draft-rankings-2024-25.json # Client-accessible rankings
```

## Algorithm

The ranking system uses **Z-Score normalization** across all 11 categories:

1. Calculate mean and standard deviation for each stat
2. Convert player stats to Z-Scores
3. Sum Z-Scores to get VORP (Value Over Replacement Player)
4. Assign prices based on percentile ranking
5. Generate tier rankings (Tier 1-10)

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit changes with clear messages
4. Submit a pull request

## License

MIT

## Acknowledgments

- NBA Stats API by nprasad2077
- Inspired by ESPN and Yahoo Fantasy Basketball platforms

---

**Good luck with your draft!** 🏆
