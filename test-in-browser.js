// Copy and paste this into your browser console to test the Yahoo API endpoint

// First, let's get your team key from the current session
async function testYahooAPI() {
  console.log('=== Yahoo API Weekly Stats Test ===\n');

  // Get teams first to find your team key
  console.log('Step 1: Fetching your teams...');
  const teamsResponse = await fetch('/api/yahoo/teams');
  const teamsData = await teamsResponse.json();

  if (!teamsData.teams || teamsData.teams.length === 0) {
    console.error('Error: No teams found');
    return;
  }

  // Use the first team
  const myTeam = teamsData.teams[0];
  const myTeamKey = myTeam.team_key;
  console.log(`✓ Found team: ${myTeam.name} (${myTeamKey})\n`);

  // Now test the weekly stats API
  console.log('Step 2: Testing Yahoo API weekly stats...');
  console.log(`Calling: /api/yahoo/test?myTeamKey=${myTeamKey}\n`);

  const testResponse = await fetch(`/api/yahoo/test?myTeamKey=${myTeamKey}`);
  const testData = await testResponse.json();

  console.log('=== Test Results ===\n');
  console.log(`Current Week: ${testData.currentWeek}`);
  console.log(`League Key: ${testData.leagueKey}`);
  console.log(`Team Key: ${testData.myTeamKey}\n`);

  // Display results for each player
  testData.testResults.forEach((player, index) => {
    console.log(`\n--- Player ${index + 1}: ${player.playerName} ---`);
    console.log(`Player Key: ${player.playerKey}`);

    Object.entries(player.weeks).forEach(([weekKey, weekData]) => {
      const weekNum = weekKey.replace('week', '');
      console.log(`\n  ${weekKey.toUpperCase()}:`);
      console.log(`    Status: ${weekData.status}`);
      console.log(`    Has Data: ${weekData.hasData ? '✓ YES' : '✗ NO'}`);
      console.log(`    Stats Count: ${weekData.statsCount}`);

      if (weekData.hasData && weekData.rawStats) {
        console.log(`    Sample Stats:`, weekData.rawStats.slice(0, 3));
      }

      if (weekData.error) {
        console.log(`    Error: ${weekData.error}`);
      }
    });
  });

  console.log('\n=== Summary ===');
  const firstPlayer = testData.testResults[0];
  if (firstPlayer && firstPlayer.weeks) {
    Object.entries(firstPlayer.weeks).forEach(([weekKey, weekData]) => {
      const weekNum = weekKey.replace('week', '');
      const status = weekData.hasData ? '✓ Has Data' : '✗ No Data';
      console.log(`Week ${weekNum}: ${status} (${weekData.statsCount} stats)`);
    });
  }

  console.log('\n=== Full Response ===');
  console.log(JSON.stringify(testData, null, 2));

  return testData;
}

// Run the test
testYahooAPI().catch(error => {
  console.error('Test failed:', error);
});
