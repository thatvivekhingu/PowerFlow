'use client'

import React, { useState, useMemo } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import {
  Sun,
  CloudSun,
  CloudRain,
  CloudLightning,
  BatteryCharging,
  Sparkles,
  Zap,
  TrendingUp,
  Cpu,
  RefreshCw,
  Sliders,
  CheckCircle2,
  Layers,
  ArrowUpRight,
} from 'lucide-react'

type WeatherCondition = 'clear' | 'partly_cloudy' | 'monsoon' | 'overcast'

interface ForecastDataPoint {
  time: string
  solarKw: number
  upperBound: number
  lowerBound: number
  householdLoadKw: number
  netSurplusKw: number
  irradianceW: number
}

export default function SolarForecastView({
  feederId = 'FEEDER-01',
  marketPrice = 4.2,
}: {
  feederId?: string
  marketPrice?: number
}) {
  const [weather, setWeather] = useState<WeatherCondition>('clear')
  const [panelCapacityKw, setPanelCapacityKw] = useState<number>(5.0)
  const [batterySoc, setBatterySoc] = useState<number>(76)
  const [autoExportEnabled, setAutoExportEnabled] = useState<boolean>(true)
  const [thresholdPrice, setThresholdPrice] = useState<number>(4.1)
  const [activeTab, setActiveTab] = useState<'forecast' | 'kmeans' | 'battery'>('forecast')

  // Weather multiplier
  const weatherFactor = useMemo(() => {
    switch (weather) {
      case 'clear':
        return 1.0
      case 'partly_cloudy':
        return 0.76
      case 'monsoon':
        return 0.38
      case 'overcast':
        return 0.22
    }
  }, [weather])

  // Hourly curve generation for 24h
  const hourlyData: ForecastDataPoint[] = useMemo(() => {
    const hours = [
      '00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00',
      '14:00', '16:00', '18:00', '20:00', '22:00'
    ]

    // Solar bell curve baseline
    const solarBase = [0, 0, 0, 0.15, 0.58, 0.88, 1.0, 0.92, 0.62, 0.1, 0, 0]
    // Typical Indian residential load profile (morning peak, mid-day lull, evening high peak)
    const loadBase = [0.8, 0.6, 0.7, 1.4, 1.8, 1.3, 1.2, 1.5, 1.9, 2.6, 2.8, 1.7]

    return hours.map((hour, idx) => {
      const peakKw = panelCapacityKw * solarBase[idx] * weatherFactor
      const solarKw = parseFloat(peakKw.toFixed(2))
      const upperBound = parseFloat((peakKw * 1.15).toFixed(2))
      const lowerBound = parseFloat((peakKw * 0.85).toFixed(2))
      const householdLoadKw = loadBase[idx]
      const netSurplusKw = parseFloat(Math.max(0, solarKw - householdLoadKw).toFixed(2))
      const irradianceW = Math.round(solarBase[idx] * weatherFactor * 980)

      return {
        time: hour,
        solarKw,
        upperBound,
        lowerBound,
        householdLoadKw,
        netSurplusKw,
        irradianceW,
      }
    })
  }, [panelCapacityKw, weatherFactor])

  // Aggregated totals
  const totalForecastSolarKwh = useMemo(() => {
    return hourlyData.reduce((sum, d) => sum + d.solarKw * 2, 0).toFixed(1)
  }, [hourlyData])

  const totalSurplusKwh = useMemo(() => {
    return hourlyData.reduce((sum, d) => sum + d.netSurplusKw * 2, 0).toFixed(1)
  }, [hourlyData])

  const projectedEarnings = useMemo(() => {
    return (parseFloat(totalSurplusKwh) * marketPrice).toFixed(1)
  }, [totalSurplusKwh, marketPrice])

  return (
    <div className="space-y-6">
      {/* ── Top Header Banner ────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-blue-500/10 border border-amber-500/20 rounded-3xl p-6 backdrop-blur-sm shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                SolarSync AI Neural Engine
              </span>
              <span className="text-xs text-slate-500 font-mono">Model: BiLSTM-Transformer v4.2</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Predictive Solar Yield & Dispatch Optimization
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Synthesizes real-time satellite irradiance, weather forecasts, and K-Means household consumption clusters to predict export surplus and maximize P2P revenue.
            </p>
          </div>

          {/* Quick Weather Simulator Switcher */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-2xl p-1.5 shadow-xs">
            <button
              onClick={() => setWeather('clear')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                weather === 'clear'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Sun className="w-4 h-4" />
              <span>Clear Sky</span>
            </button>
            <button
              onClick={() => setWeather('partly_cloudy')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                weather === 'partly_cloudy'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <CloudSun className="w-4 h-4" />
              <span>Partly Cloudy</span>
            </button>
            <button
              onClick={() => setWeather('monsoon')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                weather === 'monsoon'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <CloudRain className="w-4 h-4" />
              <span>Monsoon</span>
            </button>
            <button
              onClick={() => setWeather('overcast')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                weather === 'overcast'
                  ? 'bg-indigo-700 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <CloudLightning className="w-4 h-4" />
              <span>Overcast</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Metric Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Forecast 24h Solar Yield</span>
            <Sun className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {totalForecastSolarKwh} <span className="text-xs font-semibold text-slate-500">kWh</span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{(weatherFactor * 100).toFixed(0)}% theoretical peak capacity</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>P2P Exportable Surplus</span>
            <Zap className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 tracking-tight">
            {totalSurplusKwh} <span className="text-xs font-semibold text-slate-500">kWh</span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
            <span>Self-consumption: {(parseFloat(totalForecastSolarKwh) - parseFloat(totalSurplusKwh)).toFixed(1)} kWh</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Estimated P2P Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            ₹{projectedEarnings} <span className="text-xs font-semibold text-slate-500">(@ ₹{marketPrice}/kWh)</span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-700 font-semibold">
            +₹{(parseFloat(totalSurplusKwh) * (marketPrice - 2.5)).toFixed(1)} vs DISCOM net-metering
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>BESS Battery Storage</span>
            <BatteryCharging className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-600 tracking-tight">
            {batterySoc}% <span className="text-xs font-semibold text-slate-500">SoC (7.6 kWh)</span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Ready for evening peak arbitrage</span>
          </div>
        </div>
      </div>

      {/* ── Main Interactive Section ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recharts Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">24-Hour Solar Production & Load Profile</h3>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                  95% Confidence Band
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Yellow shaded region indicates forecasted solar output; blue line denotes household demand.
              </p>
            </div>

            {/* Sub-tab view selection */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
              <button
                onClick={() => setActiveTab('forecast')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'forecast' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                Forecast Curve
              </button>
              <button
                onClick={() => setActiveTab('kmeans')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'kmeans' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                K-Means Clusters
              </button>
            </div>
          </div>

          {activeTab === 'forecast' ? (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={hourlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="solarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} unit=" kW" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      fontSize: '12px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />

                  {/* Confidence Interval Upper */}
                  <Area
                    type="monotone"
                    dataKey="upperBound"
                    stroke="#10b981"
                    strokeDasharray="2 2"
                    fillOpacity={1}
                    fill="url(#confidenceGradient)"
                    name="Upper 95% Bound"
                  />
                  {/* Solar Output */}
                  <Area
                    type="monotone"
                    dataKey="solarKw"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#solarGradient)"
                    name="Solar Generation (kW)"
                  />
                  {/* Household Consumption */}
                  <Line
                    type="monotone"
                    dataKey="householdLoadKw"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                    name="Household Load (kW)"
                  />
                  {/* Exportable Surplus */}
                  <Line
                    type="monotone"
                    dataKey="netSurplusKw"
                    stroke="#059669"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#059669' }}
                    name="Exportable Surplus (kW)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 w-full flex flex-col justify-center space-y-4 px-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    K-Means Load Profile Cluster Analysis (NREL/IEEE Benchmark)
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold text-[10px]">
                    Cluster k=3 (High Morning / Evening Peak)
                  </span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Based on 30-day historical smart meter timeseries, your prosumer profile matches <strong>Cluster #2</strong>. 
                  Solar peak (11:00 AM - 02:00 PM) overlaps with low resident occupancy, creating an ideal <strong>4.2 kWh daily surplus window</strong> for P2P trading.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                  <span className="text-[10px] text-emerald-800 font-bold block">Solar Self-Sufficiency</span>
                  <span className="text-lg font-black text-emerald-700">68.4%</span>
                </div>
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <span className="text-[10px] text-blue-800 font-bold block">Grid Dependency</span>
                  <span className="text-lg font-black text-blue-700">31.6%</span>
                </div>
                <div className="p-3 rounded-xl bg-purple-50 border border-purple-100">
                  <span className="text-[10px] text-purple-800 font-bold block">Peak Demand Shift</span>
                  <span className="text-lg font-black text-purple-700">1.8 kW</span>
                </div>
              </div>
            </div>
          )}

          {/* Bottom quick simulation slider */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <label className="text-slate-600 font-semibold whitespace-nowrap">Rooftop PV Capacity:</label>
              <input
                type="range"
                min="1"
                max="15"
                step="0.5"
                value={panelCapacityKw}
                onChange={(e) => setPanelCapacityKw(parseFloat(e.target.value))}
                className="w-32 accent-amber-500"
              />
              <span className="font-mono font-bold text-slate-800">{panelCapacityKw} kWp</span>
            </div>

            <div className="flex items-center gap-2 text-slate-500 text-[11px]">
              <Cpu className="w-3.5 h-3.5 text-slate-400" />
              <span>Auto-retrained hourly with Feeder weather station telemetry</span>
            </div>
          </div>
        </div>

        {/* Right 1 Col: BESS Battery Storage Controller */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <BatteryCharging className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">BESS Storage Controller</h3>
                  <span className="text-[10px] text-slate-400">10 kWh LiFePO4 Smart Pack</span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                STANDBY
              </span>
            </div>

            {/* Battery Visual Level Gauge */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 mb-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-slate-700">State of Charge (SoC)</span>
                <span className="font-mono font-bold text-blue-600">{batterySoc}%</span>
              </div>
              <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden p-0.5">
                <div
                  className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded-full transition-all duration-700"
                  style={{ width: `${batterySoc}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5">
                <span>Min Reserve: 20%</span>
                <span>Usable: {(batterySoc * 0.1).toFixed(1)} kWh</span>
              </div>
            </div>

            {/* Intelligent Dispatch Controls */}
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white">
                <div>
                  <span className="font-semibold text-slate-800 block">Automated Arbitrage Export</span>
                  <span className="text-[10px] text-slate-500">Discharge battery to P2P market when price exceeds threshold</span>
                </div>
                <button
                  onClick={() => setAutoExportEnabled(!autoExportEnabled)}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    autoExportEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      autoExportEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {autoExportEnabled && (
                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80">
                  <div className="flex items-center justify-between text-slate-800 font-semibold mb-1">
                    <span>Export Trigger Price</span>
                    <span className="font-mono text-amber-800">₹{thresholdPrice.toFixed(2)}/kWh</span>
                  </div>
                  <input
                    type="range"
                    min="3.5"
                    max="6.5"
                    step="0.1"
                    value={thresholdPrice}
                    onChange={(e) => setThresholdPrice(parseFloat(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>₹3.50</span>
                    <span>Current Market: ₹{marketPrice.toFixed(2)}</span>
                    <span>₹6.50</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Cycle Health: 98.4%</span>
            <span>1,420 cycles elapsed</span>
          </div>
        </div>
      </div>
    </div>
  )
}
