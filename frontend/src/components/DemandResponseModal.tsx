'use client'

import React, { useState } from 'react'
import { triggerDemandResponse, DemandResponseResult } from '@/lib/api'

interface DemandResponseModalProps {
  isOpen: boolean
  onClose: () => void
  currentFeeder: string
}

export default function DemandResponseModal({
  isOpen,
  onClose,
  currentFeeder,
}: DemandResponseModalProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [simulatedStress, setSimulatedStress] = useState(92)
  const [result, setResult] = useState<DemandResponseResult | null>(null)

  if (!isOpen) return null

  const handleRunDemandResponse = async () => {
    setIsRunning(true)
    try {
      const capacity = 50.0
      const currentLoad = (capacity * simulatedStress) / 100
      const data = await triggerDemandResponse(currentFeeder, currentLoad, capacity)
      setResult(data)
    } catch (err: any) {
      alert(`Demand response failed: ${err.message}`)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-xl font-bold">
              ⚡
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                DISCOM Demand Response & Feeder Mitigator
                <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded-full">
                  LangGraph
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Feeder: <span className="font-semibold text-slate-700">{currentFeeder}</span> · Capacity: 50.0 kW
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Feeder Congestion Simulator Control */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-700">Simulate Feeder Stress Level</span>
            <span
              className={`font-bold px-2 py-0.5 rounded-full ${
                simulatedStress >= 90
                  ? 'bg-rose-100 text-rose-700'
                  : simulatedStress >= 80
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {simulatedStress}% Utilization ({((50 * simulatedStress) / 100).toFixed(1)} kW)
            </span>
          </div>
          <input
            type="range"
            min="75"
            max="98"
            step="1"
            value={simulatedStress}
            onChange={(e) => setSimulatedStress(Number(e.target.value))}
            className="w-full accent-amber-500"
          />
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>75% (Caution)</span>
            <span>85% (Amber Limit)</span>
            <span>98% (Transformer Overload)</span>
          </div>
          <button
            onClick={handleRunDemandResponse}
            disabled={isRunning}
            className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold text-sm rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isRunning ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                LangGraph State Machine Cooling Feeder...
              </>
            ) : (
              <>⚡ Run Automated AI Demand Response</>
            )}
          </button>
        </div>

        {/* Results Panel */}
        {result && (
          <div className="space-y-4 animate-fade-in">
            {/* Before / After Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-center">
                <div className="text-[11px] text-rose-600 font-medium">Initial Load</div>
                <div className="text-lg font-bold text-rose-900 mt-0.5">{result.current_load_kw} kW</div>
                <div className="text-[11px] text-rose-500">{result.utilization_pct}% Overload</div>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-center">
                <div className="text-[11px] text-amber-600 font-medium">Shed Achieved</div>
                <div className="text-lg font-bold text-amber-900 mt-0.5">-{result.curtailed_kw_achieved} kW</div>
                <div className="text-[11px] text-amber-500">@ ₹{result.incentive_rate_inr_per_kwh}/kWh Rebate</div>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                <div className="text-[11px] text-emerald-600 font-medium">Post-DR Load</div>
                <div className="text-lg font-bold text-emerald-900 mt-0.5">{result.post_dr_load_kw} kW</div>
                <div className="text-[11px] text-emerald-600 font-semibold">{result.post_dr_utilization_pct}% Safe Zone</div>
              </div>
            </div>

            {/* Summary Message */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed font-medium">
              ✅ {result.summary}
            </div>

            {/* Flexible Assets Involved */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider">
                Automated Load Shedding Dispatch:
              </h4>
              <div className="space-y-2">
                {result.flexible_loads.map((asset, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs flex items-center justify-between transition ${
                      asset.curtailed
                        ? 'bg-emerald-50/60 border-emerald-200'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <span>{asset.consumer_name}</span>
                        <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                          {asset.load_type}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Current: {asset.current_kw} kW · Sheddable: {asset.sheddable_kw} kW
                      </div>
                    </div>
                    <div className="text-right">
                      {asset.curtailed ? (
                        <>
                          <div className="text-[11px] font-bold text-emerald-700">
                            Shed -{asset.sheddable_kw} kW
                          </div>
                          <div className="text-[10px] text-emerald-600 font-medium">
                            Earned ₹{asset.incentive_earned_inr} Rebate
                          </div>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Standby (Not needed)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Collapsible Trace */}
            <details className="text-[10px] text-slate-400 pt-2 border-t border-slate-100">
              <summary className="cursor-pointer hover:text-slate-600 font-medium">
                View LangGraph State Machine Trace ({result.trace.length} steps)
              </summary>
              <div className="mt-1 pl-2 border-l-2 border-slate-200 font-mono text-[10px] text-slate-500 space-y-0.5 max-h-36 overflow-y-auto">
                {result.trace.map((t, idx) => (
                  <div key={idx}>{t}</div>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  )
}
