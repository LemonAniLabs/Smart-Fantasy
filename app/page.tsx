import DraftAssistant from './components/DraftAssistant'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2">
            Fantasy Basketball Draft Assistant
          </h1>
          <p className="text-xl text-purple-200">
            11-Cat H2H | Salary Cap Draft | 2025-26 Season
          </p>
          <p className="text-sm text-purple-300 mt-2">
            Customize your league settings below
          </p>
        </header>

        <DraftAssistant />
      </div>
    </main>
  )
}
