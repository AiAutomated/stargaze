/**
 * Component: Layout
 * Main application layout with 3D scene and UI panels
 */

import { useState, useEffect } from 'react'
import { useSimulation } from '@store/simulation'
import { StargazeScene } from './3D/Scene'
import { TimeScrubber } from './UI/TimeScrubber'
import { TelemetryPanel } from './UI/TelemetryPanel'
import { Menu, X, Settings } from 'lucide-react'

export function Layout() {
  const [isMobile, setIsMobile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile)
  const { setMode } = useSimulation()

  // Detect mobile
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="w-full h-screen bg-slate-950 flex overflow-hidden">
      {/* Main 3D Canvas */}
      <div className="flex-1 relative">
        <StargazeScene />

        {/* Mobile Toggle Button */}
        {isMobile && (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="absolute top-4 right-4 z-20 p-2 bg-slate-800 hover:bg-slate-700 rounded text-gray-300 transition"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        )}

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-slate-950 to-transparent">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              🌌 Stargaze
            </h1>
            <div className="flex gap-2">
              <button className="p-2 hover:bg-slate-800 rounded transition text-gray-300">
                <Settings size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Mode Buttons (Bottom Center) */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10">
          <ModeSelector />
        </div>
      </div>

      {/* Sidebar */}
      <div
        className={`fixed md:relative z-20 right-0 top-0 h-screen w-80 bg-slate-950 border-l border-slate-700 shadow-lg transform transition-transform ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full'
        } md:translate-x-0 overflow-y-auto`}
      >
        <div className="p-4 space-y-4">
          <TimeScrubber />
          <TelemetryPanel />
        </div>
      </div>
    </div>
  )
}

/**
 * Mode Selector Component
 */
function ModeSelector() {
  const { selectedMode, setMode } = useSimulation()

  const modes: Array<{ id: any; label: string; icon: string }> = [
    { id: 'explore', label: 'Explore', icon: '🔭' },
    { id: 'meteors', label: 'Meteors', icon: '☄️' },
    { id: 'iss', label: 'ISS', icon: '🛰️' },
    { id: 'orbital', label: 'Orbital', icon: '⭘' },
    { id: 'timeline', label: 'Timeline', icon: '📅' },
  ]

  return (
    <div className="flex gap-2 bg-slate-900 bg-opacity-80 backdrop-blur-sm p-2 rounded-lg border border-slate-700">
      {modes.map((mode) => (
        <button
          key={mode.id}
          onClick={() => setMode(mode.id)}
          className={`flex flex-col items-center gap-1 px-3 py-2 rounded-md transition ${
            selectedMode === mode.id
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
          }`}
        >
          <span className="text-lg">{mode.icon}</span>
          <span className="text-xs font-semibold">{mode.label}</span>
        </button>
      ))}
    </div>
  )
}
