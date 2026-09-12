'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sun, Zap, TrendingUp, Package, DollarSign, Activity } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import { getOrders, getMarketPrice, getMeterReadings, setToken } from '@/lib/api'
import { useWebSocket } from '@/lib/websocket'
import type { Order, MarketPrice, MeterReading } from '@/types'

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN: 'status-open', PARTIALLY_FILLED: 'status-open',
    MATCHED: 'status-matched', SETTLED: 'status-settled',
    CANCELLED: 'status-rejected', EXPIRED: 'status-rejected',
  }
  return <span className={map[status] || 'status-open'}>{status.replace('_', ' ')}</span>
}

export default function ProsumerDashboard() {
  const [price, setPrice] = useState<MarketPrice | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [readings, setReadings] = useState<MeterReading[]>([])
  const [feederId, setFeederId] = useState('FEEDER-01')

  // Restore token from localStorage on mount
  useEffect(() => {
    const t = localStorage.getItem('gridmind_token')
    const f = localStorage.getItem('gridmind_feeder')
    if (t) setToken(t)
    if (f) setFeederId(f)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const [p, o, r] = await Promise.all([
        getMarketPrice(feederId),
        getOrders('OPEN'),
        getMeterReadings('METER-DEMO-P01'),
      ])
      setPrice(p)
      setOrders(o)
      setReadings(r.slice(0, 32).reverse()) // last 8h, oldest first for chart
    } catch (e) {
      console.error(e)
    }
  }, [feederId])

  useEffect(() => { fetchData() }, [fetchData])

  useWebSocket({
    onSpecificEvent: {
      price_update: (data) => {
        if ((data as { feeder_id: string }).feeder_id === feederId) {
          setPrice(prev => prev ? { ...prev, price: (data as { price: number }).price } : prev)
        }
      },
      order_matched: () => fetchData(),
      settlement_complete: () => fetchData(),
    },
  })

  // Compute KPIs
  const totalGeneration = readings.reduce((s, r) => s + r.generation_kwh, 0)
  const totalConsumption = readings.reduce((s, r) => s + r.consumption_kwh, 0)
  const totalSurplus = readings.reduce((s, r) => s + r.surplus_kwh, 0)
  const settledOrders = orders.filter(o => o.status === 'SETTLED')
  const p2pRevenue = settledOrders.reduce((s, o) => s + o.filled_kwh * (price?.price || 0), 0)
  const baselineRevenue = totalSurplus * 2.5 // ₹2.5 utility export rate

  const chartData = readings.map(r => ({
    time: new Date(r.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    generation: +(r.generation_kwh * 4).toFixed(2), // convert to kW
    consumption: +(r.consumption_kwh * 4).toFixed(2),
    surplus: +(r.surplus_kwh * 4).toFixed(2),
  }))

  return (
    <div className="min-h-screen p-6" style={{ background: 'radial-gradient(ellipse at top left, #1a1205 0%, #0a0f1e 50%)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <Sun className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Prosumer Dashboard</h1>
            <p className="text-slate-500 text-sm">Solar generation &amp; P2P trading overview</p>
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
          <div className="flex items-center gap-2 kpi-label"><Sun className="w-3.5 h-3.5 text-amber-400" />Generation</div>
          <div className="kpi-value gradient-solar">{totalGeneration.toFixed(2)}</div>
          <div className="text-xs text-slate-600">kWh (last 8h)</div>
        </div>
        <div className="kpi-card">
          <div className="flex items-center gap-2 kpi-label"><Zap className="w-3.5 h-3.5 text-blue-400" />Consumption</div>
          <div className="kpi-value text-blue-400">{totalConsumption.toFixed(2)}</div>
          <div className="text-xs text-slate-600">kWh (last 8h)</div>
        </div>
        <div className="kpi-card">
          <div className="flex items-center gap-2 kpi-label"><Package className="w-3.5 h-3.5 text-green-400" />Net Surplus</div>
          <div className="kpi-value text-green-400">{totalSurplus.toFixed(2)}</div>
          <div className="text-xs text-slate-600">kWh available</div>
        </div>
        <div className="kpi-card">
          <div className="flex items-center gap-2 kpi-label"><DollarSign className="w-3.5 h-3.5 text-emerald-400" />Revenue Uplift</div>
          <div className="kpi-value text-emerald-400">₹{(p2pRevenue - baselineRevenue).toFixed(0)}</div>
          <div className="text-xs text-slate-600">vs utility export</div>
        </div>
      </div>

      {/* Price ticker + chart row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Current price card */}
        <div className="card-glow flex flex-col justify-between">
          <div className="kpi-label mb-2 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-green-400" />Current Market Price
          </div>
          <div className="price-ticker text-5xl font-bold text-green-400 my-4">
            ₹{price?.price?.toFixed(2) ?? '—'}
          </div>
          <div className="text-sm text-slate-500">per kWh</div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-slate-600">
            <div><div className="text-slate-400 font-medium">{price?.demand_index?.toFixed(2) ?? '—'}</div>Demand Idx</div>
            <div><div className="text-slate-400 font-medium">{price?.supply_index?.toFixed(2) ?? '—'}</div>Supply Idx</div>
            <div><div className="text-slate-400 font-medium">+{price?.c_congestion?.toFixed(2) ?? '—'}</div>Congestion</div>
          </div>
        </div>

        {/* Generation chart */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300">Generation vs Consumption (kW)</h2>
            <span className="text-xs text-slate-600">Last 8 hours</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="genGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="conGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="surGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#475569' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
              <Area type="monotone" dataKey="generation" stroke="#fbbf24" fill="url(#genGrad)" strokeWidth={2} name="Generation" />
              <Area type="monotone" dataKey="consumption" stroke="#60a5fa" fill="url(#conGrad)" strokeWidth={2} name="Consumption" />
              <Area type="monotone" dataKey="surplus" stroke="#34d399" fill="url(#surGrad)" strokeWidth={1.5} name="Surplus" strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Active orders table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-400" />Active Orders
          </h2>
          <span className="text-xs text-slate-600">{orders.length} orders</span>
        </div>
        {orders.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-8">No open sell orders</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th><th>Side</th><th>Qty (kWh)</th>
                <th>Filled</th><th>Min Price</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.order_id}>
                  <td className="font-mono text-xs text-slate-500">{o.order_id.slice(0, 8)}…</td>
                  <td><span className={o.side === 'sell' ? 'text-amber-400' : 'text-blue-400'}>{o.side.toUpperCase()}</span></td>
                  <td>{o.quantity_kwh.toFixed(2)}</td>
                  <td className="text-green-400">{o.filled_kwh.toFixed(2)}</td>
                  <td>₹{o.min_price ?? '—'}</td>
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
