'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import InvoiceModal from '@/components/InvoiceModal'
import BlockchainModal from '@/components/BlockchainModal'
import SolarForecastView from '@/components/SolarForecastView'
import DoubleAuctionView from '@/components/DoubleAuctionView'
import IoTMeterView from '@/components/IoTMeterView'
import CarbonImpactView from '@/components/CarbonImpactView'
import BlockchainLedgerView from '@/components/BlockchainLedgerView'
import type { BlockchainProof } from '@/types'
import {
  Zap,
  Sun,
  Shield,
  Activity,
  CheckCircle2,
  TrendingDown,
  Sprout,
  ArrowRight,
  TrendingUp,
  Clock,
  ExternalLink,
  ChevronDown,
  Search,
  Filter,
  SlidersHorizontal,
  Bot,
  Layers,
  ShoppingBag,
  BarChart3,
  Wallet,
  Bell,
  Check,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Send,
  User,
  Plus,
  Compass,
  Building2,
  BatteryCharging,
  Cpu,
  LogOut,
  Radio,
  Scale,
  Leaf,
  Blocks,
} from 'lucide-react'


// Realistic photo avatars
const AVATARS = {
  consumer: '/images/priya_avatar.jpg',
  prosumer: '/images/rohit_avatar.jpg',
  operator: '/images/arjun_avatar.jpg',
}

