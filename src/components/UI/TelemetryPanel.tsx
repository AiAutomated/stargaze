/**
 * Component: TelemetryPanel
 * Displays telemetry data for selected objects
 */

import { useSimulation, useCurrentDate } from '@store/simulation'
import { useEarthAsThreeVector } from '@hooks/useEarthPosition'
import { Info } from 'lucide-react'

export function TelemetryPanel() {
  const { selectedShower, earthPosition } = useSimulation()
  const currentDate = useCurrentDate()
  const earthPositionVec = useEarthAsThreeVector()

  // Earth telemetry
  const earthDistanceAU = earthPositionVec.length() / 1.496e11
  const earthVelocity = 29.78 // km/s (approximate orbital velocity)

  return (
    <div className="flex flex-col gap-4 p-4 bg-slate-950 rounded-lg border border-slate-700 shadow-lg">
      <h3 className="text-lg font-semibold text-blue-400">Telemetry</h3>

      {/* Earth Telemetry */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-emerald-400">Earth</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-slate-900 p-2 rounded">
            <span className="text-gray-400">Distance from Sun</span>
            <p className="font-mono font-bold text-blue-300">{earthDistanceAU.toFixed(4)} AU</p>
          </div>
          <div className="bg-slate-900 p-2 rounded">
            <span className="text-gray-400">Orbital Velocity</span>
            <p className="font-mono font-bold text-blue-300">{earthVelocity.toFixed(2)} km/s</p>
          </div>
          <div className="bg-slate-900 p-2 rounded col-span-2">
            <span className="text-gray-400">Position (ECI)</span>
            <p className="font-mono font-bold text-blue-300 text-xs">
              X: {(earthPosition[0] / 1e10).toFixed(2)} × 10¹⁰ m
            </p>
            <p className="font-mono font-bold text-blue-300 text-xs">
              Y: {(earthPosition[1] / 1e10).toFixed(2)} × 10¹⁰ m
            </p>
            <p className="font-mono font-bold text-blue-300 text-xs">
              Z: {(earthPosition[2] / 1e10).toFixed(2)} × 10¹⁰ m
            </p>
          </div>
        </div>
      </div>

      {/* Meteor Shower Info (if selected) */}
      {selectedShower && <MeteorShowerTelemetry showerName={selectedShower} />}

      {/* Simulation Info */}
      <div className="border-t border-slate-700 pt-4">
        <h4 className="text-sm font-semibold text-purple-400 mb-2">Simulation Info</h4>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Current Date:</span>
            <span className="font-mono text-blue-300">{currentDate.toDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Time Format:</span>
            <span className="font-mono text-blue-300">Julian Date (Simulated)</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Meteor shower telemetry sub-component
 */
function MeteorShowerTelemetry({ showerName }: { showerName: string }) {
  // Mock data - replace with actual shower data from store
  const showerData = {
    name: showerName,
    parentComet: '109P/Swift-Tuttle',
    radiant: 'Perseus',
    peakZHR: 100,
    peakSpeed: 59,
    status: 'Potential Entry',
  }

  return (
    <div className="space-y-2 border-t border-slate-700 pt-4">
      <h4 className="text-sm font-semibold text-orange-400 flex items-center gap-2">
        <Info size={16} />
        {showerData.name}
      </h4>

      <div className="bg-slate-900 p-3 rounded space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Parent Comet:</span>
          <span className="font-mono text-orange-300">{showerData.parentComet}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Radiant (Constellation):</span>
          <span className="font-mono text-orange-300">{showerData.radiant}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Peak ZHR:</span>
          <span className="font-mono text-orange-300">{showerData.peakZHR} meteors/hr</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Meteoroid Velocity:</span>
          <span className="font-mono text-orange-300">{showerData.peakSpeed} km/s</span>
        </div>

        {/* Status indicator */}
        <div className="mt-3 pt-3 border-t border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            <span className="text-xs text-yellow-400">{showerData.status}</span>
          </div>
        </div>
      </div>

      {/* Educational insight */}
      <div className="bg-amber-950 bg-opacity-30 border-l-2 border-amber-600 p-3 rounded text-xs text-amber-200">
        <p className="font-semibold mb-1">💡 Why This Happens</p>
        <p>
          Earth is crossing the debris field left by {showerData.parentComet}. As our planet
          moves through this region of space, particles collide with our atmosphere, creating
          visible meteors.
        </p>
      </div>
    </div>
  )
}
