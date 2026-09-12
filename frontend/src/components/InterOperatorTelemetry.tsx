'use client'

import React, { useState, useEffect } from 'react'
import {
  ShieldCheck,
  Radio,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Cable,
  RefreshCw,
  Clock,
  Layers
} from 'lucide-react'
import {
  triggerInterOperatorHandshake,
  InterOperatorHandshakeResult
} from '@/lib/api'

interface InterOperatorTelemetryProps {
  buyerFeeder: string
  sellerFeeder: string
  quantityKwh: number
  buyerMaxPrice?: number
  sellerMinPrice?: number
  onHandshakeComplete?: (result: InterOperatorHandshakeResult) => void
  compact?: boolean
}

export default function InterOperatorTelemetry({
  buyerFeeder,
  sellerFeeder,
  quantityKwh,
  buyerMaxPrice = 5.0,
  sellerMinPrice = 4.2,
  onHandshakeComplete,
  compact = false,
}: InterOperatorTelemetryProps) {
  const [loading, setLoading] = useState(false)
  const [handshake, setHandshake] = useState<InterOperatorHandshakeResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isCrossOperator = buyerFeeder !== sellerFeeder

  const runHandshake = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await triggerInterOperatorHandshake(
        buyerFeeder,
        sellerFeeder,
        quantityKwh,
        buyerMaxPrice,
        sellerMinPrice
      )
      setHandshake(res)
      if (onHandshakeComplete) onHandshakeComplete(res)
    } catch (err: any) {
      setError(err.message || 'Inter-operator handshake communication failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    runHandshake()
  }, [buyerFeeder, sellerFeeder, quantityKwh])

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-2xl flex items-center justify-center ${
            isCrossOperator ? 'bg-indigo-50 text-indigo-600 border border-indigo-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
          }`}>
            <ArrowRightLeft className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
              {isCrossOperator ? 'Dual-Operator Inter-Feeder Handshake' : 'Single-Operator Feeder Clearance'}
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                isCrossOperator ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {isCrossOperator ? 'CROSS-DISCOM TRANSIT' : 'LOCAL INTRA-FEEDER'}
              </span>
            </h4>
            <p className="text-[11px] text-slate-500">
              {isCrossOperator
                ? 'Automated machine-to-machine protocol verifying export headroom & 33kV tie-line transmission.'
                : 'Direct local substation clearing. Zero direct peer risk; grid operator is median intermediary.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={runHandshake}
          disabled={loading}
          className="self-start sm:self-auto px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          <span>Re-verify Link</span>
        </button>
      </div>

      {/* Tripartite Mediation & Tie-Line Visual Architecture */}
      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center text-center">
          {/* Buyer Operator Substation */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[9px] font-bold text-indigo-700 uppercase tracking-wider block">Buyer Grid Operator</span>
            <span className="text-xs font-black text-slate-900 block mt-0.5">
              {handshake ? handshake.buyer_operator.operator_name.split('(')[0] : buyerFeeder}
            </span>
            <span className="text-[10px] font-mono text-slate-500 block">
              Node: {buyerFeeder} • Substation Beta
            </span>
            <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-1.5">
              <CheckCircle2 className="w-2.5 h-2.5" /> Headroom OK
            </span>
          </div>

          {/* Central Interconnect / Tie-Line Median Hub */}
          <div className="flex flex-col items-center justify-center p-2">
            <div className="flex items-center gap-1 text-slate-400 w-full justify-center">
              <span className="h-px bg-slate-300 flex-1" />
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-xs">
                {isCrossOperator ? <Cable className="w-4 h-4 text-amber-400" /> : <ShieldCheck className="w-4 h-4 text-emerald-400" />}
              </div>
              <span className="h-px bg-slate-300 flex-1" />
            </div>
            <span className="text-[10px] font-bold text-slate-800 mt-1">
              {isCrossOperator ? '33kV Trunk Tie-Line Link' : 'Local Feeder Bus (415V)'}
            </span>
            <span className="text-[9px] font-mono text-slate-500">
              {isCrossOperator ? 'Length: 4.2 km • Transmit Loss: 1.4%' : 'Length: 0.85 km • Loss: 0.8%'}
            </span>
            <span className="text-[10px] font-mono font-bold text-emerald-700 mt-0.5">
              Median Clearing: ₹{handshake ? handshake.median_clearing_price.toFixed(2) : ((buyerMaxPrice + sellerMinPrice) / 2).toFixed(2)}/kWh
            </span>
          </div>

          {/* Seller Operator Substation */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
            <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider block">Seller Grid Operator</span>
            <span className="text-xs font-black text-slate-900 block mt-0.5">
              {handshake ? handshake.seller_operator.operator_name.split('(')[0] : sellerFeeder}
            </span>
            <span className="text-[10px] font-mono text-slate-500 block">
              Node: {sellerFeeder} • Substation Alpha
            </span>
            <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-1.5">
              <CheckCircle2 className="w-2.5 h-2.5" /> Surplus Certified
            </span>
          </div>
        </div>

        {/* Median Intermediary Notice */}
        <div className="p-2.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between text-xs text-indigo-950">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-[11px] leading-tight">
              <strong>Regulated Zero Direct Peer Dealing:</strong> Both parties transact solely with their respective Substation Grid Operators at the established median rate. Operators guarantee physical frequency & financial settlement.
            </span>
          </div>
          <span className="text-[10px] font-bold font-mono text-indigo-800 bg-white px-2 py-0.5 rounded-md border border-indigo-200 shrink-0">
            Wheeling: ₹{handshake?.wheeling_charge_per_kwh?.toFixed(3) || '0.020'}/kWh
          </span>
        </div>
      </div>

      {/* Protocol Step-by-Step Handshake Log */}
      {handshake && (
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-indigo-600 animate-pulse" />
            Inter-Operator Handshake Execution Log ({handshake.steps.length} Phases Verified):
          </span>
          <div className="space-y-1.5">
            {handshake.steps.map((step) => (
              <div
                key={step.step_num}
                className="flex items-start gap-2 p-2.5 rounded-xl bg-white border border-slate-100 text-[11px]"
              >
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  ✓
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{step.title}</span>
                    <span className="text-[9px] font-mono text-slate-400">
                      Phase {step.step_num}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[10px] mt-0.5 leading-normal">
                    {step.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Cryptographic Clearance Token */}
          {handshake.clearance_token && (
            <div className="p-2.5 rounded-xl bg-slate-900 text-white font-mono text-[10px] flex items-center justify-between">
              <span className="text-slate-400">Inter-Operator Clearance Token:</span>
              <span className="text-emerald-400 font-bold">{handshake.clearance_token}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
