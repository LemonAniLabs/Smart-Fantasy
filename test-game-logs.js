// Copy and paste this into your browser console to test the game logs endpoint

async function testGameLogs() {
  console.log('=== Testing Player Season Game Logs ===\n');

  // Step 1: Get your teams
  console.log('Step 1: Fetching your teams...');
  const teamsResponse = await fetch('/api/yahoo/teams?leagueKey=428.l.95226');
  const teamsData = await teamsResponse.json();

  if (!teamsData.teams || teamsData.teams.length === 0) {
    console.error('Error: No teams found');
    return;
  }

  const myTeam = teamsData.teams[0];
  console.log(`✓ Found team: ${myTeam.name}\n`);

  // Step 2: Get roster
  console.log('Step 2: Fetching roster...');
  const rosterResponse = await fetch(`/api/yahoo/roster?teamKey=${myTeam.team_key}`);
  const rosterData = await rosterResponse.json();

  if (!rosterData.roster || rosterData.roster.length === 0) {
    console.error('Error: No players found');
    return;
  }

  // Pick first player
  const player = rosterData.roster[0];
  console.log(`✓ Testing with player: ${player.name.full} (${player.player_key})\n`);

  // Step 3: Test game logs endpoint (last 5 games)
  console.log('Step 3: Fetching last 5 games...');
  const startTime = Date.now();

  const gameLogsResponse = await fetch(`/api/yahoo/player-season-games?playerKey=${player.player_key}&limit=5`);
  const gameLogsData = await gameLogsResponse.json();

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`✓ Request completed in ${duration}s\n`);

  // Display results
  console.log('=== RESULTS ===\n');
  console.log(`Player: ${player.name.full}`);
  console.log(`Player Key: ${gameLogsData.playerKey}`);
  console.log(`Games Found: ${gameLogsData.gamesFound}`);
  console.log(`API Requests Made: ${gameLogsData.requestsMade}`);
  console.log(`Average Time per Request: ${(duration * 1000 / gameLogsData.requestsMade).toFixed(0)}ms\n`);

  // Display game logs
  if (gameLogsData.gameLogs && gameLogsData.gameLogs.length > 0) {
    console.log('=== GAME LOGS ===\n');
    gameLogsData.gameLogs.forEach((game, index) => {
      console.log(`Game ${index + 1} - ${game.date}`);
      console.log(`  Has Game: ${game.hasGame}`);
      console.log(`  Stats Count: ${Object.keys(game.stats).length}`);
      console.log(`  Sample Stats:`, Object.entries(game.stats).slice(0, 5).map(([id, val]) => `${id}=${val}`).join(', '));
      console.log('');
    });

    // Map stat IDs to readable names (common Yahoo stat IDs)
    const statIdMap = {
      '5': 'FGM',
      '6': 'FGA',
      '7': 'FG%',
      '8': 'FTM',
      '9': 'FTA',
      '10': 'FT%',
      '11': '3PTM',
      '12': 'PTS',
      '13': 'REB',
      '14': 'AST',
      '15': 'ST',
      '16': 'BLK',
      '17': 'TO'
    };

    console.log('=== HUMAN READABLE (First Game) ===\n');
    const firstGame = gameLogsData.gameLogs[0];
    console.log(`Date: ${firstGame.date}`);
    Object.entries(firstGame.stats).forEach(([statId, value]) => {
      const statName = statIdMap[statId] || `Stat ${statId}`;
      console.log(`  ${statName}: ${value}`);
    });
  } else {
    console.log('No game logs found!');
  }

  console.log('\n=== FULL RESPONSE ===');
  console.log(JSON.stringify(gameLogsData, null, 2));

  return gameLogsData;
}

// Run the test
testGameLogs().catch(error => {
  console.error('Test failed:', error);
});
