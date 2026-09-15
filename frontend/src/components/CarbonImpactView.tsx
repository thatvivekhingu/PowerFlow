'use client'

import React, { useState } from 'react'
import {
  Leaf,
  Award,
  TreePine,
  Download,
  CheckCircle2,
  Sparkles,
  TrendingUp,
  Share2,
  QrCode,
  ShieldCheck,
  Zap,
} from 'lucide-react'

export default function CarbonImpactView({
  feederId = 'FEEDER-01',
}: {
  feederId?: string
}) {
  const [selectedRecMonth, setSelectedRecMonth] = useState<string>('August 2026')
  const [isDownloading, setIsDownloading] = useState<boolean>(false)

  // Leaderboard data for local prosumers in this feeder
  const leaderboard = [
    { rank: 1, name: 'Sharma Solar (#4401)', solarExportKwh: 642, co2SavedKg: 545, badge: 'Net-Zero Champion 🏆', karma: 980 },
    { rank: 2, name: 'Sector 4 Solar Trust', solarExportKwh: 580, co2SavedKg: 493, badge: 'Solar Pioneer 🌟', karma: 940 },
    { rank: 3, name: 'Verma Farm Array', solarExportKwh: 490, co2SavedKg: 416, badge: 'Grid Hero ⚡', karma: 890 },
    { rank: 4, name: 'Green Haven Co-Op', solarExportKwh: 410, co2SavedKg: 348, badge: 'Eco Producer 🌿', karma: 810 },
    { rank: 5, name: 'Gupta Rooftop PV', solarExportKwh: 320, co2SavedKg: 272, badge: 'Community Contributor', karma: 750 },
  ]

  const handleDownloadCertificate = () => {
    setIsDownloading(true)
    setTimeout(() => {
      setIsDownloading(false)
      alert(`Downloaded Official Verified Renewable Energy Certificate (REC) for ${selectedRecMonth}!`)
    }, 1000)
  }

  return (
    <div className="space-y-6">
      {/* ── Header Banner ────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-green-500/10 border border-emerald-500/20 rounded-3xl p-6 backdrop-blur-sm shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/30 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Leaf className="w-3.5 h-3.5 text-emerald-600" />
                SunPay ESG & Carbon Accounting Engine
              </span>
              <span className="text-xs text-slate-500 font-mono">GHG Protocol & CEA Scope 2 Compliant</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Decarbonization Metrics & Renewable Certificates (REC)
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Quantifies real-time greenhouse gas mitigation from local rooftop solar substitution. Automatically mints verifiable Renewable Energy Certificates on-bill for prosumers and corporate green buyers.
            </p>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white border border-slate-200 shadow-xs text-xs">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold text-slate-800">Feeder Clean Energy Share:</span>
            <span className="font-mono font-black text-emerald-700">74.2%</span>
          </div>
        </div>
      </div>

      {/* ── Metric KPI Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>CO₂ Emissions Avoided</span>
            <Leaf className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono">
            2,480 <span className="text-xs font-semibold text-slate-500 font-sans">kg CO₂e</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            0.85 kg CO₂ saved per solar kWh
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Tree Equivalent</span>
            <TreePine className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            114 <span className="text-xs font-semibold text-slate-500 font-sans">mature trees</span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 font-semibold">
            Annual carbon sequestration
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Thermal Coal Displaced</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            1,280 <span className="text-xs font-semibold text-slate-500 font-sans">kg coal</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Prevented thermal baseload burn
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
          <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Minted RECs</span>
            <Award className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-700 font-mono">
            2.9 <span className="text-xs font-semibold text-slate-500 font-sans">MWh Verified</span>
          </div>
          <div className="mt-1 text-[11px] text-purple-600 font-semibold">
            Ready for compliance trading
          </div>
        </div>
      </div>

      {/* ── Renewable Energy Certificate Card & Leaderboard ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 1 Col: Official Verifiable REC Certificate Card */}
        <div className="bg-gradient-to-br from-emerald-800 to-slate-900 text-white rounded-3xl p-6 shadow-md flex flex-col justify-between relative overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute -right-12 -bottom-12 w-48 h-48 rounded-full bg-emerald-500/20 blur-2xl" />

          <div>
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-6 h-6 text-emerald-400" />
                <div>
                  <h3 className="font-extrabold text-sm tracking-wide">RENEWABLE ENERGY CERTIFICATE</h3>
                  <span className="text-[10px] text-emerald-300 font-mono">CERT #REC-2026-8821</span>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold text-emerald-300">
                VERIFIED
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Accredited Prosumer / Owner</span>
                <span className="font-bold text-white text-sm">Sharma Solar Rooftop Cluster</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Feeder Node</span>
                  <span className="font-mono text-emerald-300 font-bold">{feederId}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">Certified Volume</span>
                  <span className="font-mono text-white font-bold">1,000 kWh (1 REC)</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Emissions Reduction</span>
                <span className="font-bold text-emerald-400">850 kg CO₂ Equivalent</span>
              </div>

              <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>DISCOM On-Bill Cryptographic Attestation</span>
                </div>
                <QrCode className="w-6 h-6 text-emerald-400 flex-shrink-0" />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 flex gap-2">
            <button
              onClick={handleDownloadCertificate}
              disabled={isDownloading}
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloading ? 'Generating...' : 'Download REC Certificate'}</span>
            </button>
          </div>
        </div>

        {/* Right 2 Cols: Community Microgrid Leaderboard */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Local Microgrid Prosumer Leaderboard</h3>
              <p className="text-xs text-slate-500">
                Recognizing neighborhood rooftop solar champions generating clean local electricity.
              </p>
            </div>
            <span className="text-xs text-slate-500 font-medium">Ranked by Clean Solar Export</span>
          </div>

          <div className="space-y-2.5">
            {leaderboard.map((item) => (
              <div
                key={item.rank}
                className="p-3.5 rounded-2xl bg-slate-50 hover:bg-emerald-50/40 border border-slate-200 hover:border-emerald-200 transition flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                      item.rank === 1
                        ? 'bg-amber-400 text-slate-950'
                        : item.rank === 2
                        ? 'bg-slate-300 text-slate-900'
                        : item.rank === 3
                        ? 'bg-amber-700 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    #{item.rank}
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block">{item.name}</span>
                    <span className="text-[11px] text-emerald-700 font-semibold">{item.badge}</span>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-right">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">SOLAR EXPORT</span>
                    <span className="font-mono font-bold text-slate-800">{item.solarExportKwh} kWh</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">CO₂ SAVED</span>
                    <span className="font-mono font-bold text-emerald-600">{item.co2SavedKg} kg</span>
                  </div>
                  <div className="hidden sm:block">
                    <span className="text-[10px] text-slate-400 block font-bold">KARMA</span>
                    <span className="font-mono font-bold text-purple-700">{item.karma} pts</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
