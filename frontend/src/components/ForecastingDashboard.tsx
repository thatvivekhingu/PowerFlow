'use client'

import React, { useState, useEffect } from 'react'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  Sun,
  Activity,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  Cpu,
  RefreshCw,
  Clock,
  Layers,
  CheckCircle2,
  Calendar,
  AlertCircle,
  HelpCircle,
  Zap,
} from 'lucide-react'
import {
  getCombinedForecast,
  getForecastModels,
  selectForecastModel,
  CombinedForecastResponse,
  ForecastRegistryResponse,
  ForecastPoint,
} from '@/lib/api'

interface ForecastingDashboardProps {
  currentFeeder?: string
}

export default function ForecastingDashboard({
  currentFeeder = 'FEEDER-01',
}: ForecastingDashboardProps) {
  const [selectedFeeder, setSelectedFeeder] = useState(currentFeeder)
  const [horizonHours, setHorizonHours] = useState<number>(24)
  const [chartMode, setChartMode] = useState<'balance' | 'confidence'>('balance')
  const [confidenceTarget, setConfidenceTarget] = useState<'solar' | 'demand'>('solar')

  const [loading, setLoading] = useState(true)
  const [forecastData, setForecastData] = useState<CombinedForecastResponse | null>(null)
  const [registryData, setRegistryData] = useState<ForecastRegistryResponse | null>(null)
  const [switchingModel, setSwitchingModel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [forecastRes, modelsRes] = await Promise.all([
        getCombinedForecast(selectedFeeder, horizonHours),
        getForecastModels(),
      ])
      setForecastData(forecastRes)
      setRegistryData(modelsRes)
    } catch (err: any) {
      setError(err.message || 'Failed to load forecast telemetry')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedFeeder, horizonHours])

  const handleSwitchModel = async (modelType: 'solar' | 'demand', version: string) => {
    setSwitchingModel(version)
    try {
      await selectForecastModel(modelType, version)
      await loadData()
    } catch (err: any) {
      alert(`Model switch failed: ${err.message}`)
    } finally {
      setSwitchingModel(null)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in text-slate-900">
      {/* ── HEADER & CONTROL TOOLBAR ────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-200 shadow-xs">
              <Sun className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Solar Generation & Demand Forecasting Engine
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold">
                  QUANTILE P10/P50/P90
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Machine learning load & solar forecasting with probabilistic confidence intervals and active version tracking.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Feeder Selector */}
          <div className="flex items-center bg-slate-50 rounded-xl p-1 border border-slate-200 text-xs">
            {['FEEDER-01', 'FEEDER-02', 'FEEDER-03'].map((f) => (
              <button
                key={f}
                onClick={() => setSelectedFeeder(f)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  selectedFeeder === f
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Horizon Selector */}
          <div className="flex items-center bg-slate-50 rounded-xl p-1 border border-slate-200 text-xs">
            {[
              { label: '12 Hours', val: 12 },
              { label: '24 Hours', val: 24 },
              { label: '48 Hours', val: 48 },
            ].map((h) => (
              <button
                key={h.val}
                onClick={() => setHorizonHours(h.val)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                  horizonHours === h.val
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
            title="Refresh Forecast Telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── KPI METRICS CARDS ───────────────────────────────────────────────── */}
      {forecastData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Expected Solar Generation */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Day Solar Output (P50)</span>
              <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Sun className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black font-mono text-slate-900">
                {forecastData.summary.total_solar_p50_kwh.toFixed(1)}
              </span>
              <span className="text-xs font-medium text-slate-500"> kWh</span>
              <span className="text-[11px] font-mono text-emerald-700 block mt-1 font-semibold">
                Peak: {forecastData.summary.peak_solar_kw.toFixed(2)} kW @ 12:30
              </span>
            </div>
          </div>

          {/* 2. Expected Demand Load */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Day Demand Load (P50)</span>
              <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black font-mono text-slate-900">
                {forecastData.summary.total_demand_p50_kwh.toFixed(1)}
              </span>
              <span className="text-xs font-medium text-slate-500"> kWh</span>
              <span className="text-[11px] font-mono text-indigo-700 block mt-1 font-semibold">
                Peak: {forecastData.summary.peak_demand_kw.toFixed(2)} kW (Evening 20:00)
              </span>
            </div>
          </div>

          {/* 3. Net P2P Export Surplus */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Net P2P Sellable Surplus</span>
              <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black font-mono text-emerald-700">
                {forecastData.summary.total_surplus_p50_kwh.toFixed(1)}
              </span>
              <span className="text-xs font-medium text-emerald-600"> kWh</span>
              <span className="text-[11px] font-mono text-slate-500 block mt-1">
                Available for Substation P2P Clearing
              </span>
            </div>
          </div>

          {/* 4. Active ML Model Confidence */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Active Model Accuracy</span>
              <span className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black font-mono text-purple-700">
                96.2%
              </span>
              <span className="text-xs font-medium text-purple-600"> R² Score</span>
              <span className="text-[11px] font-mono text-slate-500 block mt-1">
                MAPE: {forecastData.models.solar.mape}% • {forecastData.models.solar.version}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── INTERACTIVE FORECAST GRAPHS (RECHARTS) ───────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              {chartMode === 'balance'
                ? 'Solar Generation vs. Demand Load Trajectory'
                : `Probabilistic Quantile Uncertainty (${confidenceTarget.toUpperCase()}: P10 / P50 / P90)`}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {chartMode === 'balance'
                ? `Expected ${horizonHours}-hour generation, consumption, and net export surplus curve.`
                : `Quantile spread showing 80% confidence interval band between P10 (conservative) and P90 (surge).`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {chartMode === 'confidence' && (
              <div className="flex items-center bg-slate-100 rounded-xl p-1 text-xs">
                <button
                  onClick={() => setConfidenceTarget('solar')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    confidenceTarget === 'solar' ? 'bg-white text-amber-800 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Solar P10-P90
                </button>
                <button
                  onClick={() => setConfidenceTarget('demand')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    confidenceTarget === 'demand' ? 'bg-white text-indigo-800 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Demand P10-P90
                </button>
              </div>
            )}

            <div className="flex items-center bg-slate-100 rounded-xl p-1 text-xs">
              <button
                onClick={() => setChartMode('balance')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  chartMode === 'balance' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                Energy Trajectory
              </button>
              <button
                onClick={() => setChartMode('confidence')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  chartMode === 'confidence' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                Confidence Bands
              </button>
            </div>
          </div>
        </div>

        {/* The Recharts Container */}
        {forecastData && (
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === 'balance' ? (
                <AreaChart
                  data={forecastData.forecast_points}
                  margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorSolar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorSurplus" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="hour_label"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    interval={horizonHours === 48 ? 3 : horizonHours === 24 ? 1 : 0}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    unit=" kW"
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const pt = payload[0].payload as ForecastPoint
                        return (
                          <div className="bg-slate-900 text-white text-xs p-3 rounded-2xl shadow-xl space-y-1.5 font-mono">
                            <div className="font-bold text-slate-200 border-b border-slate-700 pb-1 flex justify-between">
                              <span>Time: {pt.day_label} {pt.hour_label}</span>
                              <span className="text-amber-400">{pt.irradiance_w_m2} W/m²</span>
                            </div>
                            <div className="flex justify-between text-amber-400">
                              <span>Solar P50:</span>
                              <span className="font-bold">{pt.solar_p50_kw.toFixed(2)} kW</span>
                            </div>
                            <div className="flex justify-between text-indigo-400">
                              <span>Demand P50:</span>
                              <span className="font-bold">{pt.demand_p50_kw.toFixed(2)} kW</span>
                            </div>
                            <div className="flex justify-between text-emerald-400 pt-1 border-t border-slate-800 font-bold">
                              <span>Net Surplus:</span>
                              <span>+{pt.surplus_p50_kwh.toFixed(2)} kWh</span>
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Cloud Cover: {pt.cloud_cover_pct}%
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    formatter={(value) => <span className="text-xs font-semibold text-slate-700">{value}</span>}
                  />
                  <Area
                    type="monotone"
                    dataKey="solar_p50_kw"
                    name="Solar Generation (kW)"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorSolar)"
                  />
                  <Line
                    type="monotone"
                    dataKey="demand_p50_kw"
                    name="Demand Load (kW)"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="surplus_p50_kwh"
                    name="P2P Sellable Surplus (kWh)"
                    stroke="#10b981"
                    strokeWidth={1.5}
                    fillOpacity={1}
                    fill="url(#colorSurplus)"
                  />
                </AreaChart>
              ) : (
                <AreaChart
                  data={forecastData.forecast_points}
                  margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorQuantile" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={confidenceTarget === 'solar' ? '#f59e0b' : '#6366f1'}
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="95%"
                        stopColor={confidenceTarget === 'solar' ? '#f59e0b' : '#6366f1'}
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="hour_label"
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    interval={horizonHours === 48 ? 3 : horizonHours === 24 ? 1 : 0}
                  />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} unit=" kW" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const pt = payload[0].payload as ForecastPoint
                        const isSolar = confidenceTarget === 'solar'
                        return (
                          <div className="bg-slate-900 text-white text-xs p-3 rounded-2xl shadow-xl space-y-1 font-mono">
                            <div className="font-bold border-b border-slate-700 pb-1">
                              {pt.day_label} {pt.hour_label} — {isSolar ? 'Solar Quantiles' : 'Demand Quantiles'}
                            </div>
                            <div className="flex justify-between text-emerald-400">
                              <span>P90 (Upper Bound):</span>
                              <span className="font-bold">
                                {isSolar ? pt.solar_p90_kw.toFixed(2) : pt.demand_p90_kw.toFixed(2)} kW
                              </span>
                            </div>
                            <div className="flex justify-between text-amber-300 font-bold">
                              <span>P50 (Median Expected):</span>
                              <span>
                                {isSolar ? pt.solar_p50_kw.toFixed(2) : pt.demand_p50_kw.toFixed(2)} kW
                              </span>
                            </div>
                            <div className="flex justify-between text-rose-400">
                              <span>P10 (Lower Bound):</span>
                              <span className="font-bold">
                                {isSolar ? pt.solar_p10_kw.toFixed(2) : pt.demand_p10_kw.toFixed(2)} kW
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                              Quantile Spread: ±
                              {isSolar
                                ? ((pt.solar_p90_kw - pt.solar_p10_kw) / 2).toFixed(2)
                                : ((pt.demand_p90_kw - pt.demand_p10_kw) / 2).toFixed(2)}{' '}
                              kW
                            </div>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Legend verticalAlign="top" height={36} />
                  <Area
                    type="monotone"
                    dataKey={confidenceTarget === 'solar' ? 'solar_p90_kw' : 'demand_p90_kw'}
                    name="P90 (Upper Bound)"
                    stroke={confidenceTarget === 'solar' ? '#f59e0b' : '#6366f1'}
                    strokeDasharray="4 4"
                    fill="url(#colorQuantile)"
                  />
                  <Line
                    type="monotone"
                    dataKey={confidenceTarget === 'solar' ? 'solar_p50_kw' : 'demand_p50_kw'}
                    name="P50 (Expected Median)"
                    stroke={confidenceTarget === 'solar' ? '#b45309' : '#4338ca'}
                    strokeWidth={3}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey={confidenceTarget === 'solar' ? 'solar_p10_kw' : 'demand_p10_kw'}
                    name="P10 (Lower Bound)"
                    stroke="#94a3b8"
                    strokeDasharray="3 3"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── MODEL & VERSION TRACKING REGISTRY ───────────────────────────────── */}
      {registryData && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-600" />
                ML Model & Version Tracking Registry
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit trail of trained models, validation metrics (MAPE, RMSE, R²), and active deployment status.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-purple-800 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
              Live Production Tracking
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SOLAR MODELS TABLE */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                Solar Generation Models ({registryData.registry.solar.length} Versions)
              </h4>
              <div className="border border-slate-100 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="p-3 font-bold">Version</th>
                      <th className="p-3 font-bold">Architecture</th>
                      <th className="p-3 font-bold">MAPE</th>
                      <th className="p-3 font-bold">R²</th>
                      <th className="p-3 text-right font-bold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {registryData.registry.solar.map((m) => (
                      <tr
                        key={m.version}
                        className={`hover:bg-slate-50/70 transition-colors ${
                          m.is_active ? 'bg-amber-50/40 font-semibold' : ''
                        }`}
                      >
                        <td className="p-3">
                          <span className="font-mono text-slate-900">{m.version}</span>
                          {m.is_active && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-500 text-white text-[9px] font-bold">
                              ACTIVE
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-[11px] text-slate-600 max-w-[150px] truncate" title={m.architecture}>
                          {m.architecture}
                        </td>
                        <td className="p-3 font-mono text-emerald-700">{m.mape}%</td>
                        <td className="p-3 font-mono text-slate-800">{m.r2_score}</td>
                        <td className="p-3 text-right">
                          {m.is_active ? (
                            <span className="text-[10px] font-bold text-emerald-700">In Production</span>
                          ) : (
                            <button
                              onClick={() => handleSwitchModel('solar', m.version)}
                              disabled={switchingModel === m.version}
                              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-emerald-600 text-white font-bold text-[10px] transition-colors cursor-pointer"
                            >
                              {switchingModel === m.version ? 'Activating...' : 'Activate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* DEMAND MODELS TABLE */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-indigo-500" />
                Demand Load Models ({registryData.registry.demand.length} Versions)
              </h4>
              <div className="border border-slate-100 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-100">
                    <tr>
                      <th className="p-3 font-bold">Version</th>
                      <th className="p-3 font-bold">Architecture</th>
                      <th className="p-3 font-bold">MAPE</th>
                      <th className="p-3 font-bold">R²</th>
                      <th className="p-3 text-right font-bold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {registryData.registry.demand.map((m) => (
                      <tr
                        key={m.version}
                        className={`hover:bg-slate-50/70 transition-colors ${
                          m.is_active ? 'bg-indigo-50/40 font-semibold' : ''
                        }`}
                      >
                        <td className="p-3">
                          <span className="font-mono text-slate-900">{m.version}</span>
                          {m.is_active && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[9px] font-bold">
                              ACTIVE
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-[11px] text-slate-600 max-w-[150px] truncate" title={m.architecture}>
                          {m.architecture}
                        </td>
                        <td className="p-3 font-mono text-emerald-700">{m.mape}%</td>
                        <td className="p-3 font-mono text-slate-800">{m.r2_score}</td>
                        <td className="p-3 text-right">
                          {m.is_active ? (
                            <span className="text-[10px] font-bold text-emerald-700">In Production</span>
                          ) : (
                            <button
                              onClick={() => handleSwitchModel('demand', m.version)}
                              disabled={switchingModel === m.version}
                              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-emerald-600 text-white font-bold text-[10px] transition-colors cursor-pointer"
                            >
                              {switchingModel === m.version ? 'Activating...' : 'Activate'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HOURLY FORECAST DATA GRID ───────────────────────────────────────── */}
      {forecastData && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              Hourly Forecast Telemetry Breakdown ({horizonHours} Interval Points)
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Feeder: {selectedFeeder} • Resolution: 1 Hour
            </span>
          </div>

          <div className="border border-slate-100 rounded-2xl overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-100 sticky top-0">
                <tr>
                  <th className="p-3 font-bold">Time Window</th>
                  <th className="p-3 font-bold">Solar (P50)</th>
                  <th className="p-3 font-bold">Solar Range (P10 - P90)</th>
                  <th className="p-3 font-bold">Demand (P50)</th>
                  <th className="p-3 font-bold">Demand Range (P10 - P90)</th>
                  <th className="p-3 font-bold">P2P Surplus</th>
                  <th className="p-3 font-bold">Irradiance</th>
                  <th className="p-3 font-bold">Cloud %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {forecastData.forecast_points.map((pt) => (
                  <tr key={pt.timestamp} className="hover:bg-slate-50/70 transition-colors text-[11px]">
                    <td className="p-3 font-bold text-slate-900">
                      {pt.day_label} {pt.hour_label}
                    </td>
                    <td className="p-3 font-bold text-amber-700">
                      {pt.solar_p50_kw.toFixed(2)} kW
                    </td>
                    <td className="p-3 text-slate-500">
                      {pt.solar_p10_kw.toFixed(2)} - {pt.solar_p90_kw.toFixed(2)} kW
                    </td>
                    <td className="p-3 font-bold text-indigo-700">
                      {pt.demand_p50_kw.toFixed(2)} kW
                    </td>
                    <td className="p-3 text-slate-500">
                      {pt.demand_p10_kw.toFixed(2)} - {pt.demand_p90_kw.toFixed(2)} kW
                    </td>
                    <td className="p-3 font-bold text-emerald-700">
                      {pt.surplus_p50_kwh > 0 ? `+${pt.surplus_p50_kwh.toFixed(2)} kWh` : '0.00 kWh'}
                    </td>
                    <td className="p-3 text-slate-600">
                      {pt.irradiance_w_m2} W/m²
                    </td>
                    <td className="p-3 text-slate-600">
                      {pt.cloud_cover_pct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
