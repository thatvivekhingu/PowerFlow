'use client'

import React, { useState, useEffect } from 'react'
import {
  Activity,
  Zap,
  Radio,
  Gauge,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Server,
  Layers,
  Cpu,
  Info,
} from 'lucide-react'
import type { GridState } from '@/types'

interface IoTMeterViewProps {
  gridState?: GridState | null
  feederId?: string
}

export default function IoTMeterView({
  gridState,
  feederId = 'FEEDER-01',
}: IoTMeterViewProps) {
  // Simulated live IoT telemetry state that updates every 2 seconds
  const [voltage, setVoltage] = useState(230.4)
  const [current, setCurrent] = useState(13.8)
  const [frequency, setFrequency] = useState(50.02)
  const [powerFactor, setPowerFactor] = useState(0.98)
  const [activePowerKw, setActivePowerKw] = useState(3.18)
  const [isExporting, setIsExporting] = useState(true)
  const [selectedBus, setSelectedBus] = useState<number>(3)

  useEffect(() => {
    const timer = setInterval(() => {
      setVoltage(parseFloat((230.0 + (Math.random() * 2.4 - 1.2)).toFixed(1)))
      setCurrent(parseFloat((13.5 + (Math.random() * 1.5 - 0.75)).toFixed(1)))
      setFrequency(parseFloat((50.0 + (Math.random() * 0.06 - 0.03)).toFixed(2)))
      setActivePowerKw(parseFloat((3.2 + (Math.random() * 0.4 - 0.2)).toFixed(2)))
    }, 2500)
    return () => clearInterval(timer)
  }, [])

  // Feeder topology nodes (14-Bus distribution network simplified)
  const buses = [
    { id: 1, name: 'Substation (11kV/415V)', type: 'source', v_pu: 1.02, load_kw: 145, solar_kw: 0, status: 'normal' },
    { id: 2, name: 'Sector 4 Junction', type: 'junction', v_pu: 1.01, load_kw: 42, solar_kw: 18, status: 'normal' },
    { id: 3, name: 'Sharma Rooftop Array', type: 'prosumer', v_pu: 1.00, load_kw: 3.2, solar_kw: 8.5, status: 'exporting' },
    { id: 4, name: 'Verma Residence', type: 'prosumer', v_pu: 0.99, load_kw: 4.1, solar_kw: 6.0, status: 'exporting' },
    { id: 5, name: 'Consumer Cluster A', type: 'consumer', v_pu: 0.98, load_kw: 16.5, solar_kw: 0, status: 'importing' },
    { id: 6, name: 'Commercial Hub EV', type: 'consumer', v_pu: 0.97, load_kw: 28.0, solar_kw: 0, status: 'heavy_load' },
    { id: 7, name: 'Community Solar Array', type: 'prosumer', v_pu: 1.01, load_kw: 0, solar_kw: 25.0, status: 'exporting' },
    { id: 8, name: 'Feeder End Bus', type: 'consumer', v_pu: 0.96, load_kw: 12.0, solar_kw: 2.0, status: 'normal' },
  ]

  const selectedBusData = buses.find((b) => b.id === selectedBus) || buses[2]

  return (
    <div className="space-y-6">
      {/* ── Header Banner ────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-emerald-500/10 border border-blue-500/20 rounded-3xl p-6 backdrop-blur-sm shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-700 border border-blue-500/30 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                IoT Telemetry & AC Grid Physics Engine
              </span>
              <span className="text-xs text-slate-500 font-mono">IEEE 1547 & CEA Standards Compliant</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Real-Time Smart Metering & Radial Feeder Map
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Streams bidirectional electrical parameters directly from edge smart meters. Validates physical grid line capacity, voltage stability (0.95 to 1.05 V_pu), and anti-islanding safety before dispatching P2P transactions.
            </p>
          </div>

          {/* Live Link Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-white border border-slate-200 shadow-xs text-xs">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="font-semibold text-slate-800">Smart Meter MTR-PRO-01: ONLINE</span>
          </div>
        </div>
      </div>

      {/* ── IoT Smart Meter Telemetry Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Voltage */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>RMS Voltage</span>
            <Gauge className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {voltage} <span className="text-xs font-semibold text-slate-500 font-sans">V</span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Nominal (230V ± 1%)</span>
          </div>
        </div>

        {/* Current */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Line Current</span>
            <Activity className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {current} <span className="text-xs font-semibold text-slate-500 font-sans">A</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Thermal threshold: 40 A
          </div>
        </div>

        {/* Grid Frequency */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Grid Frequency</span>
            <Radio className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {frequency} <span className="text-xs font-semibold text-slate-500 font-sans">Hz</span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 font-semibold">
            In-band (49.9 - 50.1 Hz)
          </div>
        </div>

        {/* Power Factor */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Power Factor (cos φ)</span>
            <Layers className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            {powerFactor}
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 font-semibold">
            Near Unity (0.98 Lagging)
          </div>
        </div>

        {/* Active Power & Flow Direction */}
        <div className="col-span-2 lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Active Power Flow</span>
            <Zap className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono">
            {activePowerKw} <span className="text-xs font-semibold text-slate-500 font-sans">kW</span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>EXPORTING TO FEEDER</span>
          </div>
        </div>
      </div>

      {/* ── Radial Feeder Network Visualizer ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive SVG Topology */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                11kV Distribution Feeder Topology ({feederId})
              </h3>
              <p className="text-xs text-slate-500">
                Animated green dashes show local prosumer solar power flowing directly to neighboring consumers.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Prosumer PV
              </span>
              <span className="flex items-center gap-1.5 text-blue-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> Consumer
              </span>
            </div>
          </div>

          {/* Interactive SVG Diagram */}
          <div className="relative border border-slate-100 bg-slate-50/50 rounded-2xl p-4 overflow-hidden">
            <svg viewBox="0 0 700 280" className="w-full h-auto">
              {/* Grid Background Lines */}
              <defs>
                <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#f1f5f9" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="700" height="280" fill="url(#grid)" />

              {/* Trunk Feeder Line from Substation */}
              <line x1="60" y1="140" x2="640" y2="140" stroke="#cbd5e1" strokeWidth="6" strokeLinecap="round" />
              {/* Animated Power Flow on Trunk */}
              <line
                x1="60"
                y1="140"
                x2="640"
                y2="140"
                stroke="#10b981"
                strokeWidth="4"
                strokeLinecap="round"
                className="animate-power-flow"
              />

              {/* Lateral Branch Lines */}
              <line x1="220" y1="140" x2="220" y2="60" stroke="#94a3b8" strokeWidth="2" strokeDasharray="3 3" />
              <line x1="360" y1="140" x2="360" y2="60" stroke="#94a3b8" strokeWidth="2" strokeDasharray="3 3" />
              <line x1="500" y1="140" x2="500" y2="60" stroke="#94a3b8" strokeWidth="2" strokeDasharray="3 3" />

              <line x1="220" y1="140" x2="220" y2="220" stroke="#94a3b8" strokeWidth="2" strokeDasharray="3 3" />
              <line x1="360" y1="140" x2="360" y2="220" stroke="#94a3b8" strokeWidth="2" strokeDasharray="3 3" />
              <line x1="500" y1="140" x2="500" y2="220" stroke="#94a3b8" strokeWidth="2" strokeDasharray="3 3" />

              {/* BUS 1: Substation */}
              <g
                className="cursor-pointer"
                onClick={() => setSelectedBus(1)}
              >
                <circle cx="60" cy="140" r="22" fill="#0f172a" stroke="#ffffff" strokeWidth="3" />
                <text x="60" y="144" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">SUB</text>
                <text x="60" y="180" textAnchor="middle" fill="#475569" fontSize="10" fontWeight="600">11kV Substation</text>
              </g>

              {/* BUS 3: Sharma Rooftop PV */}
              <g
                className="cursor-pointer"
                onClick={() => setSelectedBus(3)}
              >
                <circle
                  cx="220"
                  cy="60"
                  r="18"
                  fill="#10b981"
                  stroke={selectedBus === 3 ? '#047857' : '#ffffff'}
                  strokeWidth={selectedBus === 3 ? 4 : 2}
                />
                <text x="220" y="64" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">☀️</text>
                <text x="220" y="38" textAnchor="middle" fill="#0f172a" fontSize="10" fontWeight="bold">Sharma Solar</text>
                <text x="220" y="49" textAnchor="middle" fill="#10b981" fontSize="9">+8.5 kW</text>
              </g>

              {/* BUS 4: Verma PV */}
              <g
                className="cursor-pointer"
                onClick={() => setSelectedBus(4)}
              >
                <circle
                  cx="360"
                  cy="60"
                  r="18"
                  fill="#10b981"
                  stroke={selectedBus === 4 ? '#047857' : '#ffffff'}
                  strokeWidth={selectedBus === 4 ? 4 : 2}
                />
                <text x="360" y="64" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">☀️</text>
                <text x="360" y="38" textAnchor="middle" fill="#0f172a" fontSize="10" fontWeight="bold">Verma PV</text>
                <text x="360" y="49" textAnchor="middle" fill="#10b981" fontSize="9">+6.0 kW</text>
              </g>

              {/* BUS 7: Community Solar */}
              <g
                className="cursor-pointer"
                onClick={() => setSelectedBus(7)}
              >
                <circle
                  cx="500"
                  cy="60"
                  r="18"
                  fill="#10b981"
                  stroke={selectedBus === 7 ? '#047857' : '#ffffff'}
                  strokeWidth={selectedBus === 7 ? 4 : 2}
                />
                <text x="500" y="64" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">☀️</text>
                <text x="500" y="38" textAnchor="middle" fill="#0f172a" fontSize="10" fontWeight="bold">Community Solar</text>
                <text x="500" y="49" textAnchor="middle" fill="#10b981" fontSize="9">+25 kW</text>
              </g>

              {/* BUS 5: Consumer Cluster A */}
              <g
                className="cursor-pointer"
                onClick={() => setSelectedBus(5)}
              >
                <circle
                  cx="220"
                  cy="220"
                  r="18"
                  fill="#2563eb"
                  stroke={selectedBus === 5 ? '#1d4ed8' : '#ffffff'}
                  strokeWidth={selectedBus === 5 ? 4 : 2}
                />
                <text x="220" y="224" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">🏠</text>
                <text x="220" y="252" textAnchor="middle" fill="#0f172a" fontSize="10" fontWeight="bold">Consumer A</text>
                <text x="220" y="263" textAnchor="middle" fill="#2563eb" fontSize="9">-16.5 kW</text>
              </g>

              {/* BUS 6: Commercial Hub EV */}
              <g
                className="cursor-pointer"
                onClick={() => setSelectedBus(6)}
              >
                <circle
                  cx="360"
                  cy="220"
                  r="18"
                  fill="#d97706"
                  stroke={selectedBus === 6 ? '#b45309' : '#ffffff'}
                  strokeWidth={selectedBus === 6 ? 4 : 2}
                />
                <text x="360" y="224" textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">⚡</text>
                <text x="360" y="252" textAnchor="middle" fill="#0f172a" fontSize="10" fontWeight="bold">Commercial EV</text>
                <text x="360" y="263" textAnchor="middle" fill="#d97706" fontSize="9">-28.0 kW</text>
              </g>

              {/* BUS 8: Feeder End */}
              <g
                className="cursor-pointer"
                onClick={() => setSelectedBus(8)}
              >
                <circle
                  cx="640"
                  cy="140"
                  r="16"
                  fill="#64748b"
                  stroke={selectedBus === 8 ? '#334155' : '#ffffff'}
                  strokeWidth={selectedBus === 8 ? 4 : 2}
                />
                <text x="640" y="144" textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="bold">END</text>
                <text x="640" y="170" textAnchor="middle" fill="#475569" fontSize="10" fontWeight="600">Tail Bus</text>
              </g>
            </svg>
          </div>
        </div>

        {/* Right 1 Col: Selected Bus Inspector Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <Server className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Bus Inspector (Node #{selectedBusData.id})</h3>
                <span className="text-[10px] text-slate-400 font-medium">{selectedBusData.name}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between p-2.5 rounded-xl bg-slate-50">
                <span className="text-slate-600 font-medium">Per-Unit Voltage (V_pu):</span>
                <span className="font-mono font-bold text-slate-900">{selectedBusData.v_pu} p.u. (230.2 V)</span>
              </div>

              <div className="flex justify-between p-2.5 rounded-xl bg-slate-50">
                <span className="text-slate-600 font-medium">Local Solar Generation:</span>
                <span className="font-mono font-bold text-emerald-600">+{selectedBusData.solar_kw} kW</span>
              </div>

              <div className="flex justify-between p-2.5 rounded-xl bg-slate-50">
                <span className="text-slate-600 font-medium">Local Consumer Demand:</span>
                <span className="font-mono font-bold text-blue-600">-{selectedBusData.load_kw} kW</span>
              </div>

              <div className="flex justify-between p-2.5 rounded-xl bg-slate-50">
                <span className="text-slate-600 font-medium">Net Feeder Injection:</span>
                <span className={`font-mono font-bold ${selectedBusData.solar_kw - selectedBusData.load_kw >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {(selectedBusData.solar_kw - selectedBusData.load_kw).toFixed(1)} kW
                </span>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 leading-relaxed">
                <strong>AC Power Flow Feasible:</strong> Line thermal limits and transformer reactance ($X/R = 3.5$) validated. No reverse-power backfeeding to transmission grid.
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Sampling: 100ms IoT Stream</span>
            <span>Feeder Loss: 1.4%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
