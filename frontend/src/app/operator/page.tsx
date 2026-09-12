'use client'

import { useState, useEffect, useCallback } from 'react'
import { Building2, AlertTriangle, CheckCircle, XCircle, BarChart2, Zap } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts'
import { getTrades, getAllFeeders, getDashboardSummary, settleTrade, setToken } from '@/lib/api'
import { useWebSocket } from '@/lib/websocket'
import type { Trade, GridState, DashboardSummary } from '@/types'

function TradeStatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN: 'status-open', MATCHED: 'status-matched', SETTLED: 'status-settled',
    REJECTED: 'status-rejected', GRID_LIMITED: 'status-limited', UTILITY_EXPORT: 'status-export',
  }
  return <span className={map[status] || 'status-open'}>{status.replace('_', ' ')}</span>
}

function CongestionBar({ load, capacity, band }: { load: number; capacity: number; band: string }) {
  const pct = Math.min(100, (load / capacity) * 100)
  const color = band === 'GREEN' ? '#22c55e' : band === 'AMBER' ? '#fbbf24' : '#f87171'
  return (
    <div className="space-y-1.5">
      <div className="feeder-bar-bg">
        <div
          className="feeder-bar-fill"
          style={{ width: `${pct}%`, background: color, transition: 'width 0.7s ease' }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-600">
        <span>{load.toFixed(1)} kW</span>
        <span className={band === 'RED' ? 'text-red-400' : band === 'AMBER' ? 'text-amber-400' : 'text-green-400'}>
          {pct.toFixed(0)}%
        </span>
        <span>{capacity.toFixed(0)} kW cap</span>
      </div>
    </div>
  )
}

function KpiGauge({ label, value, suffix, color }: { label: string; value: number; suffix: string; color: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value ${color}`}>{value.toFixed(1)}{suffix}</div>
    </div>
  )
}

export default function OperatorDashboard() {
  const [feeders, setFeeders] = useState<GridState[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [alerts, setAlerts] = useState<string[]>([])
  const [settling, setSettling] = useState<string | null>(null)

  useEffect(() => {
    const t = localStorage.getItem('gridmind_token')
    if (t) setToken(t)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const [f, t, s] = await Promise.all([
        getAllFeeders(),
        getTrades(undefined, undefined),
        getDashboardSummary(),
      ])
      setFeeders(f)
      setTrades(t.slice(0, 20))
      setSummary(s)
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useWebSocket({
    onSpecificEvent: {
      grid_alert: (data) => {
        const d = data as { feeder_id: string; band: string; headroom_kw: number }
        const msg = `⚠️ ${d.feeder_id}: ${d.band} congestion — headroom ${d.headroom_kw.toFixed(1)} kW`
        setAlerts(prev => [msg, ...prev].slice(0, 10))
        fetchData()
      },
      order_matched: () => fetchData(),
      settlement_complete: () => fetchData(),
      price_update: () => fetchData(),
    },
  })

  const handleSettle = async (tradeId: string) => {
    setSettling(tradeId)
    try {
      await settleTrade(tradeId)
      await fetchData()
    } catch (e) {
      console.error(e)
    } finally {
      setSettling(null)
    }
  }

  // Chart data: feeder loads
  const feederBarData = feeders.map(f => ({
    name: f.feeder_id,
    load: f.load_kw,
    headroom: f.headroom_kw,
    capacity: f.capacity_kw,
  }))

  // Trade status distribution
  const statusCounts = trades.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="min-h-screen p-6" style={{ background: 'radial-gradient(ellipse at bottom right, #051a0d 0%, #0a0f1e 60%)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">DISCOM Operator Dashboard</h1>
            <p className="text-slate-500 text-sm">Grid health · Trades · Settlement</p>
          </div>
        </div>
        <button onClick={fetchData} className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-3 py-1.5 rounded-lg border border-white/5 hover:border-white/10">
          Refresh ↻
        </button>
      </div>

      {/* 6 KPIs */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
          <KpiGauge label="Revenue Uplift" value={summary.prosumer_revenue_uplift_inr} suffix=" ₹" color="text-green-400" />
          <KpiGauge label="Consumer Savings" value={summary.consumer_savings_inr} suffix=" ₹" color="text-blue-400" />
          <KpiGauge label="Local Match Rate" value={summary.local_matching_rate * 100} suffix="%" color="text-emerald-400" />
          <KpiGauge label="Grid Utilization" value={summary.grid_utilization_pct} suffix="%" color={summary.grid_utilization_pct > 90 ? 'text-red-400' : summary.grid_utilization_pct > 70 ? 'text-amber-400' : 'text-green-400'} />
          <KpiGauge label="Unmatched Energy" value={summary.unmatched_energy_rate * 100} suffix="%" color="text-slate-400" />
          <KpiGauge label="Settlement Rate" value={summary.settlement_success_rate * 100} suffix="%" color="text-emerald-400" />
        </div>
      )}

      {/* Trade stats */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Trades', value: summary.total_trades, color: 'text-slate-300' },
            { label: 'Settled', value: summary.settled_trades, color: 'text-emerald-400' },
            { label: 'Rejected', value: summary.rejected_trades, color: 'text-red-400' },
            { label: 'Utility Export', value: summary.utility_export_trades, color: 'text-purple-400' },
          ].map(item => (
            <div key={item.label} className="card flex justify-between items-center">
              <span className="text-xs text-slate-500">{item.label}</span>
              <span className={`text-2xl font-bold ${item.color}`}>{item.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Feeder loading + alerts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Feeder bars */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-green-400" />Feeder Loading
          </h2>
          {feeders.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-4">No feeder data yet — run simulator</p>
          ) : (
            <div className="space-y-5">
              {feeders.map(f => (
                <div key={f.feeder_id}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-slate-300">{f.feeder_id}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">{f.transformer_id}</span>
                      <span className={`status-chip text-xs ${
                        f.congestion_band === 'GREEN' ? 'bg-green-500/15 text-green-400' :
                        f.congestion_band === 'AMBER' ? 'bg-amber-500/15 text-amber-400' :
                        'bg-red-500/15 text-red-400'
                      }`}>
                        {f.congestion_band}
                      </span>
                    </div>
                  </div>
                  <CongestionBar load={f.load_kw} capacity={f.capacity_kw} band={f.congestion_band} />
                  <div className="text-xs text-slate-600 mt-1">Headroom: {f.headroom_kw.toFixed(1)} kW</div>
                </div>
              ))}
            </div>
          )}

          {/* Bar chart of feeder loads */}
          {feederBarData.length > 0 && (
            <div className="mt-6">
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={feederBarData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }}
                    formatter={(v, name) => [`${Number(v).toFixed(1)} kW`, name]}
                  />
                  <Bar dataKey="load" fill="#22c55e" opacity={0.8} radius={[4, 4, 0, 0]} name="Load" />
                  <Bar dataKey="headroom" fill="#1e293b" radius={[4, 4, 0, 0]} name="Headroom" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Alerts feed */}
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />Congestion Alerts
          </h2>
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-green-400 py-4">
              <CheckCircle className="w-4 h-4" />
              All feeders nominal — no congestion alerts
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {alerts.map((a, i) => (
                <div key={i} className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  {a}
                </div>
              ))}
            </div>
          )}

          {/* Current prices */}
          {summary && Object.keys(summary.current_price_inr).length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs text-slate-500 font-semibold mb-3">Current Market Prices</h3>
              <div className="space-y-2">
                {Object.entries(summary.current_price_inr).map(([fid, p]) => (
                  <div key={fid} className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">{fid}</span>
                    <span className="price-ticker text-green-400 font-semibold">₹{p.toFixed(2)}/kWh</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Trades table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <Zap className="w-4 h-4 text-green-400" />Recent Trades
          </h2>
          <span className="text-xs text-slate-600">{trades.length} shown</span>
        </div>
        {trades.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-8">No trades yet — run the demo scenario</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Trade ID</th><th>Feeder</th><th>Qty (kWh)</th>
                  <th>Allowed</th><th>Price</th><th>Status</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {trades.map(t => (
                  <tr key={t.trade_id}>
                    <td className="font-mono text-xs text-slate-500">{t.trade_id.slice(0, 8)}…</td>
                    <td className="text-slate-400">{t.feeder_id}</td>
                    <td>{t.quantity_kwh.toFixed(2)}</td>
                    <td className={t.allowed_kwh && t.allowed_kwh < t.quantity_kwh ? 'text-amber-400' : 'text-slate-400'}>
                      {t.allowed_kwh?.toFixed(2) ?? '—'}
                    </td>
                    <td className="price-ticker">₹{t.clearing_price.toFixed(2)}</td>
                    <td><TradeStatusChip status={t.status} /></td>
                    <td>
                      {(t.status === 'MATCHED' || t.status === 'GRID_LIMITED') && (
                        <button
                          onClick={() => handleSettle(t.trade_id)}
                          disabled={settling === t.trade_id}
                          className="text-xs bg-green-500/15 text-green-400 border border-green-500/30 px-2 py-1 rounded-lg hover:bg-green-500/25 transition-colors disabled:opacity-50"
                        >
                          {settling === t.trade_id ? 'Settling…' : 'Settle'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
