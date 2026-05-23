/**
 * Component: TimeScrubber
 * Controls simulation time with slider and playback controls
 */

import { useState, useEffect } from 'react'
import { useSimulation, useCurrentDate } from '@store/simulation'
import { format } from 'date-fns'
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react'

export function TimeScrubber() {
  const {
    currentTime,
    baseTime,
    isPlaying,
    playSpeed,
    timeRange,
    setTime,
    togglePlayback,
    setPlaySpeed,
  } = useSimulation()

  const [isDragging, setIsDragging] = useState(false)
  const [displayValue, setDisplayValue] = useState(0)

  const currentDate = useCurrentDate()
  const SECONDS_PER_DAY = 86400

  // Calculate slider position (0-100)
  const timeRange_years = timeRange / 365.25
  const daysSinceBase = (currentTime - baseTime) * 365.25
  const sliderPosition = ((daysSinceBase + timeRange_years / 2) / timeRange_years) * 100

  useEffect(() => {
    if (!isDragging) {
      setDisplayValue(sliderPosition)
    }
  }, [sliderPosition, isDragging])

  const handleSliderChange = (value: number) => {
    setDisplayValue(value)
    const daysFromBase = ((value / 100) * timeRange_years - timeRange_years / 2) * 365.25
    const newJD = baseTime + daysFromBase
    setTime(newJD)
  }

  const handleBackward = () => {
    const newTime = currentTime - 30 // Go back 30 days
    setTime(newTime)
  }

  const handleForward = () => {
    const newTime = currentTime + 30 // Go forward 30 days
    setTime(newTime)
  }

  const handleReset = () => {
    setTime(baseTime)
  }

  return (
    <div className="flex flex-col gap-4 p-4 bg-slate-950 rounded-lg border border-slate-700 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-blue-400">Time Control</h3>
        <button
          onClick={handleReset}
          className="text-xs px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-gray-300"
        >
          Reset
        </button>
      </div>

      {/* Date Display */}
      <div className="text-center">
        <p className="text-xs text-gray-500">Current Date</p>
        <p className="text-xl font-mono font-bold text-emerald-400">
          {format(currentDate, 'MMM dd, yyyy')}
        </p>
        <p className="text-sm font-mono text-gray-400">
          {format(currentDate, 'HH:mm:ss')} UTC
        </p>
      </div>

      {/* Playback Controls */}
      <div className="flex gap-2 items-center justify-center">
        <button
          onClick={handleBackward}
          className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-gray-300 transition"
          title="Go back 30 days"
        >
          <SkipBack size={18} />
        </button>

        <button
          onClick={togglePlayback}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded font-semibold transition ${
            isPlaying
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          {isPlaying ? (
            <>
              <Pause size={18} />
              Pause
            </>
          ) : (
            <>
              <Play size={18} />
              Play
            </>
          )}
        </button>

        <button
          onClick={handleForward}
          className="p-2 bg-slate-800 hover:bg-slate-700 rounded text-gray-300 transition"
          title="Go forward 30 days"
        >
          <SkipForward size={18} />
        </button>
      </div>

      {/* Time Slider */}
      <div className="flex flex-col gap-2">
        <input
          type="range"
          min="0"
          max="100"
          step="0.1"
          value={displayValue}
          onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={() => setIsDragging(false)}
          className="w-full h-2 bg-gradient-to-r from-slate-700 to-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${displayValue}%, #4b5563 ${displayValue}%, #4b5563 100%)`,
          }}
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>-{(timeRange_years / 2).toFixed(1)} years</span>
          <span>Now</span>
          <span>+{(timeRange_years / 2).toFixed(1)} years</span>
        </div>
      </div>

      {/* Speed Control */}
      <div>
        <label className="text-xs text-gray-400 block mb-2">Playback Speed</label>
        <div className="grid grid-cols-4 gap-2">
          {[1, 10, 100, 1000].map((speed) => (
            <button
              key={speed}
              onClick={() => setPlaySpeed(speed)}
              className={`py-1 px-2 rounded text-sm font-mono transition ${
                playSpeed === speed
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>

      {/* Info */}
      {isPlaying && (
        <div className="text-xs text-blue-400 text-center italic">
          {playSpeed}x speed simulation running
        </div>
      )}
    </div>
  )
}
