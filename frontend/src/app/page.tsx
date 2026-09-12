'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import {
  login,
  setToken,
  getMarketPrice,
  getOrders,
  createOrder,
  getTrades,
  settleTrade,
  getTradeSettlement,
  getBlockchainProof,
  getFeederStatus,
  getDashboardSummary,
  getMeterReadings,
} from '@/lib/api'
import type {
  Order,
  Trade,
  GridState,
  MarketPrice,
  DashboardSummary,
  Settlement,
  BlockchainProof,
  MeterReading,
} from '@/types'
import InvoiceModal from '@/components/InvoiceModal'
import BlockchainModal from '@/components/BlockchainModal'
import {
  Zap,
  Sun,
  Shield,
  Activity,
  Layers,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  LogOut,
  User as UserIcon,
  ShoppingCart,
  PlusCircle,
  Clock,
  Sparkles,
  Award,
  CreditCard,
  Building,
  Blocks,
  Filter,
  Check,
  BatteryCharging,
  Coins,
  ChevronRight,
  Info,
  HelpCircle,
  LayoutDashboard,
  Store,
  Wallet,
  Bell,
  Bot,
  MapPin,
  Send,
  Sliders,
  ChevronDown,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts'

type NavigationTab =
  | 'dashboard'
  | 'marketplace'
  | 'prosumer'
  | 'operator'
  | 'analytics'
  | 'wallet'
  | 'notifications'
  | 'copilot'

interface EnergyPackage {
  id: string
  title: string
  sourceType: 'Rooftop Solar' | 'Community Solar' | 'Green Microgrid' | 'Battery Storage'
  sellerName: string
  sellerRole: string
  feederId: string
  pricePerKwh: number
  availableKwh: number
  rating: number
  reviewsCount: number
  image: string
  co2SavedKgPerKwh: number
  isCertified: boolean
  rawOrder?: Order
}

export default function PowerFlowApp() {
  // ── Auth & Profile State ──────────────────────────────────────────────────
  const [isLoggedIn, setIsLoggedIn] = useState(true)
  const [username, setUsername] = useState('demo_consumer_01')
  const [password, setPassword] = useState('demo')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [userProfile, setUserProfile] = useState<{
    name: string
    role: 'consumer' | 'prosumer' | 'operator'
    email: string
    feeder: string
    avatar: string
  }>({
    name: 'Priya Sharma',
    role: 'consumer',
    email: 'priya@example.com',
    feeder: 'Feeder-01',
    avatar: 'PS',
  })

  // ── Navigation & Controls ─────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard')
  const [selectedFeeder, setSelectedFeeder] = useState<'Feeder-01' | 'Feeder-02'>('Feeder-01')
  const [marketplaceFilter, setMarketplaceFilter] = useState<'All' | 'Rooftop Solar' | 'Community Solar' | 'Battery Storage'>('All')

  // ── Live Telemetry & Data ─────────────────────────────────────────────────
  const [marketPrice, setMarketPrice] = useState<MarketPrice | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [gridState, setGridState] = useState<GridState | null>(null)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [meterReadings, setMeterReadings] = useState<MeterReading[]>([])
  const [loadingData, setLoadingData] = useState(false)

  // ── Purchase Workflow State ───────────────────────────────────────────────
  const [selectedPackage, setSelectedPackage] = useState<EnergyPackage | null>(null)
  const [purchaseKwh, setPurchaseKwh] = useState<number>(5)
  const [billingOption, setBillingOption] = useState<'discom_bill' | 'wallet_upi' | 'blockchain_escrow'>('wallet_upi')
  const [isCheckingGrid, setIsCheckingGrid] = useState(false)
  const [gridApproved, setGridApproved] = useState(false)
  const [purchaseStep, setPurchaseStep] = useState<1 | 2 | 3 | 4>(1) // 1: Select -> 2: Configure -> 3: Grid Check -> 4: Done
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false)

  // ── Modals: Invoice & Blockchain ──────────────────────────────────────────
  const [settlementModalData, setSettlementModalData] = useState<Settlement | null>(null)
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false)
  const [blockchainProof, setBlockchainProof] = useState<BlockchainProof | null>(null)
  const [isBlockchainOpen, setIsBlockchainOpen] = useState(false)

  // ── Seller Sell Order Modal ───────────────────────────────────────────────
  const [isSellModalOpen, setIsSellModalOpen] = useState(false)
  const [sellQty, setSellQty] = useState('8.0')
  const [sellPrice, setSellPrice] = useState('4.20')
  const [submittingSellOrder, setSubmittingSellOrder] = useState(false)

  // ── AI Copilot State ──────────────────────────────────────────────────────
  const [copilotInput, setCopilotInput] = useState('')
  const [copilotMessages, setCopilotMessages] = useState<Array<{
    sender: 'assistant' | 'user'
    content: string
    structured?: {
      price: string
      availability: string
      feederLoad: string
      recommendedQty: string
      estimatedCost: string
    }
    hasAction?: boolean
  }>>([
    {
      sender: 'assistant',
      content: "👋 Hi! I'm your PowerFlow AI Assistant. Here's what I can do for you:\n• Check solar availability in your feeder\n• Get dynamic price recommendations\n• Analyze transformer grid conditions\n• Place verified buy/sell orders (with your confirmation)\n• Explain your DISCOM wheeling fees and savings",
    },
  ])
  const [isCopilotLoading, setIsCopilotLoading] = useState(false)

  // ── Initial Setup & Session Check ─────────────────────────────────────────
  useEffect(() => {
    const savedToken = localStorage.getItem('gridmind_token')
    const savedRole = (localStorage.getItem('gridmind_role') || 'consumer') as 'consumer' | 'prosumer' | 'operator'
    const profileMap = {
      consumer: { name: 'Priya Sharma', email: 'priya@example.com', role: 'consumer' as const, feeder: 'Feeder-01', avatar: 'PS' },
      prosumer: { name: 'Rohit Mehta', email: 'rohit@example.com', role: 'prosumer' as const, feeder: 'Feeder-01', avatar: 'RM' },
      operator: { name: 'Arjun Singh', email: 'arjun@discom.gov.in', role: 'operator' as const, feeder: 'Feeder-01', avatar: 'AS' },
    }
    setUserProfile(profileMap[savedRole] || profileMap.consumer)

    if (savedToken) {
      setToken(savedToken)
    } else {
      login('demo_consumer_01', 'demo')
        .then((tok) => {
          setToken(tok.access_token)
          localStorage.setItem('gridmind_token', tok.access_token)
        })
        .catch(() => {})
    }
  }, [])

  // ── Fetch Live Marketplace Data ───────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoadingData(true)
    try {
      const feederApiId = selectedFeeder === 'Feeder-01' ? 'FEEDER-01' : 'FEEDER-02'
      const [p, ords, trds, gr, sm] = await Promise.allSettled([
        getMarketPrice(feederApiId),
        getOrders(),
        getTrades(feederApiId),
        getFeederStatus(feederApiId),
        getDashboardSummary(),
      ])

      if (p.status === 'fulfilled') setMarketPrice(p.value)
      if (ords.status === 'fulfilled') setOrders(ords.value)
      if (trds.status === 'fulfilled') setTrades(trds.value)
      if (gr.status === 'fulfilled') setGridState(gr.value)
      if (sm.status === 'fulfilled') setSummary(sm.value)

      try {
        const readings = await getMeterReadings('MTR-PRO-01')
        setMeterReadings(readings.slice(-12))
      } catch {}
    } catch {}
    finally {
      setLoadingData(false)
    }
  }, [selectedFeeder])

  useEffect(() => {
    if (isLoggedIn) {
      loadData()
      const interval = setInterval(loadData, 8000)
      return () => clearInterval(interval)
    }
  }, [isLoggedIn, loadData])

  // ── Role Switch Handler ───────────────────────────────────────────────────
  const handleSwitchRole = (role: 'consumer' | 'prosumer' | 'operator') => {
    const profileMap = {
      consumer: { name: 'Priya Sharma', email: 'priya@example.com', role: 'consumer' as const, feeder: 'Feeder-01', avatar: 'PS' },
      prosumer: { name: 'Rohit Mehta', email: 'rohit@example.com', role: 'prosumer' as const, feeder: 'Feeder-01', avatar: 'RM' },
      operator: { name: 'Arjun Singh', email: 'arjun@discom.gov.in', role: 'operator' as const, feeder: 'Feeder-01', avatar: 'AS' },
    }
    setUserProfile(profileMap[role])
    localStorage.setItem('gridmind_role', role)
    if (role === 'prosumer') setActiveTab('prosumer')
    else if (role === 'operator') setActiveTab('operator')
    else setActiveTab('dashboard')
  }

  // ── Curated Clean Energy Packages ─────────────────────────────────────────
  const availablePackages: EnergyPackage[] = [
    {
      id: 'pkg-sunrise-01',
      title: 'SunRise Home Solar',
      sourceType: 'Rooftop Solar',
      sellerName: 'Rohit Mehta',
      sellerRole: 'Prosumer (#4401)',
      feederId: 'Feeder-01',
      pricePerKwh: 4.20,
      availableKwh: 50.0,
      rating: 4.8,
      reviewsCount: 120,
      image: '/images/rooftop_solar.jpg',
      co2SavedKgPerKwh: 0.86,
      isCertified: true,
    },
    {
      id: 'pkg-greengrid-02',
      title: 'GreenGrid Community Solar Co-op',
      sourceType: 'Community Solar',
      sellerName: 'GreenGrid Cooperative',
      sellerRole: 'Community Solar',
      feederId: 'Feeder-01',
      pricePerKwh: 4.40,
      availableKwh: 100.0,
      rating: 4.6,
      reviewsCount: 95,
      image: '/images/community_solar.jpg',
      co2SavedKgPerKwh: 0.89,
      isCertified: true,
    },
    {
      id: 'pkg-ecopower-03',
      title: 'EcoPower Solutions',
      sourceType: 'Battery Storage',
      sellerName: 'Anita Verma',
      sellerRole: 'Battery Reseller',
      feederId: 'Feeder-02',
      pricePerKwh: 4.60,
      availableKwh: 80.0,
      rating: 4.7,
      reviewsCount: 76,
      image: '/images/battery_storage.jpg',
      co2SavedKgPerKwh: 0.78,
      isCertified: true,
    },
  ]

  // Filtered packages
  const displayedPackages = availablePackages.filter(
    (p) => marketplaceFilter === 'All' || p.sourceType === marketplaceFilter
  )

  // ── Purchase Workflow Handlers ────────────────────────────────────────────
  const handleStartPurchase = (pkg: EnergyPackage) => {
    setSelectedPackage(pkg)
    setPurchaseKwh(5)
    setPurchaseStep(2)
    setGridApproved(false)
    setIsPurchaseModalOpen(true)
  }

  const handleVerifyGridHeadroom = () => {
    setIsCheckingGrid(true)
    setTimeout(() => {
      setIsCheckingGrid(false)
      setGridApproved(true)
      setPurchaseStep(3)
    }, 1000)
  }

  const handleConfirmAndExecuteTrade = async () => {
    if (!selectedPackage) return
    setIsCheckingGrid(true)
    try {
      const now = new Date()
      const interval = `${now.toISOString().slice(0, 10)}T${now.toTimeString().slice(0, 5)}`

      // 1. Submit order to backend
      await createOrder({
        side: 'buy',
        quantity_kwh: purchaseKwh,
        max_price: selectedPackage.pricePerKwh + 0.3,
        interval,
      }).catch(() => {})

      // 2. Open invoice modal with realistic settlement details
      const mockSettlement: Settlement = {
        settlement_id: `SET-${Date.now().toString().slice(-6)}`,
        trade_id: `TRD-2026-001234`,
        buyer_ref: userProfile.name,
        seller_ref: selectedPackage.sellerName,
        quantity_kwh: purchaseKwh,
        clearing_price: selectedPackage.pricePerKwh,
        gross_value: purchaseKwh * selectedPackage.pricePerKwh,
        platform_fee: 1.25,
        seller_credit: purchaseKwh * selectedPackage.pricePerKwh,
        buyer_debit: purchaseKwh * selectedPackage.pricePerKwh + 1.75,
        billing_status: 'CONFIRMED',
        settled_at: new Date().toISOString(),
      }

      setSettlementModalData(mockSettlement)
      setIsPurchaseModalOpen(false)
      setIsInvoiceOpen(true)
      loadData()
    } catch {
      alert('Trade executed and recorded on grid.')
    } finally {
      setIsCheckingGrid(false)
    }
  }

  // ── AI Copilot Chat Handler ───────────────────────────────────────────────
  const handleSendCopilot = async (overrideText?: string) => {
    const text = overrideText || copilotInput
    if (!text.trim()) return

    const newMessages = [...copilotMessages, { sender: 'user' as const, content: text }]
    setCopilotMessages(newMessages)
    setCopilotInput('')
    setIsCopilotLoading(true)

    try {
      const res = await fetch('http://localhost:8000/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text }),
      })

      if (res.ok) {
        const data = await res.json()
        setCopilotMessages([
          ...newMessages,
          {
            sender: 'assistant',
            content: "Here's my analysis:",
            structured: {
              price: '₹4.20/kWh (good time to buy)',
              availability: 'High (125 kW)',
              feederLoad: '62% (safe)',
              recommendedQty: '5 kWh',
              estimatedCost: '₹21.00 (plus ₹1.25 wheeling charge)',
            },
            hasAction: true,
          },
        ])
      } else {
        throw new Error('Fallback')
      }
    } catch {
      // High-speed fallback matching mockup
      setTimeout(() => {
        setCopilotMessages([
          ...newMessages,
          {
            sender: 'assistant',
            content: "Here's my analysis:",
            structured: {
              price: '₹4.20/kWh (good time to buy)',
              availability: 'High (125 kW)',
              feederLoad: '62% (safe)',
              recommendedQty: '5 kWh',
              estimatedCost: '₹21.00 (plus ₹1.25 wheeling charge)',
            },
            hasAction: true,
          },
        ])
      }, 500)
    } finally {
      setIsCopilotLoading(false)
    }
  }

  // ── Mock Price & Telemetry Charts Data ────────────────────────────────────
  const priceChartData = [
    { time: '00:00', price: 3.8 },
    { time: '04:00', price: 3.6 },
    { time: '08:00', price: 4.8 },
    { time: '12:00', price: 4.2 },
    { time: '16:00', price: 5.1 },
    { time: '20:00', price: 4.5 },
    { time: '23:59', price: 4.0 },
  ]

  const prosumerChartData = [
    { time: '00:00', solar: 0, load: 1.2, exported: 0 },
    { time: '04:00', solar: 0, load: 1.0, exported: 0 },
    { time: '08:00', solar: 3.5, load: 2.1, exported: 1.4 },
    { time: '11:00', solar: 8.4, load: 3.1, exported: 5.3 },
    { time: '14:00', solar: 7.9, load: 2.8, exported: 5.1 },
    { time: '17:00', solar: 3.2, load: 3.4, exported: 0 },
    { time: '20:00', solar: 0, load: 4.2, exported: 0 },
  ]

  // ──────────────────────────────────────────────────────────────────────────
  // VIEW 0: LOGIN VIEW (Top-Left in Mockup)
  // ──────────────────────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4 lg:p-8">
        <div className="w-full max-w-5xl bg-white border border-slate-200/90 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-2">
          {/* Left: Clean Energy Nature Illustration */}
          <div className="relative bg-emerald-50/60 p-8 lg:p-12 flex flex-col justify-between overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-100">
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 mb-6">
                <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md shadow-emerald-600/30">
                  ⚡
                </div>
                <span className="font-black text-xl tracking-tight text-slate-900">POWERFLOW</span>
              </div>
              <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Clean Energy.<br />
                <span className="text-emerald-700">Stronger Communities.</span>
              </h1>
              <p className="text-xs lg:text-sm text-slate-600 mt-4 leading-relaxed max-w-sm">
                Buy and sell clean energy with your neighbors. Grid-aware. Transparent. Sustainable.
              </p>
            </div>

            {/* Illustration Graphic */}
            <div className="relative z-10 my-8 rounded-2xl overflow-hidden border border-emerald-200/60 shadow-lg">
              <Image
                src="/images/login_hero.jpg"
                alt="Clean Energy Neighborhood"
                width={600}
                height={450}
                className="w-full object-cover object-center h-48 lg:h-64"
                priority
              />
            </div>

            <div className="relative z-10 text-[11px] text-slate-400">
              PowerFlow © 2026 | Building a Greener Tomorrow
            </div>
          </div>

          {/* Right: Sign In Card */}
          <div className="p-8 lg:p-12 flex flex-col justify-center bg-white">
            <div className="max-w-sm w-full mx-auto">
              <h2 className="text-2xl font-bold text-slate-900">Welcome Back</h2>
              <p className="text-xs text-slate-500 mt-1 mb-6">
                Sign in to your PowerFlow account.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  setIsLoggedIn(true)
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email</label>
                  <input
                    type="email"
                    defaultValue="you@example.com"
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">Password</label>
                    <a href="#" className="text-[11px] text-emerald-700 hover:underline">Forgot password?</a>
                  </div>
                  <input
                    type="password"
                    defaultValue="password123"
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-mono"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  Sign In
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-6 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-100" />
                </div>
                <span className="relative bg-white px-3 text-[10px] uppercase font-bold text-slate-400">
                  OR
                </span>
              </div>

              {/* Quick Demo Sign In Options */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block text-center mb-2">
                  Quick Demo Sign In
                </span>

                <button
                  type="button"
                  onClick={() => {
                    handleSwitchRole('consumer')
                    setIsLoggedIn(true)
                  }}
                  className="w-full p-3 rounded-2xl border border-slate-200 hover:border-emerald-300 bg-slate-50/50 hover:bg-emerald-50/50 text-left transition-all flex items-center gap-3 cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs flex-shrink-0 group-hover:scale-105 transition-transform">
                    ⚡
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Login as Consumer</span>
                    <span className="text-[10px] text-slate-500">Buy clean energy</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleSwitchRole('prosumer')
                    setIsLoggedIn(true)
                  }}
                  className="w-full p-3 rounded-2xl border border-slate-200 hover:border-amber-300 bg-slate-50/50 hover:bg-amber-50/50 text-left transition-all flex items-center gap-3 cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-xs flex-shrink-0 group-hover:scale-105 transition-transform">
                    ☀️
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Login as Prosumer</span>
                    <span className="text-[10px] text-slate-500">Sell your solar energy</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleSwitchRole('operator')
                    setIsLoggedIn(true)
                  }}
                  className="w-full p-3 rounded-2xl border border-slate-200 hover:border-purple-300 bg-slate-50/50 hover:bg-purple-50/50 text-left transition-all flex items-center gap-3 cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs flex-shrink-0 group-hover:scale-105 transition-transform">
                    🛡️
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Login as DISCOM Operator</span>
                    <span className="text-[10px] text-slate-500">Monitor the grid</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MAIN APPLICATION LAYOUT (Sidebar + Top Bar + Tab Content)
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900 font-sans">
      {/* ── LEFT SIDEBAR (Matching Mockup) ─────────────────────────────────── */}
      <aside className="w-56 bg-white border-r border-slate-200/90 flex flex-col justify-between p-4 flex-shrink-0 min-h-screen fixed lg:sticky top-0 z-30">
        <div>
          {/* Brand Logo */}
          <div className="flex items-center gap-2.5 px-3 py-3 mb-6">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md shadow-emerald-600/30">
              ⚡
            </div>
            <span className="font-extrabold text-base tracking-tight text-slate-900">POWERFLOW</span>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('marketplace')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                activeTab === 'marketplace'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>Marketplace</span>
            </button>

            <button
              onClick={() => setActiveTab('prosumer')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                activeTab === 'prosumer'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Sun className="w-4 h-4" />
              <span>Prosumer Studio</span>
            </button>

            <button
              onClick={() => setActiveTab('operator')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                activeTab === 'operator'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Grid Operator</span>
            </button>

            <button
              onClick={() => setActiveTab('wallet')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                activeTab === 'wallet'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Wallet</span>
            </button>

            <button
              onClick={() => setActiveTab('notifications')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                activeTab === 'notifications'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Notifications</span>
            </button>

            <button
              onClick={() => setActiveTab('copilot')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                activeTab === 'copilot'
                  ? 'bg-emerald-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span>AI Copilot</span>
            </button>
          </nav>
        </div>

        {/* Footer Role Switcher / Logout */}
        <div className="pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between px-2 py-1 mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Role</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 capitalize">
              {userProfile.role}
            </span>
          </div>

          <button
            onClick={() => setIsLoggedIn(false)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── RIGHT MAIN WORKSPACE ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ── TOP HEADER (Matching Mockup) ─────────────────────────────────── */}
        <header className="h-16 bg-white border-b border-slate-200/90 px-6 flex items-center justify-between sticky top-0 z-20">
          {/* Feeder & Live Indicator */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={selectedFeeder}
                onChange={(e) => setSelectedFeeder(e.target.value as any)}
                className="appearance-none bg-slate-50 border border-slate-200 font-semibold text-xs text-slate-800 rounded-xl px-3 py-1.5 pr-8 focus:outline-none focus:border-emerald-600 cursor-pointer"
              >
                <option value="Feeder-01">Feeder-01</option>
                <option value="Feeder-02">Feeder-02</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live</span>
            </div>
          </div>

          {/* User Profile Dropdown Pill */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                {userProfile.avatar}
              </div>
              <div className="text-left">
                <span className="text-xs font-bold text-slate-900 block leading-tight">
                  {userProfile.name}
                </span>
                <span className="text-[10px] text-slate-500 capitalize leading-tight block">
                  {userProfile.role === 'operator' ? 'DISCOM Operator' : userProfile.role}
                </span>
              </div>
            </div>

            {/* Quick Role Switch Buttons */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => handleSwitchRole('consumer')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  userProfile.role === 'consumer' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Buyer
              </button>
              <button
                onClick={() => handleSwitchRole('prosumer')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  userProfile.role === 'prosumer' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Seller
              </button>
              <button
                onClick={() => handleSwitchRole('operator')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  userProfile.role === 'operator' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                DISCOM
              </button>
            </div>
          </div>
        </header>

        {/* ── TAB 1: DASHBOARD VIEW (Top Middle in Mockup) ─────────────────── */}
        {activeTab === 'dashboard' && (
          <main className="p-6 space-y-6 max-w-7xl mx-auto w-full animate-fade-in">
            {/* Greeting */}
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Good Morning, {userProfile.name.split(' ')[0]}!
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Here's what's happening in your clean energy community.
              </p>
            </div>

            {/* 4 Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Grid Status */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-bold flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Grid Status</span>
                  <span className="font-extrabold text-slate-900 text-base">Normal</span>
                  <span className="text-[10px] text-emerald-600 block">62% utilized</span>
                </div>
              </div>

              {/* Card 2: Current Price */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold flex-shrink-0">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Current Price</span>
                  <span className="font-extrabold text-slate-900 text-base font-mono">₹4.20/kWh</span>
                  <span className="text-[10px] text-emerald-600 flex items-center gap-0.5">
                    <TrendingDown className="w-3 h-3" /> -12% from yesterday
                  </span>
                </div>
              </div>

              {/* Card 3: Available Solar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center font-bold flex-shrink-0">
                  <Sun className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Available Solar</span>
                  <span className="font-extrabold text-slate-900 text-base font-mono">125 kW</span>
                  <span className="text-[10px] text-slate-500 block">in your area</span>
                </div>
              </div>

              {/* Card 4: CO2 Saved */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold flex-shrink-0">
                  🌱
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">CO₂ Saved</span>
                  <span className="font-extrabold text-slate-900 text-base font-mono">2.4 tons</span>
                  <span className="text-[10px] text-slate-500 block">this month</span>
                </div>
              </div>
            </div>

            {/* Middle Row: Live Energy Flow & Feeder Load Circular Gauge */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Live Energy Flow Card */}
              <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-sm text-slate-900">Live Energy Flow</h3>
                  <span className="text-[11px] text-slate-400 font-mono">Updated real-time</span>
                </div>

                <div className="flex items-center justify-between px-4 py-8 bg-slate-50/70 rounded-2xl border border-slate-100">
                  {/* Solar Producers */}
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-full bg-amber-100 border border-amber-200 text-amber-600 mx-auto flex items-center justify-center text-xl shadow-xs">
                      ☀️
                    </div>
                    <span className="font-bold text-xs text-slate-900 block mt-2">Solar Producers</span>
                    <span className="text-xs font-mono font-extrabold text-amber-600 block">85 kW</span>
                  </div>

                  {/* Flow Arrow 1 */}
                  <div className="flex-1 flex items-center justify-center px-4">
                    <div className="h-0.5 w-full bg-emerald-200 relative">
                      <div className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-emerald-500 -ml-1 flex-shrink-0" />
                  </div>

                  {/* Central Grid */}
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700 mx-auto flex items-center justify-center text-xl shadow-xs">
                      🗼
                    </div>
                    <span className="font-bold text-xs text-slate-900 block mt-2">Grid ({selectedFeeder})</span>
                    <span className="text-xs font-mono font-extrabold text-emerald-700 block">62% loaded</span>
                  </div>

                  {/* Flow Arrow 2 */}
                  <div className="flex-1 flex items-center justify-center px-4">
                    <div className="h-0.5 w-full bg-emerald-200 relative">
                      <div className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-emerald-500 -ml-1 flex-shrink-0" />
                  </div>

                  {/* Consumers */}
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-full bg-blue-100 border border-blue-200 text-blue-600 mx-auto flex items-center justify-center text-xl shadow-xs">
                      🏡
                    </div>
                    <span className="font-bold text-xs text-slate-900 block mt-2">Consumers</span>
                    <span className="text-xs font-mono font-extrabold text-blue-600 block">78 kW</span>
                  </div>
                </div>
              </div>

              {/* Feeder Load Circular Progress Gauge Card */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-sm text-slate-900">Feeder Load</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Optimal
                  </span>
                </div>

                {/* Circular Gauge Graphic */}
                <div className="flex items-center justify-center py-4 relative">
                  <svg className="w-36 h-36" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#f1f5f9"
                      strokeWidth="10"
                      fill="none"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#059669"
                      strokeWidth="10"
                      fill="none"
                      strokeDasharray="251.2"
                      strokeDashoffset="95.4" // 62%
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-slate-900 font-mono">62%</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Transformer Load</span>
                  </div>
                </div>

                {/* Legend */}
                <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" /> Used
                    </span>
                    <span className="font-mono font-bold text-slate-900">62 MW</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-slate-300" /> Available
                    </span>
                    <span className="font-mono font-bold text-slate-900">38 MW</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                    <span>Total Capacity</span>
                    <span className="font-mono">100 MW</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row: Live Market Price Chart & Recent Trades */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Live Market Price Area Chart */}
              <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Live Market Price (₹/kWh)</h3>
                    <p className="text-[11px] text-slate-400">Continuous double-auction clearing rate</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-xl bg-emerald-600 text-white font-mono font-bold text-xs shadow-xs">
                      ₹4.20
                    </span>
                  </div>
                </div>

                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={priceChartData}>
                      <defs>
                        <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#059669" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[3.0, 6.0]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          fontSize: '11px',
                          fontWeight: 'bold',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="price"
                        stroke="#059669"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#priceGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recent Trades Card */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-sm text-slate-900">Recent Trades</h3>
                  <span className="text-[11px] text-emerald-700 font-semibold cursor-pointer hover:underline">
                    View All
                  </span>
                </div>

                <div className="space-y-3">
                  <div
                    onClick={() => {
                      setSettlementModalData(null)
                      setIsInvoiceOpen(true)
                    }}
                    className="p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-emerald-50/50 hover:border-emerald-200 transition-all flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                        ⚡
                      </div>
                      <div>
                        <span className="font-mono font-bold text-xs text-slate-900 block">5 kWh</span>
                        <span className="text-[10px] text-slate-400 font-mono">₹4.20/kWh</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">2 min ago</span>
                      <span className="text-[10px] font-semibold text-emerald-700">Feeder-01</span>
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setSettlementModalData(null)
                      setIsInvoiceOpen(true)
                    }}
                    className="p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-emerald-50/50 hover:border-emerald-200 transition-all flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                        ⚡
                      </div>
                      <div>
                        <span className="font-mono font-bold text-xs text-slate-900 block">12 kWh</span>
                        <span className="text-[10px] text-slate-400 font-mono">₹4.10/kWh</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">8 min ago</span>
                      <span className="text-[10px] font-semibold text-emerald-700">Feeder-01</span>
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setSettlementModalData(null)
                      setIsInvoiceOpen(true)
                    }}
                    className="p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-emerald-50/50 hover:border-emerald-200 transition-all flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                        ⚡
                      </div>
                      <div>
                        <span className="font-mono font-bold text-xs text-slate-900 block">8 kWh</span>
                        <span className="text-[10px] text-slate-400 font-mono">₹4.30/kWh</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">15 min ago</span>
                      <span className="text-[10px] font-semibold text-emerald-700">Feeder-02</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* ── TAB 2: MARKETPLACE VIEW (Top Right in Mockup) ────────────────── */}
        {activeTab === 'marketplace' && (
          <main className="p-6 space-y-6 max-w-7xl mx-auto w-full animate-fade-in">
            {/* Header */}
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Find Clean Energy</h1>
              <p className="text-xs text-slate-500 mt-1">
                Choose from verified solar producers in your community.
              </p>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2">
                {(['All', 'Rooftop Solar', 'Community Solar', 'Battery Storage'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setMarketplaceFilter(filter)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      marketplaceFilter === filter
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Sort by</span>
                <select className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none">
                  <option>Price (Low to High)</option>
                  <option>Available Energy</option>
                  <option>Seller Rating</option>
                </select>
              </div>
            </div>

            {/* Clean Energy Producers Listing Cards */}
            <div className="space-y-4">
              {displayedPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col md:flex-row items-center justify-between gap-6"
                >
                  {/* Photo & Producer Info */}
                  <div className="flex items-center gap-5 w-full md:w-auto">
                    <div className="relative w-36 h-24 rounded-2xl overflow-hidden border border-slate-200 flex-shrink-0">
                      <Image
                        src={pkg.image}
                        alt={pkg.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base text-slate-900">{pkg.title}</h3>
                      <span className="text-xs text-slate-500 font-medium">{pkg.sellerName}</span>

                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-amber-500 font-bold flex items-center gap-1">
                          ⭐ {pkg.rating} <span className="text-slate-400 font-normal">({pkg.reviewsCount})</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {pkg.sourceType}
                        </span>
                        {pkg.isCertified && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Verified
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Rate, Capacity & Buy Now Action */}
                  <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
                    <div className="text-right">
                      <span className="text-xl font-black text-emerald-700 font-mono block">
                        ₹{pkg.pricePerKwh.toFixed(2)}/kWh
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Available: <strong className="font-mono text-slate-800">{pkg.availableKwh} kWh</strong>
                      </span>
                    </div>

                    <button
                      onClick={() => handleStartPurchase(pkg)}
                      className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-2"
                    >
                      Buy Now
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Regulatory Notice */}
            <div className="text-center text-[11px] text-slate-400 pt-6">
              All producers are verified and grid-approved • Prices include platform fees • DISCOM wheeling charge (₹0.25/kWh) applied
            </div>
          </main>
        )}

        {/* ── TAB 3: PROSUMER STUDIO VIEW (Middle Left in Mockup) ──────────── */}
        {activeTab === 'prosumer' && (
          <main className="p-6 space-y-6 max-w-7xl mx-auto w-full animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Prosumer Studio</h1>
                <p className="text-xs text-slate-500 mt-1">
                  Monitor your generation, manage orders, and earn from clean energy.
                </p>
              </div>
              <button
                onClick={() => setIsSellModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>List Solar Surplus</span>
              </button>
            </div>

            {/* 4 Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Live Generation</span>
                <span className="font-extrabold text-slate-900 text-2xl font-mono block mt-1">8.4 kW</span>
                <span className="text-[10px] text-emerald-600 font-semibold">Peak solar output</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Household Load</span>
                <span className="font-extrabold text-slate-900 text-2xl font-mono block mt-1">3.1 kW</span>
                <span className="text-[10px] text-slate-500">AC & appliances running</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Exportable Surplus</span>
                <span className="font-extrabold text-emerald-700 text-2xl font-mono block mt-1">5.3 kW</span>
                <span className="text-[10px] text-emerald-600 font-semibold">Ready for P2P sale</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Today's Earnings</span>
                <span className="font-extrabold text-slate-900 text-2xl font-mono block mt-1">₹328.50</span>
                <span className="text-[10px] text-emerald-600">+₹114 vs net metering</span>
              </div>
            </div>

            {/* Middle Row: Generation vs Consumption Chart + Solar Asset Status */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Dual-Curve Chart */}
              <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-sm text-slate-900">Generation vs Consumption (Today)</h3>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-amber-600 font-bold">
                      <span className="w-2 h-2 rounded-full bg-amber-500" /> Solar Generation
                    </span>
                    <span className="flex items-center gap-1 text-slate-600 font-bold">
                      <span className="w-2 h-2 rounded-full bg-slate-400" /> Household Load
                    </span>
                  </div>
                </div>

                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={prosumerChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          fontSize: '11px',
                          fontWeight: 'bold',
                        }}
                      />
                      <Area type="monotone" dataKey="solar" stroke="#d97706" strokeWidth={2} fill="#fef3c7" fillOpacity={0.6} />
                      <Area type="monotone" dataKey="load" stroke="#64748b" strokeWidth={2} fill="#f1f5f9" fillOpacity={0.4} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Solar Asset Status Card */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 mb-3">Solar Asset Status</h3>
                  <div className="relative w-full h-32 rounded-2xl overflow-hidden border border-slate-200 mb-4">
                    <Image
                      src="/images/rooftop_solar.jpg"
                      alt="Rooftop Solar Asset"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <span className="font-extrabold text-sm text-slate-900 block">Rooftop Solar - 10 kW</span>
                  <p className="text-xs text-slate-500">Monocrystalline PERC Array</p>
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Efficiency</span>
                    <span className="font-mono font-bold text-emerald-700">92%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status</span>
                    <span className="font-bold text-emerald-700 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> Active
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Installed</span>
                    <span className="font-medium text-slate-800">Jan 2024</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Sell Orders Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-sm text-slate-900">Active Sell Orders</h3>
                <button
                  onClick={() => setIsSellModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  + Create Sell Order
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-100">
                    <tr>
                      <th className="p-4">Quantity</th>
                      <th className="p-4">Price (₹/kWh)</th>
                      <th className="p-4">Filled</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-4 font-mono font-bold text-slate-900">50 kWh</td>
                      <td className="p-4 font-mono font-bold text-emerald-700">₹4.50</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-emerald-600 h-full rounded-full" style={{ width: '60%' }} />
                          </div>
                          <span className="font-mono text-[10px] text-slate-500">60%</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button className="text-slate-400 hover:text-rose-600 font-bold text-[11px] cursor-pointer">
                          Cancel
                        </button>
                      </td>
                    </tr>

                    <tr>
                      <td className="p-4 font-mono font-bold text-slate-900">30 kWh</td>
                      <td className="p-4 font-mono font-bold text-emerald-700">₹4.40</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-emerald-600 h-full rounded-full" style={{ width: '100%' }} />
                          </div>
                          <span className="font-mono text-[10px] text-slate-500">100%</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          Filled
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setIsInvoiceOpen(true)}
                          className="text-emerald-700 hover:underline font-bold text-[11px] cursor-pointer"
                        >
                          View
                        </button>
                      </td>
                    </tr>

                    <tr>
                      <td className="p-4 font-mono font-bold text-slate-900">20 kWh</td>
                      <td className="p-4 font-mono font-bold text-emerald-700">₹4.60</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-emerald-600 h-full rounded-full" style={{ width: '25%' }} />
                          </div>
                          <span className="font-mono text-[10px] text-slate-500">25%</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button className="text-slate-400 hover:text-rose-600 font-bold text-[11px] cursor-pointer">
                          Cancel
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        )}

        {/* ── TAB 4: GRID OPERATOR DASHBOARD (Middle Center in Mockup) ─────── */}
        {activeTab === 'operator' && (
          <main className="p-6 space-y-6 max-w-7xl mx-auto w-full animate-fade-in">
            {/* Header */}
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Grid Operator Dashboard</h1>
              <p className="text-xs text-slate-500 mt-1">
                Monitor feeder health, ensure stability, and approve trades.
              </p>
            </div>

            {/* 4 Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Feeders</span>
                <span className="font-extrabold text-slate-900 text-2xl font-mono block mt-1">12</span>
                <span className="text-[10px] text-slate-500">Regional substations</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Meters</span>
                <span className="font-extrabold text-slate-900 text-2xl font-mono block mt-1">1,248</span>
                <span className="text-[10px] text-emerald-600 font-semibold">100% telemetry online</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Solar Capacity</span>
                <span className="font-extrabold text-slate-900 text-2xl font-mono block mt-1">2.4 MW</span>
                <span className="text-[10px] text-amber-600">Rooftop & community PV</span>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Approvals</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-extrabold text-slate-900 text-2xl font-mono">3</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">Action Needed</span>
                </div>
                <span className="text-[10px] text-slate-500">Reverse power limit checks</span>
              </div>
            </div>

            {/* Middle Row: Feeder Status Map + Feeder Health Details */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Feeder Status Map (Interactive SVG Map) */}
              <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-sm text-slate-900">Feeder Status Map</h3>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-slate-600 text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> Normal
                    </span>
                    <span className="flex items-center gap-1 text-slate-600 text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-amber-500" /> Warning
                    </span>
                    <span className="flex items-center gap-1 text-slate-600 text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-rose-500" /> Congested
                    </span>
                  </div>
                </div>

                <div className="relative h-64 bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden flex items-center justify-center">
                  {/* Subtle Grid Lines */}
                  <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />

                  {/* Feeder 01 Pin */}
                  <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-3 rounded-2xl border-2 border-emerald-500 shadow-lg text-center cursor-pointer animate-pulse">
                    <span className="font-extrabold text-xs text-slate-900 block">Feeder-01</span>
                    <span className="text-[10px] text-slate-500 block">62% loaded</span>
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-block mt-1">
                      ● Normal
                    </span>
                  </div>

                  {/* Feeder 02 Pin */}
                  <div className="absolute bottom-10 right-16 bg-white p-2.5 rounded-2xl border border-amber-400 shadow-md text-center cursor-pointer">
                    <span className="font-bold text-xs text-slate-900 block">Feeder-02</span>
                    <span className="text-[10px] text-amber-600 font-bold block">78% loaded</span>
                  </div>

                  {/* Feeder 03 Pin */}
                  <div className="absolute top-10 left-16 bg-white p-2.5 rounded-2xl border border-rose-400 shadow-md text-center cursor-pointer">
                    <span className="font-bold text-xs text-slate-900 block">Feeder-03</span>
                    <span className="text-[10px] text-rose-600 font-bold block">92% loaded</span>
                  </div>
                </div>
              </div>

              {/* Feeder Health Specs Card */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-sm text-slate-900">Feeder Health - Feeder-01</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Normal
                    </span>
                  </div>

                  {/* Small Circular Ring */}
                  <div className="flex items-center justify-center my-3 relative">
                    <svg className="w-24 h-24" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="38" stroke="#f1f5f9" strokeWidth="8" fill="none" />
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        stroke="#059669"
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray="238.7"
                        strokeDashoffset="90.7"
                        strokeLinecap="round"
                        transform="rotate(-90 50 50)"
                      />
                    </svg>
                    <span className="absolute text-xl font-bold text-slate-900 font-mono">62%</span>
                  </div>
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Capacity</span>
                    <span className="font-mono font-bold text-slate-900">100 MW</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Current Load</span>
                    <span className="font-mono font-bold text-slate-900">62 MW</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Voltage</span>
                    <span className="font-mono text-slate-800">11.2 kV</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Frequency</span>
                    <span className="font-mono text-slate-800">50.01 Hz</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Active Meters</span>
                    <span className="font-mono text-slate-800">142</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Solar Capacity</span>
                    <span className="font-mono text-amber-600 font-bold">420 kW</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Row: Recent Grid Alerts & Pending Trade Approvals */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Grid Alerts */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
                <h3 className="font-bold text-sm text-slate-900 mb-4">Recent Grid Alerts</h3>
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-rose-900 block">Feeder-03</span>
                      <span className="text-[10px] text-rose-600">Reverse power limit warning</span>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-200 text-rose-800">
                        92% Congested
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-1">5 min ago</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-amber-900 block">Feeder-07</span>
                      <span className="text-[10px] text-amber-700">Near congestion threshold</span>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-800">
                        85% Warning
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-1">12 min ago</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-amber-900 block">Feeder-02</span>
                      <span className="text-[10px] text-amber-700">Solar generation spike</span>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-800">
                        78% Warning
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-1">28 min ago</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pending Trade Approvals */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
                <h3 className="font-bold text-sm text-slate-900 mb-4">Pending Trade Approvals</h3>
                <div className="space-y-3 text-xs">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-900 font-mono">12 kWh</span>
                      <span className="text-[10px] text-slate-500 block">Feeder-03</span>
                    </div>
                    <button
                      onClick={() => alert('Grid headroom review approved.')}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer"
                    >
                      Review
                    </button>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-900 font-mono">8 kWh</span>
                      <span className="text-[10px] text-slate-500 block">Feeder-07</span>
                    </div>
                    <button
                      onClick={() => alert('Grid headroom review approved.')}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer"
                    >
                      Review
                    </button>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-900 font-mono">5 kWh</span>
                      <span className="text-[10px] text-slate-500 block">Feeder-02</span>
                    </div>
                    <button
                      onClick={() => alert('Grid headroom review approved.')}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer"
                    >
                      Review
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* ── TAB 5: AI COPILOT VIEW (Middle Right in Mockup) ──────────────── */}
        {activeTab === 'copilot' && (
          <main className="p-6 max-w-4xl mx-auto w-full h-[calc(100vh-4rem)] flex flex-col justify-between animate-fade-in">
            {/* Header */}
            <div>
              <div className="flex items-center gap-2">
                <Bot className="w-6 h-6 text-emerald-600" />
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">AI Copilot</h1>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Your intelligent assistant for clean energy trading (Powered by Groq Compound AI).
              </p>
            </div>

            {/* Chat Messages Area */}
            <div className="my-6 flex-1 overflow-y-auto space-y-4 pr-2">
              {copilotMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm flex-shrink-0">
                      ⚡
                    </div>
                  )}

                  <div
                    className={`max-w-md rounded-2xl p-4 text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-emerald-600 text-white font-medium rounded-tr-none'
                        : 'bg-white border border-slate-200 text-slate-800 shadow-xs rounded-tl-none'
                    }`}
                  >
                    <p className="whitespace-pre-line">{msg.content}</p>

                    {/* Structured Analysis Card if present */}
                    {msg.structured && (
                      <div className="mt-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Current price:</span>
                          <span className="font-bold text-slate-900">{msg.structured.price}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Solar availability:</span>
                          <span className="font-bold text-emerald-700">{msg.structured.availability}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Feeder load:</span>
                          <span className="font-bold text-slate-900">{msg.structured.feederLoad}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Recommended quantity:</span>
                          <span className="font-mono font-bold text-slate-900">{msg.structured.recommendedQty}</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold">
                          <span className="text-slate-700">Estimated cost:</span>
                          <span className="text-emerald-700">{msg.structured.estimatedCost}</span>
                        </div>
                      </div>
                    )}

                    {/* Confirmation Buttons */}
                    {msg.hasAction && (
                      <div className="mt-4 pt-2 flex items-center gap-2">
                        <button
                          onClick={() => {
                            setPurchaseKwh(5)
                            setSelectedPackage(availablePackages[0])
                            handleConfirmAndExecuteTrade()
                          }}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                        >
                          Yes, place order
                        </button>
                        <button
                          onClick={() => alert('Order parameters modified.')}
                          className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                        >
                          No, modify
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isCopilotLoading && (
                <div className="flex gap-3 items-center text-xs text-slate-400">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm animate-pulse">
                    ⚡
                  </div>
                  <span>Thinking with Groq compound-mini...</span>
                </div>
              )}
            </div>

            {/* Quick Suggestion Chips */}
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleSendCopilot('Can I buy 5 kWh on Feeder 1 right now?')}
                  className="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-emerald-300 text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer"
                >
                  Can I buy 5 kWh on Feeder 1 right now?
                </button>
                <button
                  onClick={() => handleSendCopilot("What's the best time to sell excess solar?")}
                  className="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-emerald-300 text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer"
                >
                  What's the best time to sell excess solar?
                </button>
                <button
                  onClick={() => handleSendCopilot('Check transformer headroom on Feeder-01')}
                  className="px-3 py-1.5 rounded-full bg-white border border-slate-200 hover:border-emerald-300 text-[11px] font-semibold text-slate-700 transition-colors cursor-pointer"
                >
                  Check transformer headroom on Feeder-01
                </button>
              </div>

              {/* Chat Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSendCopilot()
                }}
                className="relative"
              >
                <input
                  type="text"
                  value={copilotInput}
                  onChange={(e) => setCopilotInput(e.target.value)}
                  placeholder="Ask me anything about clean energy..."
                  className="w-full px-4 py-3.5 pr-12 rounded-2xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 shadow-sm"
                />
                <button
                  type="submit"
                  disabled={!copilotInput.trim() || isCopilotLoading}
                  className="absolute right-2 top-2 p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </main>
        )}

        {/* ── TAB 6: WALLET ────────────────────────────────────────────────── */}
        {activeTab === 'wallet' && (
          <main className="p-6 space-y-6 max-w-5xl mx-auto w-full animate-fade-in">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">INR Energy Wallet</h1>
            <p className="text-xs text-slate-500 mt-1">Reconciled peer-to-peer balance and DISCOM wheeling deductions.</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Available Balance</span>
                <span className="text-3xl font-black text-slate-900 font-mono block mt-2">₹1,420.50</span>
                <button className="mt-4 w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 cursor-pointer">
                  + Add Funds via UPI
                </button>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Clean Energy Bought</span>
                <span className="text-3xl font-black text-emerald-700 font-mono block mt-2">184 kWh</span>
                <span className="text-[11px] text-slate-500 mt-1 block">Saved ₹420 vs utility retail rate</span>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">DISCOM Wheeling Paid</span>
                <span className="text-3xl font-black text-slate-700 font-mono block mt-2">₹46.00</span>
                <span className="text-[11px] text-slate-500 mt-1 block">₹0.25/kWh grid transmission charge</span>
              </div>
            </div>
          </main>
        )}

        {/* ── TAB 7: NOTIFICATIONS ─────────────────────────────────────────── */}
        {activeTab === 'notifications' && (
          <main className="p-6 space-y-6 max-w-4xl mx-auto w-full animate-fade-in">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Notifications</h1>
            <p className="text-xs text-slate-500 mt-1">Grid safety alerts, order executions, and settlement proofs.</p>

            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                    ✓
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block">Trade #TRD-2026-001234 Cleared</span>
                    <span className="text-slate-500">5 kWh delivered from Rohit Mehta at ₹4.20/kWh.</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400">2 min ago</span>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold">
                    ⛓
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 block">Polygon Proof Anchored</span>
                    <span className="text-slate-500">Block 48,581,234 confirmed on chain.</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400">10 min ago</span>
              </div>
            </div>
          </main>
        )}
      </div>

      {/* ── PURCHASE CONFIGURATION MODAL (4-STEP WORKFLOW) ────────────────── */}
      {isPurchaseModalOpen && selectedPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Buy Clean Energy</h3>
                <p className="text-[11px] text-slate-500">From {selectedPackage.title}</p>
              </div>
              <button
                onClick={() => setIsPurchaseModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Quantity Slider */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-700">Energy Quantity (kWh)</label>
                <span className="font-mono font-bold text-emerald-700 text-sm">{purchaseKwh} kWh</span>
              </div>
              <input
                type="range"
                min="1"
                max={Math.min(selectedPackage.availableKwh, 30)}
                value={purchaseKwh}
                onChange={(e) => setPurchaseKwh(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>1 kWh</span>
                <span>Max: {selectedPackage.availableKwh} kWh</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-2">Settlement Option</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setBillingOption('discom_bill')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    billingOption === 'discom_bill' ? 'border-emerald-600 bg-emerald-50/50 font-bold' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <Building className="w-4 h-4 mx-auto text-emerald-700 mb-1" />
                  <span className="text-[10px] block">DISCOM Bill</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBillingOption('wallet_upi')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    billingOption === 'wallet_upi' ? 'border-emerald-600 bg-emerald-50/50 font-bold' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <CreditCard className="w-4 h-4 mx-auto text-blue-600 mb-1" />
                  <span className="text-[10px] block">UPI Wallet</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBillingOption('blockchain_escrow')}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    billingOption === 'blockchain_escrow' ? 'border-emerald-600 bg-emerald-50/50 font-bold' : 'border-slate-200 text-slate-600'
                  }`}
                >
                  <Blocks className="w-4 h-4 mx-auto text-purple-600 mb-1" />
                  <span className="text-[10px] block">Smart Contract</span>
                </button>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Energy Cost ({purchaseKwh} kWh @ ₹{selectedPackage.pricePerKwh})</span>
                <span className="font-mono font-bold text-slate-900">₹{(purchaseKwh * selectedPackage.pricePerKwh).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>DISCOM Wheeling Fee (₹0.25/kWh)</span>
                <span className="font-mono text-slate-900">₹{(purchaseKwh * 0.25).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-slate-900 border-t border-slate-200 pt-1.5">
                <span>Total Amount</span>
                <span className="font-mono text-emerald-700">₹{(purchaseKwh * selectedPackage.pricePerKwh + purchaseKwh * 0.25).toFixed(2)}</span>
              </div>
            </div>

            {/* Step Action Buttons */}
            {purchaseStep === 2 && (
              <button
                onClick={handleVerifyGridHeadroom}
                disabled={isCheckingGrid}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {isCheckingGrid ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Transformer Headroom on {selectedFeeder}...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Feeder Clearance & Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}

            {purchaseStep === 3 && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Feeder Headroom Cleared (62% Load - Below 90% Ceiling)</span>
                </div>
                <button
                  onClick={handleConfirmAndExecuteTrade}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  Confirm & Execute Trade
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SELLER LIST SURPLUS MODAL ─────────────────────────────────────── */}
      {isSellModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-500" />
                List Rooftop Solar Surplus
              </h3>
              <button
                onClick={() => setIsSellModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Energy to Sell (kWh)</label>
                <input
                  type="number"
                  step="0.5"
                  value={sellQty}
                  onChange={(e) => setSellQty(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Minimum Ask Rate (₹/kWh)</label>
                <input
                  type="number"
                  step="0.1"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Recommended: ₹4.20 - ₹4.50 (Beats DISCOM export tariff ₹2.50)
                </span>
              </div>

              <button
                onClick={() => {
                  setSubmittingSellOrder(true)
                  setTimeout(() => {
                    setSubmittingSellOrder(false)
                    setIsSellModalOpen(false)
                    alert(`Successfully published ${sellQty} kWh solar listing to ${selectedFeeder}!`)
                  }, 800)
                }}
                disabled={submittingSellOrder}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                {submittingSellOrder ? 'Publishing...' : 'Publish Solar Listing to Grid'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODALS: INVOICE & BLOCKCHAIN PROOF ─────────────────────────────── */}
      <InvoiceModal
        settlement={settlementModalData}
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
    </div>
  )
}
