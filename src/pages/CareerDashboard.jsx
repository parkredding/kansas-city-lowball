/**
 * ============================================================================
 * CAREER & RIVALS DASHBOARD
 * The "War Room" - Comprehensive analytics suite for poker players
 * ============================================================================
 *
 * Sections:
 *   1. Stats Overview - Key metrics (VPIP, PFR, Win Rate, etc.)
 *   2. Performance Graph - Blue/Red line cumulative winnings
 *   3. Game Type Stats - Performance breakdown by variant
 *   4. Position Stats - Win rate by table position
 *   5. Starting Hand Heatmap - 13x13 Hold'em hand profitability
 *   6. Rivals Panel - Head-to-head tracking with radar charts
 *   7. Tale of the Tape - Boxing-style hero vs villain comparison
 *   8. GTO Performance - Accuracy vs AI bot with Leak Finder
 *
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { getUserStats, getUserStatsVsRival, getEmptyStats } from '../services/StatsService';
import { getRivals, computeTaleOfTheTape } from '../services/RivalsService';
import { getGTOPerformance, computeGTOSummary, findLeaks } from '../services/GTOService';
import StatsOverview from '../components/career/StatsOverview';
import PerformanceGraph from '../components/career/PerformanceGraph';
import GameTypeStats from '../components/career/GameTypeStats';
import PositionStats from '../components/career/PositionStats';
import StartingHandHeatmap from '../components/career/StartingHandHeatmap';
import RivalCard from '../components/career/RivalCard';
import TaleOfTheTape from '../components/career/TaleOfTheTape';
import GTOPerformance from '../components/career/GTOPerformance';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'rivals', label: 'Rivals' },
  { id: 'gto', label: 'GTO Lab' },
];

export default function CareerDashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [overallStats, setOverallStats] = useState(getEmptyStats());
  const [filteredStats, setFilteredStats] = useState(null);
  const [gameTypeFilter, setGameTypeFilter] = useState(null);

  // Use filtered stats when a rival filter is active, otherwise overall stats
  const stats = filteredStats || overallStats;

  // Rivals state
  const [rivals, setRivals] = useState([]);
  const [selectedRival, setSelectedRival] = useState(null);
  const [rivalStats, setRivalStats] = useState(null);
  const [taleOfTape, setTaleOfTape] = useState(null);
  const [rivalFilterActive, setRivalFilterActive] = useState(false);

  // GTO state
  const [gtoSummary, setGtoSummary] = useState(null);

  // Load overall stats (once on mount and when game type filter changes)
  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);
    const options = {};
    if (gameTypeFilter) options.gameType = gameTypeFilter;

    getUserStats(currentUser.uid, options)
      .then((s) => {
        setOverallStats(s);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load stats:', err);
        setLoading(false);
      });
  }, [currentUser, gameTypeFilter]);

  // Load rivals list
  useEffect(() => {
    if (!currentUser) return;

    getRivals(currentUser.uid)
      .then(setRivals)
      .catch((err) => console.error('Failed to load rivals:', err));
  }, [currentUser]);

  // Load GTO performance
  useEffect(() => {
    if (!currentUser || activeTab !== 'gto') return;

    getGTOPerformance(currentUser.uid)
      .then((records) => {
        const summary = computeGTOSummary(records);
        summary.leaks = findLeaks(records);
        setGtoSummary(summary);
      })
      .catch((err) => console.error('Failed to load GTO data:', err));
  }, [currentUser, activeTab]);

  // Handle rival selection
  const handleSelectRival = useCallback(async (rival) => {
    if (!currentUser) return;

    if (selectedRival?.id === rival.id) {
      // Deselect - restore overall stats without re-fetching
      setSelectedRival(null);
      setRivalStats(null);
      setTaleOfTape(null);
      setRivalFilterActive(false);
      setFilteredStats(null);
      return;
    }

    setSelectedRival(rival);

    try {
      // Load stats filtered by this rival
      const vsStats = await getUserStatsVsRival(currentUser.uid, rival.rivalUid || rival.id);
      setRivalStats(vsStats);
      setRivalFilterActive(true);
      setFilteredStats(vsStats);

      // Load Tale of the Tape
      const tape = await computeTaleOfTheTape(currentUser.uid, rival.rivalUid || rival.id);
      setTaleOfTape(tape);
    } catch (err) {
      console.error('Failed to load rival stats:', err);
    }
  }, [currentUser, selectedRival]);

  // Clear rival filter - restores overall stats without re-fetching
  const clearRivalFilter = useCallback(() => {
    setSelectedRival(null);
    setRivalStats(null);
    setTaleOfTape(null);
    setRivalFilterActive(false);
    setFilteredStats(null);
  }, []);

  // Handle game type filter
  const handleFilterGameType = useCallback((type) => {
    setGameTypeFilter((prev) => (prev === type ? null : type));
  }, []);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 flex items-center justify-center">
        <p className="text-slate-500">Please log in to view your career dashboard.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 sticky top-0 z-40" style={{ backdropFilter: 'blur(12px)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/game')}
              className="text-slate-400 hover:text-slate-200 transition-colors text-sm"
            >
              &larr; Back to Table
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-100">Career & Rivals</h1>
              <p className="text-xs text-slate-500">The War Room</p>
            </div>
          </div>

          {/* Tabs */}
          <nav className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Active filters */}
        {(gameTypeFilter || rivalFilterActive) && (
          <div className="max-w-7xl mx-auto px-4 pb-2 flex items-center gap-2">
            {gameTypeFilter && (
              <button
                type="button"
                onClick={() => setGameTypeFilter(null)}
                className="px-2 py-1 rounded-md bg-blue-500/20 border border-blue-500/30 text-xs text-blue-400 hover:bg-blue-500/30"
              >
                Game: {gameTypeFilter} &times;
              </button>
            )}
            {rivalFilterActive && selectedRival && (
              <button
                type="button"
                onClick={clearRivalFilter}
                className="px-2 py-1 rounded-md bg-purple-500/20 border border-purple-500/30 text-xs text-purple-400 hover:bg-purple-500/30"
              >
                VS: {selectedRival.villainDisplayName} &times;
              </button>
            )}
          </div>
        )}
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <motion.div
              className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <motion.div
                className="space-y-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {/* Key Stats */}
                <StatsOverview
                  stats={stats}
                  rivalFilter={rivalFilterActive ? selectedRival?.villainDisplayName : null}
                />

                {/* Performance Graph */}
                <PerformanceGraph cumulativeData={stats.cumulativeData} />

                {/* Game Type & Position side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <GameTypeStats
                    gameTypeStats={stats.gameTypeStats}
                    onFilterGameType={handleFilterGameType}
                  />
                  <PositionStats positionStats={stats.positionStats} />
                </div>

                {/* Starting Hand Heatmap (Hold'em only) */}
                {stats.gameTypeStats?.holdem && (
                  <StartingHandHeatmap startingHandStats={stats.startingHandStats} />
                )}
              </motion.div>
            )}

            {/* RIVALS TAB */}
            {activeTab === 'rivals' && (
              <motion.div
                className="space-y-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Rivals List */}
                  <div className="lg:col-span-1 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
                      Your Rivals ({rivals.length})
                    </h3>
                    {rivals.length === 0 ? (
                      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6 text-center">
                        <p className="text-slate-500 text-sm">
                          No rivals yet. Play against other players to build rivalry data.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {rivals.map((rival) => (
                          <RivalCard
                            key={rival.id}
                            rival={rival}
                            heroMetrics={taleOfTape?.hero}
                            villainMetrics={taleOfTape?.villain}
                            onSelect={handleSelectRival}
                            isSelected={selectedRival?.id === rival.id}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tale of the Tape */}
                  <div className="lg:col-span-2 space-y-4">
                    <TaleOfTheTape
                      heroName={currentUser?.displayName || 'You'}
                      villainName={selectedRival?.villainDisplayName}
                      hero={taleOfTape?.hero}
                      villain={taleOfTape?.villain}
                      insights={taleOfTape?.insights}
                    />

                    {/* Rival-filtered stats */}
                    {rivalFilterActive && rivalStats && (
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wide">
                          Your Stats vs {selectedRival?.villainDisplayName}
                        </h3>
                        <StatsOverview
                          stats={rivalStats}
                          rivalFilter={selectedRival?.villainDisplayName}
                        />
                        <PerformanceGraph cumulativeData={rivalStats.cumulativeData} />
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* GTO LAB TAB */}
            {activeTab === 'gto' && (
              <motion.div
                className="space-y-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div>
                  <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-1">
                    GTO Performance Lab
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Accuracy analysis of your play against the AI bot. Measures how closely your decisions
                    match Game Theory Optimal (GTO) play.
                  </p>
                </div>
                <GTOPerformance gtoSummary={gtoSummary} />
              </motion.div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
