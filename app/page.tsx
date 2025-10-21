'use client'

import { useState } from 'react'
import DraftAssistant from './components/DraftAssistant'
import YahooConnect from './components/YahooConnect'

type Tab = 'draft' | 'team'

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('team')

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2">
            Fantasy Basketball Assistant
          </h1>
          <p className="text-xl text-purple-200">
            2024-25 NBA Season
          </p>
        </header>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-1 inline-flex">
            <button
              onClick={() => setActiveTab('team')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'team'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'text-purple-200 hover:text-white'
              }`}
            >
              My Yahoo Team
            </button>
            <button
              onClick={() => setActiveTab('draft')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'draft'
                  ? 'bg-purple-600 text-white shadow-lg'
                  : 'text-purple-200 hover:text-white'
              }`}
            >
              Draft Assistant
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'draft' ? (
          <div>
            <div className="text-center mb-6">
              <p className="text-sm text-purple-300">
                Use NBA stats to find the best players for your draft
              </p>
            </div>
            <DraftAssistant />
          </div>
        ) : (
          <div>
            <div className="text-center mb-6">
              <p className="text-sm text-purple-300">
                Connect to Yahoo Fantasy to view and manage your team
              </p>
            </div>
            <YahooConnect />
          </div>
        )}
      </div>
    </main>
  )
}
