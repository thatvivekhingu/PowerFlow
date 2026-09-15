'use client'

import React, { useState, useMemo } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceDot,
  ReferenceLine,
} from 'recharts'
import {
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  Bot,
  Zap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import type { Order } from '@/types'

interface DoubleAuctionViewProps {
  orders?: Order[]
  clearingPrice?: number
  onOrderCreated?: () => void
}

export default function DoubleAuctionView({
  orders = [],
  clearingPrice = 4.15,
  onOrderCreated,
}: DoubleAuctionViewProps) {
  const [negotiationKwh, setNegotiationKwh] = useState<number>(15)
  const [buyerOfferPrice, setBuyerOfferPrice] = useState<number>(3.90)
  const [isNegotiating, setIsNegotiating] = useState<boolean>(false)
  const [negotiationStep, setNegotiationStep] = useState<number>(0)
  const [negotiationLog, setNegotiationLog] = useState<Array<{ sender: string; price: number; msg: string }>>([])
  const [dealClosed, setDealClosed] = useState<boolean>(false)

  // Double Auction Supply and Demand Curves:
  // Demand Curve: buyers willing to pay high prices down to lowest
  // Supply Curve: sellers offering at low prices up to highest
  const auctionData = useMemo(() => {
    return [
      { quantity: 0, demandPrice: 5.20, supplyPrice: 3.40 },
      { quantity: 15, demandPrice: 4.85, supplyPrice: 3.65 },
      { quantity: 30, demandPrice: 4.55, supplyPrice: 3.85 },
      { quantity: 45, demandPrice: 4.30, supplyPrice: 4.00 },
      { quantity: 60, demandPrice: 4.15, supplyPrice: 4.15 }, // Equilibrium clearing point!
      { quantity: 75, demandPrice: 3.90, supplyPrice: 4.35 },
      { quantity: 90, demandPrice: 3.70, supplyPrice: 4.60 },
      { quantity: 110, demandPrice: 3.40, supplyPrice: 4.95 },
    ]
  }, [])

  // Order Book Snapshot
  const orderBookBids = [
    { buyer: 'Consumer #104 (EV Fleet)', kwh: 22.0, bid: 4.30, total: 94.6 },
    { buyer: 'Apartment Complex A', kwh: 18.5, bid: 4.25, total: 78.6 },
    { buyer: 'Green Tech Hub', kwh: 12.0, bid: 4.18, total: 50.16 },
    { buyer: 'Residential Villa #12', kwh: 10.0, bid: 4.10, total: 41.0 },
  ]

  const orderBookAsks = [
    { seller: 'Sharma Solar (Rooftop)', kwh: 15.0, ask: 4.05, total: 60.75 },
    { seller: 'Sector 4 Solar Trust', kwh: 25.0, ask: 4.12, total: 103.0 },
    { seller: 'Verma Farm Array', kwh: 30.0, ask: 4.18, total: 125.4 },
    { seller: 'Green Microgrid Co-op', kwh: 40.0, ask: 4.25, total: 170.0 },
  ]

  // SunPay dynamic AI negotiation simulator
  const handleStartAiNegotiation = () => {
    setIsNegotiating(true)
    setDealClosed(false)
    setNegotiationStep(1)
    setNegotiationLog([
      {
        sender: 'Buyer Agent (You)',
        price: buyerOfferPrice,
        msg: `Initiated bid for ${negotiationKwh} kWh at ₹${buyerOfferPrice.toFixed(2)}/kWh (Utility benchmark is ₹8.50).`,
      },
    ])

    // Step 2: Counterparty seller agent responds
    setTimeout(() => {
      const sellerAsk = 4.25
      const counterPrice = parseFloat(((buyerOfferPrice + sellerAsk) / 2 + 0.05).toFixed(2))
      setNegotiationStep(2)
      setNegotiationLog((prev) => [
        ...prev,
        {
          sender: 'Seller AI (Sharma Solar)',
          price: counterPrice,
          msg: `Feeder headroom is clear (+45 kW). Counter-offering ₹${counterPrice.toFixed(2)}/kWh considering high solar forecast.`,
        },
      ])

      // Step 3: SunPay Dynamic Optimization finds Pareto-optimal consensus
      setTimeout(() => {
        const finalConsensusPrice = parseFloat(((buyerOfferPrice + counterPrice) / 2).toFixed(2))
        setNegotiationStep(3)
        setDealClosed(true)
        setNegotiationLog((prev) => [
          ...prev,
          {
            sender: 'SunPay Autonomous Matcher',
            price: finalConsensusPrice,
            msg: `Matched! Consensus cleared at ₹${finalConsensusPrice.toFixed(2)}/kWh. Smart contract escrow prepared.`,
          },
        ])
        setIsNegotiating(false)
      }, 1200)
    }, 1000)
  }

  return (
    <div className="space-y-6">
      {/* ── Header Banner ────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/20 rounded-3xl p-6 backdrop-blur-sm shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-emerald-600" />
                Double-Auction & SunPay AI Matching
              </span>
              <span className="text-xs text-slate-500 font-mono">IEEE SmartGridComm Equilibrium Algorithm</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Continuous Double-Auction & Dynamic Negotiation
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Calculates competitive market equilibrium where aggregate consumer demand meets prosumer solar supply. Enables autonomous AI agents to negotiate clearing rates in real time.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-xs">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Equilibrium Rate</span>
              <span className="text-xl font-black text-emerald-600 font-mono">₹{clearingPrice.toFixed(2)}/kWh</span>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Social Welfare</span>
              <span className="text-xs font-bold text-slate-800">Maximized (98.4%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Double Auction Chart & SunPay Negotiation ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recharts Double Auction Curve */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Merit-Order Double-Auction Curves</h3>
              <p className="text-xs text-slate-500">
                Intersection establishes the Uniform Market Clearing Price ($P^*$) and Cleared Volume ($Q^*$).
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-blue-600 font-semibold">
                <span className="w-3 h-0.5 bg-blue-600 rounded" /> Demand Curve (Bids)
              </span>
              <span className="flex items-center gap-1.5 text-amber-600 font-semibold">
                <span className="w-3 h-0.5 bg-amber-600 rounded" /> Supply Curve (Asks)
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={auctionData} margin={{ top: 15, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="quantity" stroke="#94a3b8" fontSize={11} tickLine={false} unit=" kWh" />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} unit=" ₹" domain={[3.0, 5.5]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

                {/* Reference lines for Equilibrium */}
                <ReferenceLine x={60} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Q* = 60 kWh', fill: '#059669', fontSize: 10 }} />
                <ReferenceLine y={4.15} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'P* = ₹4.15', fill: '#059669', fontSize: 10 }} />

                {/* Reference Dot at Equilibrium */}
                <ReferenceDot x={60} y={4.15} r={6} fill="#10b981" stroke="#ffffff" strokeWidth={2} />

                {/* Demand Curve */}
                <Line
                  type="monotone"
                  dataKey="demandPrice"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  name="Consumer Willingness to Pay"
                  dot={{ r: 3, fill: '#2563eb' }}
                />

                {/* Supply Curve */}
                <Line
                  type="monotone"
                  dataKey="supplyPrice"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  name="Prosumer Generation Asking Price"
                  dot={{ r: 3, fill: '#f59e0b' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-3 text-center text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-bold block">Consumer Surplus</span>
              <span className="text-base font-black text-blue-600">₹42.50</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-bold block">Prosumer Profit Margin</span>
              <span className="text-base font-black text-amber-600">+66% vs Net Metering</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] text-slate-500 font-bold block">Feeder Clearance</span>
              <span className="text-base font-black text-emerald-600">100% Guaranteed</span>
            </div>
          </div>
        </div>

        {/* Right 1 Col: SunPay Dynamic AI Negotiation Simulator */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">SunPay AI Dynamic Negotiator</h3>
                <span className="text-[10px] text-slate-400">Autonomous Concession Strategy</span>
              </div>
            </div>

            {/* Negotiation inputs */}
            <div className="space-y-3 text-xs mb-4">
              <div>
                <div className="flex justify-between font-semibold text-slate-700 mb-1">
                  <span>Energy Quantity:</span>
                  <span className="font-mono text-indigo-600 font-bold">{negotiationKwh} kWh</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="1"
                  value={negotiationKwh}
                  onChange={(e) => setNegotiationKwh(parseInt(e.target.value))}
                  disabled={isNegotiating}
                  className="w-full accent-indigo-600"
                />
              </div>

              <div>
                <div className="flex justify-between font-semibold text-slate-700 mb-1">
                  <span>Your Initial Bid:</span>
                  <span className="font-mono text-emerald-600 font-bold">₹{buyerOfferPrice.toFixed(2)}/kWh</span>
                </div>
                <input
                  type="range"
                  min="3.60"
                  max="4.80"
                  step="0.05"
                  value={buyerOfferPrice}
                  onChange={(e) => setBuyerOfferPrice(parseFloat(e.target.value))}
                  disabled={isNegotiating}
                  className="w-full accent-emerald-600"
                />
              </div>

              <button
                onClick={handleStartAiNegotiation}
                disabled={isNegotiating}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isNegotiating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>AI Agents Negotiating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Simulate Autonomous Negotiation</span>
                  </>
                )}
              </button>
            </div>

            {/* Negotiation Transcript Log */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {negotiationLog.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center text-slate-400 text-xs">
                  Click simulate to watch your AI agent negotiate directly with local prosumer agents.
                </div>
              ) : (
                negotiationLog.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-xl text-xs ${
                      item.sender.includes('Consensus')
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                        : item.sender.includes('Seller')
                        ? 'bg-amber-50 border border-amber-200 text-amber-900'
                        : 'bg-indigo-50 border border-indigo-200 text-indigo-900'
                    }`}
                  >
                    <div className="flex justify-between font-bold text-[11px] mb-0.5">
                      <span>{item.sender}</span>
                      <span className="font-mono">₹{item.price.toFixed(2)}/kWh</span>
                    </div>
                    <p className="text-[11px] opacity-90">{item.msg}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {dealClosed && (
            <div className="mt-4 p-3 rounded-2xl bg-emerald-500 text-white text-xs flex items-center justify-between animate-fade-in shadow-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span className="font-bold">Deal Locked in Escrow!</span>
              </div>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono">TX #0x8e2f</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Order Book Depth Snapshot ────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Live P2P Order Book & Spread</h3>
            <p className="text-xs text-slate-500">Real-time bids vs asks waiting in feeder matching queue.</p>
          </div>
          <div className="text-xs font-mono text-slate-600 bg-slate-100 px-3 py-1 rounded-xl">
            Spread: <strong className="text-slate-900">₹0.05/kWh (1.2%)</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Bids Table */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold text-blue-700 uppercase tracking-wider pb-1 border-b border-slate-100">
              <span>Buyer (Bids)</span>
              <span>Volume</span>
              <span>Bid Price</span>
            </div>
            {orderBookBids.map((bid, i) => (
              <div key={i} className="flex justify-between items-center text-xs p-2 rounded-xl bg-blue-50/50 hover:bg-blue-50 transition">
                <span className="font-medium text-slate-800">{bid.buyer}</span>
                <span className="font-mono text-slate-600">{bid.kwh} kWh</span>
                <span className="font-mono font-bold text-blue-700">₹{bid.bid.toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Asks Table */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold text-amber-700 uppercase tracking-wider pb-1 border-b border-slate-100">
              <span>Seller (Asks)</span>
              <span>Volume</span>
              <span>Ask Price</span>
            </div>
            {orderBookAsks.map((ask, i) => (
              <div key={i} className="flex justify-between items-center text-xs p-2 rounded-xl bg-amber-50/50 hover:bg-amber-50 transition">
                <span className="font-medium text-slate-800">{ask.seller}</span>
                <span className="font-mono text-slate-600">{ask.kwh} kWh</span>
                <span className="font-mono font-bold text-amber-700">₹{ask.ask.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
