'use client'

import { useState, useEffect, useCallback } from 'react'
import { Zap, ShoppingCart, TrendingDown, Leaf, Activity } from 'lucide-react'
import { RadialBarChart, RadialBar, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { getOrders, getMarketPrice, setToken } from '@/lib/api'
import { useWebSocket } from '@/lib/websocket'
import type { Order, MarketPrice } from '@/types'

const RETAIL_BASELINE = 9.0 // ₹/kWh

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN: 'status-open', MATCHED: 'status-matched', SETTLED: 'status-settled',
    CANCELLED: 'status-rejected', EXPIRED: 'status-rejected',
  }
  return <span className={map[status] || 'status-open'}>{status.replace('_', ' ')}</span>
}

export default function ConsumerDashboard() {
  const [price, setPrice] = useState<MarketPrice | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [feederId, setFeederId] = useState('FEEDER-01')

  useEffect(() => {
    const t = localStorage.getItem('gridmind_token')
    const f = localStorage.getItem('gridmind_feeder')
    if (t) setToken(t)
    if (f) setFeederId(f)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const [p, o] = await Promise.all([
        getMarketPrice(feederId),
        getOrders('OPEN'),
      ])
      setPrice(p)
      setOrders(o.filter(x => x.side === 'buy'))
    } catch (e) {
      console.error(e)
    }
  }, [feederId])

  useEffect(() => { fetchData() }, [fetchData])

  useWebSocket({
    onSpecificEvent: {
      price_update: (data) => {
        const d = data as { feeder_id: string; price: number }
        if (d.feeder_id === feederId) {
          setPrice(prev => prev ? { ...prev, price: d.price } : prev)
        }
      },
      order_matched: () => fetchData(),
    },
  })

  // KPI calculations
  const currentPrice = price?.price ?? RETAIL_BASELINE
  const savings_pct = Math.max(0, ((RETAIL_BASELINE - currentPrice) / RETAIL_BASELINE) * 100)
  const renewable_pct = Math.min(100, 75 + price?.supply_index! * 25) // mock: grows with surplus
  const activeOrder = orders[0]
  const expectedCost = activeOrder
    ? activeOrder.quantity_kwh * currentPrice
    : 0

  const priceCompData = [
    { name: 'P2P Price', value: currentPrice, fill: '#22c55e' },
    { name: 'Retail', value: RETAIL_BASELINE, fill: '#334155' },
  ]

  const renewableData = [
    { name: 'Renewable', value: renewable_pct, fill: '#22c55e' },
    { name: 'Remainder', value: 100 - renewable_pct, fill: '#1e293b' },
  ]

  return (
    <div className="min-h-screen p-6" style={{ background: 'radial-gradient(ellipse at top right, #051221 0%, #0a0f1e 50%)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
            <Zap className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Consumer Dashboard</h1>
            <p className="text-slate-500 text-sm">P2P energy procurement & savings</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <span className="text-xs text-green-400 font-medium">{feederId}</span>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="kpi-card">
          <div className="kpi-label flex items-center gap-2"><Activity className="w-3.5 h-3.5 text-blue-400" />P2P Price</div>
          <div className="kpi-value price-ticker text-blue-400">₹{currentPrice.toFixed(2)}</div>
          <div className="text-xs text-slate-600">per kWh</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label flex items-center gap-2"><TrendingDown className="w-3.5 h-3.5 text-green-400" />Savings</div>
          <div className="kpi-value text-green-400">{savings_pct.toFixed(1)}%</div>
          <div className="text-xs text-slate-600">vs ₹{RETAIL_BASELINE}/kWh retail</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label flex items-center gap-2"><ShoppingCart className="w-3.5 h-3.5 text-amber-400" />Expected Cost</div>
          <div className="kpi-value text-amber-400">₹{expectedCost.toFixed(0)}</div>
          <div className="text-xs text-slate-600">{activeOrder ? `${activeOrder.quantity_kwh} kWh` : 'no active order'}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label flex items-center gap-2"><Leaf className="w-3.5 h-3.5 text-emerald-400" />Renewable %</div>
          <div className="kpi-value text-emerald-400">{renewable_pct.toFixed(0)}%</div>
          <div className="text-xs text-slate-600">of your consumption</div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Price comparison */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">P2P vs Retail Price (₹/kWh)</h2>
          <div className="flex items-center gap-8">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie
                  data={priceCompData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                >
                  {priceCompData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => [`₹${Number(v).toFixed(2)}/kWh`]}
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-4">
              <div>
                <div className="text-3xl font-bold text-green-400 price-ticker">₹{currentPrice.toFixed(2)}</div>
                <div className="text-xs text-slate-500">P2P market price</div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-slate-500 price-ticker">₹{RETAIL_BASELINE.toFixed(2)}</div>
                <div className="text-xs text-slate-600">Retail baseline</div>
              </div>
              <div className="text-sm font-semibold text-green-400">
                Save ₹{(RETAIL_BASELINE - currentPrice).toFixed(2)} per kWh
              </div>
            </div>
          </div>
        </div>

        {/* Renewable allocation */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Renewable Allocation</h2>
          <div className="flex items-center gap-8">
            <div className="relative w-36 h-36">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={renewableData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {renewableData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-emerald-400">{renewable_pct.toFixed(0)}%</span>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="text-slate-400">Rooftop Solar (P2P)</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-slate-700" />
                <span className="text-slate-500">Grid / Non-renewable</span>
              </div>
              <div className="mt-2 text-xs text-slate-600">
                {renewable_pct >= 80
                  ? '🌿 Excellent renewable mix'
                  : renewable_pct >= 50
                  ? '⚡ Good renewable mix'
                  : '⚠️ Low renewable allocation'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active buy orders */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-blue-400" />My Buy Orders
          </h2>
          <span className="text-xs text-slate-600">{orders.length} orders</span>
        </div>
        {orders.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-8">No active buy orders</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th><th>Qty (kWh)</th><th>Filled</th>
                <th>Max Price</th><th>Expected Cost</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.order_id}>
                  <td className="font-mono text-xs text-slate-500">{o.order_id.slice(0, 8)}…</td>
                  <td>{o.quantity_kwh.toFixed(2)}</td>
                  <td className="text-blue-400">{o.filled_kwh.toFixed(2)}</td>
                  <td>₹{o.max_price ?? '—'}</td>
                  <td className="text-amber-400">₹{(o.quantity_kwh * currentPrice).toFixed(2)}</td>
                  <td><StatusChip status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
