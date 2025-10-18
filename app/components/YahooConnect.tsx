'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import { useState, useEffect } from 'react'

export default function YahooConnect() {
  const { data: session, status } = useSession()
  const [leagues, setLeagues] = useState<unknown[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (session?.accessToken) {
      fetchLeagues()
    }
  }, [session])

  const fetchLeagues = async () => {
    setLoading(true)
    setError(null)
    try {
      // Try current season (2024 = 2024-25 NBA season)
      const response = await fetch('/api/yahoo/leagues?season=2024')
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch leagues')
      }
      const data = await response.json()
      console.log('Leagues data:', data)
      setLeagues(data.leagues || [])
    } catch (err: unknown) {
      setError((err as Error).message)
      console.error('Error fetching leagues:', err)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
        <p className="text-white">Loading session...</p>
      </div>
    )
  }

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
      <h2 className="text-2xl font-bold text-white mb-4">Yahoo Fantasy Connection</h2>
      
      {!session ? (
        <div className="space-y-4">
          <p className="text-purple-200">
            Connect your Yahoo Fantasy account to import your leagues and players.
          </p>
          <button
            onClick={() => signIn('yahoo')}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg flex items-center gap-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
            </svg>
            Connect with Yahoo
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-green-400 font-semibold">✓ Connected to Yahoo</p>
              <p className="text-sm text-purple-200">{session.user?.email}</p>
            </div>
            <button
              onClick={() => signOut()}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded text-sm"
            >
              Disconnect
            </button>
          </div>

          {loading && (
            <p className="text-purple-200">Loading your leagues...</p>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-500 rounded-lg p-3 text-sm text-red-200">
              Error: {error}
            </div>
          )}

          {leagues.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Your Leagues</h3>
              <div className="space-y-2">
                {leagues.map((league: unknown, index: number) => {
                  const leagueData = league as { name?: string; season?: string; num_teams?: number }
                  return (
                  <div
                    key={index}
                    className="bg-slate-800/50 p-3 rounded flex justify-between items-center"
                  >
                    <div>
                      <div className="font-semibold text-white">{leagueData.name || 'League'}</div>
                      <div className="text-xs text-purple-200">
                        {leagueData.season} | {leagueData.num_teams} teams
                      </div>
                    </div>
                    <button className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs font-semibold">
                      Import
                    </button>
                  </div>
                  )
                })}
              </div>
            </div>
          )}

          {!loading && leagues.length === 0 && !error && (
            <p className="text-purple-200 text-sm">
              No leagues found for the 2024-25 season. Try creating a league on Yahoo Fantasy Basketball!
            </p>
          )}
        </div>
      )}
    </div>
  )
}