export default function PowerFlowApp() {
  const router = useRouter()
  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<
    | 'dashboard'
    | 'marketplace'
    | 'solar_forecast'
    | 'double_auction'
    | 'iot_meter'
    | 'prosumer'
    | 'operator'
    | 'carbon_impact'
    | 'blockchain'
  >('dashboard')

  
  // Current user persona
  const [role, setRole] = useState<'consumer' | 'prosumer' | 'operator'>('consumer')
  const [userDropdownOpen, setUserDropdownOpen] = useState(false)
  const [selectedFeeder, setSelectedFeeder] = useState('Feeder-01')

  // Modals
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false)
  const [isBlockchainOpen, setIsBlockchainOpen] = useState(false)
  const [blockchainProof, setBlockchainProof] = useState<BlockchainProof | null>(null)
  const [invoiceData, setInvoiceData] = useState({
    tradeId: 'TRD-2026-001234',
    date: 'Jan 15, 2026, 14:23:15',
    buyerName: 'Consumer Node #1024',
    buyerEmail: 'consumer-1024@powerflow.network',
    sellerName: 'Prosumer Cluster #4401',
    sellerEmail: 'cluster-4401@powerflow.network',
    energyKwh: 5.0,
    pricePerKwh: 4.20,
    energyCost: 21.00,
    wheelingCharge: 1.25,
    platformFee: 0.50,
    totalAmount: 22.75,
    feeder: 'Feeder-01',
    paymentMethod: 'UPI Wallet',
  })

  // Marketplace states
  const [marketFilter, setMarketFilter] = useState<'all' | 'rooftop' | 'community' | 'battery'>('all')
  const [sortBy, setSortBy] = useState('low-to-high')

  // Prosumer state
  const [sellModalOpen, setSellModalOpen] = useState(false)
  const [newOrderKwh, setNewOrderKwh] = useState(10)
  const [newOrderPrice, setNewOrderPrice] = useState(4.30)
  const [sellOrders, setSellOrders] = useState([
    { id: 'ORD-101', quantity: 50, price: 4.50, filled: 60, status: 'Active' },
    { id: 'ORD-102', quantity: 30, price: 4.40, filled: 100, status: 'Filled' },
    { id: 'ORD-103', quantity: 20, price: 4.60, filled: 25, status: 'Active' },
  ])

  const handleExecuteTrade = (sellerName: string, price: number, kwh: number) => {
    setInvoiceData({
      tradeId: `TRD-2026-${Math.floor(100000 + Math.random() * 900000)}`,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + `, ${new Date().toLocaleTimeString('en-US', { hour12: false })}`,
      buyerName: role === 'consumer' ? 'Consumer Node #1024' : role === 'prosumer' ? 'Prosumer Cluster #4401' : 'DISCOM Substation Node',
      buyerEmail: role === 'consumer' ? 'consumer-1024@powerflow.network' : role === 'prosumer' ? 'cluster-4401@powerflow.network' : 'operator@discom.gov.in',
      sellerName: sellerName,
      sellerEmail: `${sellerName.toLowerCase().replace(/[^a-z0-9]/g, '')}@powerflow.network`,
      energyKwh: kwh,
      pricePerKwh: price,
      energyCost: +(kwh * price).toFixed(2),
      wheelingCharge: +(kwh * 0.25).toFixed(2),
      platformFee: 0.50,
      totalAmount: +(kwh * price + kwh * 0.25 + 0.50).toFixed(2),
      feeder: selectedFeeder,
      paymentMethod: 'UPI Wallet',
    })
    setIsInvoiceOpen(true)
  }

  // Persona profiles
  const currentPersona = {
    consumer: { name: 'Consumer Node #1024', roleLabel: 'Consumer Node', avatar: AVATARS.consumer },
    prosumer: { name: 'Prosumer Cluster #4401', roleLabel: 'Prosumer Node', avatar: AVATARS.prosumer },
    operator: { name: 'DISCOM Feeder Operator', roleLabel: 'Grid Operator', avatar: AVATARS.operator },
  }[role]

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-800">
      
      {/* ── LEFT SIDEBAR ────────────────────────────────────────────── */}
      <aside className="w-60 bg-white border-r border-slate-200/90 flex flex-col justify-between shrink-0 select-none z-30 sticky top-0 h-screen">
        <div>
          {/* Logo & Brand */}
          <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white shadow-sm shadow-emerald-500/30">
              <Zap className="w-5 h-5 fill-white" />
            </div>
            <span className="font-extrabold text-lg tracking-tight text-slate-900">POWERFLOW</span>
          </div>

          {/* Navigation Links */}
          <nav className="p-3.5 space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
                <div className={`rounded-sm ${activeTab === 'dashboard' ? 'bg-white' : 'bg-slate-500'}`} />
                <div className={`rounded-sm ${activeTab === 'dashboard' ? 'bg-white' : 'bg-slate-500'}`} />
                <div className={`rounded-sm ${activeTab === 'dashboard' ? 'bg-white' : 'bg-slate-500'}`} />
                <div className={`rounded-sm ${activeTab === 'dashboard' ? 'bg-white' : 'bg-slate-500'}`} />
              </div>
              Dashboard
            </button>

            <button
              onClick={() => setActiveTab('marketplace')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'marketplace'
                  ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              Marketplace
            </button>

            <button
              onClick={() => setActiveTab('solar_forecast')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'solar_forecast'
                  ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <Sun className="w-4 h-4 text-amber-500" />
              <span>SolarSync AI</span>
            </button>

            <button
              onClick={() => setActiveTab('double_auction')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'double_auction'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <Scale className="w-4 h-4 text-indigo-500" />
              <span>Double-Auction</span>
            </button>

            <button
              onClick={() => setActiveTab('iot_meter')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'iot_meter'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <Radio className="w-4 h-4 text-blue-500" />
              <span>IoT Meter & Map</span>
            </button>

            <button
              onClick={() => setActiveTab('prosumer')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'prosumer'
                  ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <BatteryCharging className="w-4 h-4" />
              Prosumer Studio
            </button>

            <button
              onClick={() => setActiveTab('operator')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'operator'
                  ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <Shield className="w-4 h-4" />
              Grid Operator
            </button>

            <button
              onClick={() => setActiveTab('carbon_impact')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'carbon_impact'
                  ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <Leaf className="w-4 h-4 text-emerald-500" />
              <span>Carbon Impact</span>
            </button>

            <button
              onClick={() => setActiveTab('blockchain')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'blockchain'
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
              }`}
            >
              <Blocks className="w-4 h-4 text-purple-500" />
              <span>Blockchain Ledger</span>
            </button>

          </nav>
        </div>

        {/* Bottom Switcher Pill */}
        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative w-8 h-8 rounded-full overflow-hidden border border-emerald-500/40">
                <Image
                  src={currentPersona.avatar}
                  alt={currentPersona.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="leading-tight">
                <p className="text-xs font-bold text-slate-800">{currentPersona.name}</p>
                <p className="text-[10px] text-slate-400 font-medium">{currentPersona.roleLabel}</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/login')}
              title="Sign Out"
              className="text-slate-400 hover:text-rose-500 transition-colors p-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT AREA ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200/90 px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            {/* Feeder Selector */}
            <div className="relative">
              <select
                value={selectedFeeder}
                onChange={(e) => setSelectedFeeder(e.target.value)}
                className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold py-1.5 pl-3 pr-7 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="Feeder-01">Feeder-01</option>
                <option value="Feeder-02">Feeder-02</option>
                <option value="Feeder-03">Feeder-03</option>
                <option value="All Feeders">All Feeders</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
            </div>

            {/* Live Indicator */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/70 text-emerald-600 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </div>
          </div>

          {/* User Profile & Role Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2.5 py-1 px-2 rounded-xl hover:bg-slate-100 transition-all cursor-pointer border border-transparent hover:border-slate-200"
            >
              <div className="relative w-8 h-8 rounded-full overflow-hidden border border-emerald-500/30">
                <Image
                  src={currentPersona.avatar}
                  alt={currentPersona.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold text-slate-800 leading-none">{currentPersona.name}</p>
                <p className="text-[10px] text-slate-400 font-medium leading-none mt-1">{currentPersona.roleLabel}</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
            </button>

            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Switch Persona
                </div>
                <button
                  onClick={() => {
                    setRole('consumer')
                    setActiveTab('dashboard')
                    setUserDropdownOpen(false)
                  }}
                  className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 flex items-center gap-2.5 font-semibold text-slate-700"
                >
                  <div className="relative w-6 h-6 rounded-full overflow-hidden">
                    <Image src={AVATARS.consumer} alt="Consumer" fill className="object-cover" />
                  </div>
                  Consumer Node #1024
                </button>
                <button
                  onClick={() => {
                    setRole('prosumer')
                    setActiveTab('prosumer')
                    setUserDropdownOpen(false)
                  }}
                  className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 flex items-center gap-2.5 font-semibold text-slate-700"
                >
                  <div className="relative w-6 h-6 rounded-full overflow-hidden">
                    <Image src={AVATARS.prosumer} alt="Prosumer" fill className="object-cover" />
                  </div>
                  Prosumer Cluster #4401
                </button>
                <button
                  onClick={() => {
                    setRole('operator')
                    setActiveTab('operator')
                    setUserDropdownOpen(false)
                  }}
                  className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 flex items-center gap-2.5 font-semibold text-slate-700"
                >
                  <div className="relative w-6 h-6 rounded-full overflow-hidden">
                    <Image src={AVATARS.operator} alt="Operator" fill className="object-cover" />
                  </div>
                  DISCOM Feeder Operator
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  onClick={() => router.push('/login')}
                  className="w-full px-3 py-2 text-left text-xs hover:bg-rose-50 text-rose-600 flex items-center gap-2 font-semibold"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Body Pages Container */}
        <main className="p-6 max-w-7xl w-full mx-auto space-y-5">
          
          {/* ══════════════════════════════════════════════════════════════
              TAB 1: MAIN CONSUMER DASHBOARD (Top-Middle Mockup)
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'dashboard' && (
            <div className="space-y-5 animate-fade-in">
              {/* Greeting */}
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Clean Energy Telemetry & P2P Exchange</h1>
                <p className="text-xs text-slate-500 mt-0.5">Real-time localized power flow, continuous double-auction clearing, and feeder headroom.</p>
              </div>

              {/* 4 Stat Cards Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Stat 1: Grid Status */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Grid Status</span>
                    <span className="text-base font-black text-slate-900 block leading-tight">Normal</span>
                    <span className="text-[11px] font-semibold text-emerald-600">62% utilized</span>
                  </div>
                </div>

                {/* Stat 2: Current Price */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Current Price</span>
                    <span className="text-base font-black text-slate-900 block leading-tight">₹4.20/kWh</span>
                    <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-0.5">
                      <TrendingDown className="w-3 h-3" /> -12% from yesterday
                    </span>
                  </div>
                </div>

                {/* Stat 3: Available Solar */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500 shrink-0">
                    <Sun className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Available Solar</span>
                    <span className="text-base font-black text-slate-900 block leading-tight">125 kW</span>
                    <span className="text-[11px] font-medium text-slate-400">in your area</span>
                  </div>
                </div>

                {/* Stat 4: CO2 Saved */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                    <Sprout className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">CO₂ Saved</span>
                    <span className="text-base font-black text-slate-900 block leading-tight">2.4 tons</span>
                    <span className="text-[11px] font-medium text-slate-400">this month</span>
                  </div>
                </div>
              </div>

              {/* Middle Row: Live Energy Flow & Feeder Load */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                
                {/* Live Energy Flow Diagram */}
                <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-slate-900">Live Energy Flow</h2>
                    <span className="text-[11px] text-slate-400 font-medium">Updated real-time</span>
                  </div>

                  {/* Flow Diagram */}
                  <div className="py-6 px-4 flex items-center justify-between relative">
                    {/* Node 1: Solar Producers */}
                    <div className="flex flex-col items-center text-center z-10">
                      <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500 shadow-sm mb-2 hover:scale-105 transition-transform">
                        {/* High-tech solar panel icon */}
                        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="12 2 2 7 12 12 22 7 12 2" />
                          <polyline points="2 17 12 22 22 17" />
                          <polyline points="2 12 12 17 22 12" />
                        </svg>
                      </div>
                      <span className="text-xs font-bold text-slate-800">Solar Producers</span>
                      <span className="text-xs font-extrabold text-amber-600 mt-0.5">85 kW</span>
                    </div>

                    {/* Connector 1 */}
                    <div className="flex-1 mx-4 flex items-center justify-center relative">
                      <div className="w-full h-0.5 bg-emerald-200/70" />
                      <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      <ArrowRight className="w-4 h-4 text-emerald-500 absolute right-0 top-1/2 -translate-y-1/2" />
                    </div>

                    {/* Node 2: Grid Substation / Transmission Pylon */}
                    <div className="flex flex-col items-center text-center z-10">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-sm mb-2 hover:scale-105 transition-transform">
                        {/* High-voltage transmission pylon SVG */}
                        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2L6 22h12L12 2z" />
                          <path d="M7 11h10" />
                          <path d="M5 16h14" />
                          <path d="M9 7l6 6" />
                          <path d="M15 7l-6 6" />
                        </svg>
                      </div>
                      <span className="text-xs font-bold text-slate-800">Grid (Feeder-01)</span>
                      <span className="text-xs font-bold text-rose-500 mt-0.5">62% loaded</span>
                    </div>

                    {/* Connector 2 */}
                    <div className="flex-1 mx-4 flex items-center justify-center relative">
                      <div className="w-full h-0.5 bg-emerald-200/70" />
                      <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-500 animate-ping delay-300" />
                      <ArrowRight className="w-4 h-4 text-emerald-500 absolute right-0 top-1/2 -translate-y-1/2" />
                    </div>

                    {/* Node 3: Consumers */}
                    <div className="flex flex-col items-center text-center z-10">
                      <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm mb-2 hover:scale-105 transition-transform">
                        {/* Modern home SVG */}
                        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                          <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                      </div>
                      <span className="text-xs font-bold text-slate-800">Consumers</span>
                      <span className="text-xs font-extrabold text-blue-600 mt-0.5">78 kW</span>
                    </div>
                  </div>
                </div>

                {/* Feeder Load Circular Gauge */}
                <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900">Feeder Load</h2>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-200/50">
                      Optimal
                    </span>
                  </div>

                  {/* Circular Gauge */}
                  <div className="relative flex items-center justify-center py-2">
                    <svg className="w-32 h-32 -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="52"
                        className="stroke-slate-100"
                        strokeWidth="10"
                        fill="transparent"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="52"
                        className="stroke-emerald-500"
                        strokeWidth="10"
                        strokeDasharray={326.7}
                        strokeDashoffset={326.7 * (1 - 0.62)}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-2xl font-black text-slate-900 tracking-tight">62%</span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Transformer Load</span>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-slate-500 text-[11px]">Used:</span>
                      <span className="font-bold text-slate-800 text-[11px]">62 MW</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-300" />
                      <span className="text-slate-500 text-[11px]">Available:</span>
                      <span className="font-bold text-slate-800 text-[11px]">38 MW</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Bottom Row: Live Market Price & Recent Trades */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                
                {/* Live Market Price Area Chart */}
                <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Live Market Price (₹/kWh)</h2>
                      <p className="text-[11px] text-slate-400">Continuous double-auction clearing rate</p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white font-black text-xs shadow-sm">
                      ₹4.20
                    </span>
                  </div>

                  {/* SVG Area Curve */}
                  <div className="relative pt-4 pb-2">
                    <svg className="w-full h-36 overflow-visible" viewBox="0 0 600 140" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Horizontal Gridlines */}
                      <line x1="0" y1="20" x2="600" y2="20" stroke="#f1f5f9" strokeDasharray="4 4" />
                      <line x1="0" y1="60" x2="600" y2="60" stroke="#f1f5f9" strokeDasharray="4 4" />
                      <line x1="0" y1="100" x2="600" y2="100" stroke="#f1f5f9" strokeDasharray="4 4" />

                      {/* Area Fill */}
                      <path
                        d="M0,110 C80,105 140,85 200,80 C260,75 320,40 380,45 C440,50 500,85 600,75 L600,140 L0,140 Z"
                        fill="url(#priceGradient)"
                      />

                      {/* Spline Stroke */}
                      <path
                        d="M0,110 C80,105 140,85 200,80 C260,75 320,40 380,45 C440,50 500,85 600,75"
                        fill="none"
                        stroke="#0284c7"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />

                      {/* Active Price Dot at x=380, y=45 */}
                      <circle cx="380" cy="45" r="5" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
                    </svg>

                    {/* X-Axis Timestamps */}
                    <div className="flex justify-between text-[10px] font-semibold text-slate-400 pt-2">
                      <span>00:00</span>
                      <span>04:00</span>
                      <span>08:00</span>
                      <span>12:00</span>
                      <span>16:00</span>
                      <span>20:00</span>
                    </div>
                  </div>
                </div>

                {/* Recent Trades Card */}
                <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-slate-900">Recent Trades</h2>
                    <button
                      onClick={() => setActiveTab('marketplace')}
                      className="text-xs font-semibold text-slate-400 hover:text-emerald-600 transition-colors"
                    >
                      View All
                    </button>
                  </div>

                  {/* 3 Trade Items */}
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100/70 text-emerald-700 flex items-center justify-center shrink-0">
                          <Zap className="w-4 h-4 fill-emerald-600" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">5 kWh</p>
                          <p className="text-[10px] text-slate-500 font-medium">₹4.20/kWh</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400">2 min ago</p>
                        <p className="text-[10px] font-bold text-emerald-700">Feeder-01</p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100/70 text-emerald-700 flex items-center justify-center shrink-0">
                          <Zap className="w-4 h-4 fill-emerald-600" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">12 kWh</p>
                          <p className="text-[10px] text-slate-500 font-medium">₹4.10/kWh</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400">8 min ago</p>
                        <p className="text-[10px] font-bold text-emerald-700">Feeder-01</p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-100/70 text-amber-700 flex items-center justify-center shrink-0">
                          <Zap className="w-4 h-4 fill-amber-600" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">8 kWh</p>
                          <p className="text-[10px] text-slate-500 font-medium">₹4.30/kWh</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400">15 min ago</p>
                        <p className="text-[10px] font-bold text-amber-700">Feeder-02</p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB 2: MARKETPLACE ("Find Clean Energy" Top-Right Mockup)
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'marketplace' && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Find Clean Energy</h1>
                <p className="text-xs text-slate-500 mt-0.5">Choose from verified solar producers in your community.</p>
              </div>

              {/* Filters & Sort */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setMarketFilter('all')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      marketFilter === 'all'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setMarketFilter('rooftop')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      marketFilter === 'rooftop'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Rooftop Solar
                  </button>
                  <button
                    onClick={() => setMarketFilter('community')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      marketFilter === 'community'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Community Solar
                  </button>
                  <button
                    onClick={() => setMarketFilter('battery')}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      marketFilter === 'battery'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Battery Storage
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-400">Sort by</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold py-1.5 px-3 rounded-xl focus:outline-none cursor-pointer"
                  >
                    <option value="low-to-high">Price (Low to High)</option>
                    <option value="high-to-low">Price (High to Low)</option>
                    <option value="highest-rated">Highest Rated</option>
                  </select>
                </div>
              </div>

              {/* Producer Cards matching Mockup */}
              <div className="space-y-3.5">
                {/* Card 1: SunRise Rooftop Solar Array */}
                {(marketFilter === 'all' || marketFilter === 'rooftop') && (
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-center gap-4">
                    <div className="relative w-full md:w-36 h-28 rounded-xl overflow-hidden shrink-0">
                      <Image
                        src="/images/rooftop_solar.jpg"
                        alt="SunRise Rooftop Solar Array"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-slate-900">SunRise Rooftop Solar Array</h3>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Prosumer Cluster #4401</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2.5">
                        <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                          ★ 4.8 <span className="text-slate-400 font-normal">(120)</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[10px] font-bold">
                          Rooftop Solar
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-bold">
                          Verified
                        </span>
                      </div>
                    </div>
                    <div className="flex md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-lg font-black text-emerald-600 block leading-tight">₹4.20/kWh</span>
                        <span className="text-[10px] font-medium text-slate-400">Available: 50 kWh</span>
                      </div>
                      <button
                        onClick={() => handleExecuteTrade('Prosumer Cluster #4401', 4.20, 5)}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
                      >
                        Buy Now
                      </button>
                    </div>
                  </div>
                )}

                {/* Card 2: Sector-4 Community Solar Trust */}
                {(marketFilter === 'all' || marketFilter === 'community') && (
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-center gap-4">
                    <div className="relative w-full md:w-36 h-28 rounded-xl overflow-hidden shrink-0">
                      <Image
                        src="/images/community_solar.jpg"
                        alt="Sector-4 Community Solar Trust"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-slate-900">Sector-4 Community Solar Trust</h3>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Community Microgrid Co-op</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2.5">
                        <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                          ★ 4.6 <span className="text-slate-400 font-normal">(95)</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-bold">
                          Community Solar
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-bold">
                          Verified
                        </span>
                      </div>
                    </div>
                    <div className="flex md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-lg font-black text-emerald-600 block leading-tight">₹4.40/kWh</span>
                        <span className="text-[10px] font-medium text-slate-400">Available: 100 kWh</span>
                      </div>
                      <button
                        onClick={() => handleExecuteTrade('Sector-4 Solar Trust', 4.40, 10)}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
                      >
                        Buy Now
                      </button>
                    </div>
                  </div>
                )}

                {/* Card 3: EcoPower BESS Storage Facility */}
                {(marketFilter === 'all' || marketFilter === 'battery') && (
                  <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-center gap-4">
                    <div className="relative w-full md:w-36 h-28 rounded-xl overflow-hidden shrink-0">
                      <Image
                        src="/images/battery_storage.jpg"
                        alt="EcoPower BESS Storage Facility"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-slate-900">EcoPower BESS Storage Facility</h3>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">Battery Energy Storage Node #08</p>
                      <div className="flex flex-wrap items-center gap-2 mt-2.5">
                        <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                          ★ 4.7 <span className="text-slate-400 font-normal">(76)</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[10px] font-bold">
                          Battery Storage
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-bold">
                          Verified
                        </span>
                      </div>
                    </div>
                    <div className="flex md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-lg font-black text-emerald-600 block leading-tight">₹4.60/kWh</span>
                        <span className="text-[10px] font-medium text-slate-400">Available: 80 kWh</span>
                      </div>
                      <button
                        onClick={() => handleExecuteTrade('EcoPower BESS #08', 4.60, 8)}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
                      >
                        Buy Now
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Disclaimer matching Mockup */}
              <div className="text-center pt-2">
                <p className="text-[11px] text-slate-400 font-medium">
                  All producers are verified and grid-approved • Prices include platform fees • DISCOM wheeling charge (₹0.25/kWh) applied
                </p>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB 3: PROSUMER STUDIO (Middle-Left Mockup)
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'prosumer' && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">Prosumer Studio</h1>
                  <p className="text-xs text-slate-500 mt-0.5">Monitor your generation, manage orders, and earn from clean energy.</p>
                </div>
                <button
                  onClick={() => setSellModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Create Sell Order
                </button>
              </div>

              {/* 4 Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Live Generation</span>
                  <span className="text-xl font-black text-slate-900 block mt-1">8.4 kW</span>
                  <span className="text-[11px] font-semibold text-emerald-600">Peak solar output</span>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Household Load</span>
                  <span className="text-xl font-black text-slate-900 block mt-1">3.1 kW</span>
                  <span className="text-[11px] font-medium text-slate-400">AC & appliances running</span>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Exportable Surplus</span>
                  <span className="text-xl font-black text-emerald-600 block mt-1">5.3 kW</span>
                  <span className="text-[11px] font-semibold text-emerald-600">Ready for P2P sale</span>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Today's Earnings</span>
                  <span className="text-xl font-black text-slate-900 block mt-1">₹328.50</span>
                  <span className="text-[11px] font-semibold text-emerald-600">+₹114 vs net metering</span>
                </div>
              </div>

              {/* Charts & Asset Row */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Generation vs Consumption Chart */}
                <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-slate-900">Generation vs Consumption (Today)</h2>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1.5 text-amber-600 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Solar Generation
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-500 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Household Load
                      </span>
                    </div>
                  </div>

                  <div className="relative pt-4 pb-2">
                    <svg className="w-full h-44 overflow-visible" viewBox="0 0 600 160" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="solarGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Solar Curve */}
                      <path
                        d="M0,150 C120,150 180,140 240,60 C300,20 360,25 420,70 C480,120 540,150 600,155 L600,160 L0,160 Z"
                        fill="url(#solarGradient)"
                      />
                      <path
                        d="M0,150 C120,150 180,140 240,60 C300,20 360,25 420,70 C480,120 540,150 600,155"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="2.5"
                      />

                      {/* Household Load Curve */}
                      <path
                        d="M0,130 C120,135 240,115 360,110 C480,95 540,85 600,80"
                        fill="none"
                        stroke="#64748b"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                      />
                    </svg>

                    <div className="flex justify-between text-[10px] font-semibold text-slate-400 pt-2">
                      <span>00:00</span>
                      <span>04:00</span>
                      <span>08:00</span>
                      <span>11:00</span>
                      <span>14:00</span>
                      <span>17:00</span>
                      <span>20:00</span>
                    </div>
                  </div>
                </div>

                {/* Solar Asset Status Card */}
                <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                  <h2 className="text-sm font-bold text-slate-900 mb-3">Solar Asset Status</h2>
                  <div className="relative w-full h-32 rounded-xl overflow-hidden mb-3">
                    <Image
                      src="/images/rooftop_solar.jpg"
                      alt="Rooftop Solar Array"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">Rooftop Solar - 10 kW</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">Active</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Efficiency:</span>
                      <span className="font-bold text-emerald-600">92%</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Installed:</span>
                      <span className="font-bold text-slate-700">Jan 2024</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Sell Orders Table */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
                <h2 className="text-sm font-bold text-slate-900 mb-3">Active Sell Orders</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 uppercase font-semibold text-[10px]">
                        <th className="pb-2">Quantity</th>
                        <th className="pb-2">Price (₹/kWh)</th>
                        <th className="pb-2">Filled</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sellOrders.map((ord) => (
                        <tr key={ord.id} className="hover:bg-slate-50">
                          <td className="py-3 font-bold text-slate-900">{ord.quantity} kWh</td>
                          <td className="py-3 font-semibold text-slate-700">₹{ord.price.toFixed(2)}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-slate-700 w-8">{ord.filled}%</span>
                              <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${ord.filled}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ord.status === 'Filled' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                            }`}>
                              {ord.status}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <button
                              onClick={() => setSellOrders(sellOrders.filter(o => o.id !== ord.id))}
                              className="text-[11px] font-bold text-rose-500 hover:text-rose-700 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              TAB 4: GRID OPERATOR DASHBOARD (Middle-Center Mockup)
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'operator' && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Grid Operator Dashboard</h1>
                <p className="text-xs text-slate-500 mt-0.5">Monitor feeder health, ensure stability, and approve trades.</p>
              </div>

              {/* 4 Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Feeders</span>
                  <span className="text-xl font-black text-slate-900 block mt-1">12</span>
                  <span className="text-[11px] font-medium text-slate-400">Regional substations</span>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Meters</span>
                  <span className="text-xl font-black text-slate-900 block mt-1">1,248</span>
                  <span className="text-[11px] font-semibold text-emerald-600">100% telemetry online</span>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Solar Capacity</span>
                  <span className="text-xl font-black text-slate-900 block mt-1">2.4 MW</span>
                  <span className="text-[11px] font-medium text-amber-600">Rooftop & community PV</span>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Approvals</span>
                  <span className="text-xl font-black text-rose-600 block mt-1">3</span>
                  <span className="text-[11px] font-bold text-rose-500">Action Needed</span>
                </div>
              </div>

              {/* Feeder Map & Health Gauge */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                
                {/* Feeder Status Map */}
                <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-slate-900">Feeder Status Map</h2>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" /> Normal
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                        <span className="w-2 h-2 rounded-full bg-amber-500" /> Warning
                      </span>
                      <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                        <span className="w-2 h-2 rounded-full bg-rose-500" /> Congested
                      </span>
                    </div>
                  </div>

                  {/* Visual Map Grid */}
                  <div className="h-64 rounded-xl border border-slate-200/80 bg-slate-50 relative overflow-hidden flex items-center justify-center">
                    <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />

                    {/* Feeder-03 Node (Congested) */}
                    <div className="absolute top-12 left-16 bg-white border border-rose-200 rounded-xl p-3 shadow-md text-center hover:scale-105 transition-transform cursor-pointer">
                      <p className="text-xs font-bold text-slate-900">Feeder-03</p>
                      <p className="text-[10px] font-bold text-rose-600 mt-0.5">92% loaded</p>
                    </div>

                    {/* Feeder-01 Node (Normal) */}
                    <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-white border-2 border-emerald-500 rounded-xl p-3.5 shadow-lg text-center hover:scale-105 transition-transform cursor-pointer">
                      <p className="text-xs font-black text-slate-900">Feeder-01</p>
                      <p className="text-[10px] font-medium text-slate-500">62% loaded</p>
                      <span className="mt-1 inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-bold">
                        ● Normal
                      </span>
                    </div>

                    {/* Feeder-02 Node (Warning) */}
                    <div className="absolute bottom-10 right-20 bg-white border border-amber-200 rounded-xl p-3 shadow-md text-center hover:scale-105 transition-transform cursor-pointer">
                      <p className="text-xs font-bold text-slate-900">Feeder-02</p>
                      <p className="text-[10px] font-bold text-amber-600 mt-0.5">78% loaded</p>
                    </div>
                  </div>
                </div>

                {/* Feeder Health Gauge */}
                <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900">Feeder Health - Feeder-01</h2>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold">Normal</span>
                  </div>

                  {/* Gauge */}
                  <div className="flex flex-col items-center py-3">
                    <div className="relative flex items-center justify-center">
                      <svg className="w-28 h-28 -rotate-90">
                        <circle cx="56" cy="56" r="46" className="stroke-slate-100" strokeWidth="8" fill="transparent" />
                        <circle
                          cx="56"
                          cy="56"
                          r="46"
                          className="stroke-emerald-500"
                          strokeWidth="8"
                          strokeDasharray={289}
                          strokeDashoffset={289 * (1 - 0.62)}
                          strokeLinecap="round"
                          fill="transparent"
                        />
                      </svg>
                      <span className="absolute text-xl font-black text-slate-900">62%</span>
                    </div>
                  </div>

                  {/* Substation Specs */}
                  <div className="space-y-1.5 text-xs pt-2 border-t border-slate-100">
                    <div className="flex justify-between text-slate-500">
                      <span>Capacity:</span>
                      <span className="font-bold text-slate-800">100 MW</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Current Load:</span>
                      <span className="font-bold text-slate-800">62 MW</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Voltage:</span>
                      <span className="font-bold text-slate-800">11.2 kV</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Frequency:</span>
                      <span className="font-bold text-slate-800">50.01 Hz</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Active Meters:</span>
                      <span className="font-bold text-slate-800">142</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Solar Capacity:</span>
                      <span className="font-bold text-amber-600">420 kW</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Grid Alerts & Pending Approvals */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Recent Grid Alerts */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900 mb-3">Recent Grid Alerts</h2>
                  <div className="space-y-2">
                    <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-rose-900">Feeder-03</span>
                        <span className="text-[10px] text-rose-600 block">Peak transformer load exceeded (92%)</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-rose-200/60 text-rose-800 text-[10px] font-bold">
                        Congested
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-amber-900">Feeder-07</span>
                        <span className="text-[10px] text-amber-600 block">High reverse power flow (85%)</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-amber-200/60 text-amber-800 text-[10px] font-bold">
                        Warning
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pending Trade Approvals */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
                  <h2 className="text-sm font-bold text-slate-900 mb-3">Pending Trade Approvals</h2>
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-800">12 kWh • Feeder-03</p>
                        <p className="text-[10px] text-slate-400">SunRise Rooftop Array → Consumer Node #1024</p>
                      </div>
                      <button
                        onClick={() => alert('Trade approved by DISCOM operator')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 cursor-pointer"
                      >
                        Review
                      </button>
                    </div>
                    <div className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-800">8 kWh • Feeder-07</p>
                        <p className="text-[10px] text-slate-400">Sector-4 Solar Trust → Consumer Node #2048</p>
                      </div>
                      <button
                        onClick={() => alert('Trade approved by DISCOM operator')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 cursor-pointer"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════
              NEXT-GEN REFERENCE SYNTHESIS VIEWS
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'solar_forecast' && (
            <div className="space-y-6 animate-fade-in">
              <SolarForecastView feederId={selectedFeeder} marketPrice={4.20} />
            </div>
          )}

          {activeTab === 'double_auction' && (
            <div className="space-y-6 animate-fade-in">
              <DoubleAuctionView clearingPrice={4.15} />
            </div>
          )}

          {activeTab === 'iot_meter' && (
            <div className="space-y-6 animate-fade-in">
              <IoTMeterView feederId={selectedFeeder} />
            </div>
          )}

          {activeTab === 'carbon_impact' && (
            <div className="space-y-6 animate-fade-in">
              <CarbonImpactView feederId={selectedFeeder} />
            </div>
          )}

          {activeTab === 'blockchain' && (
            <div className="space-y-6 animate-fade-in">
              <BlockchainLedgerView
                blockchainProof={blockchainProof}
                onOpenProofModal={() => setIsBlockchainOpen(true)}
              />
            </div>
          )}

        </main>
      </div>

      {/* ── MODALS (Exact Mockup Match) ────────────────────────────── */}
      <InvoiceModal
        settlement={null}
        isOpen={isInvoiceOpen}
        onClose={() => setIsInvoiceOpen(false)}
        onViewBlockchain={() => {
          setIsInvoiceOpen(false)
          setBlockchainProof({
            status: 'success',
            network: 'Polygon Mainnet',
            chain_id: 137,
            contract_address: '0x1a2b3c4d5e6f7g8h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z',
            tx_hash: '0x7a3f2e1d4c5b6e7f0e9d0c1b2a3f4e5d6f7e8b9c0d1e2f3a4b5c6d7e8f9e0b1c2',
            block_number: 48581234,
            gas_used: 125432,
            audit_hash: '0x8f2d91a4',
            explorer_url: 'https://amoy.polygonscan.com/tx/0x7a3f2e1d4c5b6e7f0e9d0c1b2a3f4e5d6f7e8b9c0d1e2f3a4b5c6d7e8f9e0b1c2',
            raw_payload: '{}',
            verified: true,
          })
          setIsBlockchainOpen(true)
        }}
      />

      <BlockchainModal
        proof={blockchainProof}
        isOpen={isBlockchainOpen}
        onClose={() => setIsBlockchainOpen(false)}
      />

      {/* Sell Order Modal */}
      {sellModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Create Solar Sell Order</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Energy Quantity (kWh)</label>
                <input
                  type="number"
                  value={newOrderKwh}
                  onChange={(e) => setNewOrderKwh(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Price per kWh (₹)</label>
                <input
                  type="number"
                  step="0.05"
                  value={newOrderPrice}
                  onChange={(e) => setNewOrderPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-xl text-xs"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setSellModalOpen(false)}
                className="flex-1 py-2 rounded-xl bg-slate-100 font-bold text-xs text-slate-600 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setSellOrders([
                    ...sellOrders,
                    {
                      id: `ORD-${Math.floor(100 + Math.random() * 900)}`,
                      quantity: newOrderKwh,
                      price: newOrderPrice,
                      filled: 0,
                      status: 'Active',
                    },
                  ])
                  setSellModalOpen(false)
                }}
                className="flex-1 py-2 rounded-xl bg-emerald-600 font-bold text-xs text-white hover:bg-emerald-700"
              >
                Submit Order
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
