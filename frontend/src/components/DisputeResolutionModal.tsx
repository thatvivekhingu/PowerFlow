'use client'

import React, { useState } from 'react'
import { resolveDispute, DisputeResolutionResult } from '@/lib/api'

interface DisputeResolutionModalProps {
  isOpen: boolean
  onClose: () => void
  tradeId?: string
  initialContractedKwh?: number
  initialPricePerKwh?: number
}

export default function DisputeResolutionModal({
  isOpen,
  onClose,
  tradeId = 'TR-DEMO-001',
  initialContractedKwh = 10.0,
  initialPricePerKwh = 5.40,
}: DisputeResolutionModalProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [contractedKwh, setContractedKwh] = useState(initialContractedKwh)
  const [actualKwh, setActualKwh] = useState(round(initialContractedKwh * 0.72, 1))
  const [pricePerKwh] = useState(initialPricePerKwh)
  const [result, setResult] = useState<DisputeResolutionResult | null>(null)

  function round(val: number, decimals: number) {
    return Number(Math.round(Number(val + 'e' + decimals)) + 'e-' + decimals)
  }

  if (!isOpen) return null

  const handleResolve = async () => {
    setIsRunning(true)
    try {
      const data = await resolveDispute(tradeId, contractedKwh, pricePerKwh, actualKwh)
      setResult(data)
    } catch (err: any) {
      alert(`Oracle reconciliation failed: ${err.message}`)
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
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center text-xl font-bold">
              ⚖️
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                Smart Meter Oracle & Delivery Reconciliation
                <span className="text-xs bg-indigo-100 text-indigo-800 font-semibold px-2 py-0.5 rounded-full">
                  LangGraph
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Trade ID: <span className="font-mono font-semibold text-slate-700">{tradeId}</span> · Rate: ₹{pricePerKwh}/kWh
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

        {/* Oracle Simulation Inputs */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
          <div className="text-xs font-semibold text-slate-700">
            Compare Contracted Trade vs. Physical Meter Telemetry
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="text-slate-500 block mb-1">Contracted Volume</label>
              <div className="px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800">
                {contractedKwh} kWh
              </div>
            </div>
            <div>
              <label className="text-slate-500 block mb-1">Actual Smart Meter Export</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max={contractedKwh}
                value={actualKwh}
                onChange={(e) => setActualKwh(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1">
            <span>Discrepancy: {round(contractedKwh - actualKwh, 1)} kWh shortfall</span>
            <span className="text-indigo-600 font-medium">
              Solar Drop: {round(((contractedKwh - actualKwh) / contractedKwh) * 100, 0)}%
            </span>
          </div>

          <button
            onClick={handleResolve}
            disabled={isRunning}
            className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-semibold text-sm rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isRunning ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Reconciling Telemetry & Prorating Settlement...
              </>
            ) : (
              <>⚖️ Run Automated Oracle Reconciliation</>
            )}
          </button>
        </div>

        {/* Reconciled Output */}
        {result && (
          <div className="space-y-4 animate-fade-in">
            {/* Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                <div className="text-[11px] text-emerald-600 font-medium">Seller Payout</div>
                <div className="text-lg font-bold text-emerald-900 mt-0.5">₹{result.adjusted_seller_credit}</div>
                <div className="text-[10px] text-emerald-500 line-through">was ₹{result.original_seller_credit}</div>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-center">
                <div className="text-[11px] text-blue-600 font-medium">Buyer Refund</div>
                <div className="text-lg font-bold text-blue-900 mt-0.5">+₹{result.adjusted_buyer_refund}</div>
                <div className="text-[10px] text-blue-500">Auto-credited to wallet</div>
              </div>
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl text-center">
                <div className="text-[11px] text-indigo-600 font-medium">DISCOM Wheeling</div>
                <div className="text-lg font-bold text-indigo-900 mt-0.5">₹{result.adjusted_discom_fee}</div>
                <div className="text-[10px] text-indigo-500 line-through">was ₹{result.original_discom_fee}</div>
              </div>
            </div>

            {/* Summary */}
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 leading-relaxed font-medium">
              ✅ {result.resolution_summary}
            </div>

            {/* Cryptographic SHA-256 Receipt */}
            <div className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs space-y-1">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider flex justify-between items-center">
                <span>Cryptographic SHA-256 On-Chain Audit Hash</span>
                <span className="text-emerald-400 font-semibold">VERIFIED</span>
              </div>
              <div className="text-[11px] text-emerald-400 break-all">{result.audit_hash}</div>
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
