'use client'

import React, { useState, useEffect, useCallback } from 'react'
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
} from 'lucide-react'

type NavigationTab = 'buy_workflow' | 'marketplace' | 'grid_median' | 'invoices' | 'blockchain'

interface EnergyPackage {
  id: string
  title: string
  sourceType: 'Rooftop Solar' | 'Community Solar' | 'Green Microgrid' | 'Battery Storage'
  sellerName: string
  feederId: string
  pricePerKwh: number
  availableKwh: number
  rating: number
  co2SavedKgPerKwh: number
  isCertified: boolean
  rawOrder?: Order
}

export default function UnifiedPlatformPage() {
  // ── Auth state ──────────────────────────────────────────────────────────────
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [username, setUsername] = useState('demo_consumer_01')
  const [password, setPassword] = useState('demo')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [userProfile, setUserProfile] = useState<{ username: string; role: string; feeder: string } | null>(null)

  // ── Navigation ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<NavigationTab>('buy_workflow')
  const [selectedFeeder, setSelectedFeeder] = useState('FEEDER-01')

  // ── Data state ──────────────────────────────────────────────────────────────
  const [marketPrice, setMarketPrice] = useState<MarketPrice | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [trades, setTrades] = useState<Trade[]>([])
  const [gridState, setGridState] = useState<GridState | null>(null)
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [meterReadings, setMeterReadings] = useState<MeterReading[]>([])
  const [loadingData, setLoadingData] = useState(false)

  // ── Realistic Purchase Workflow State ───────────────────────────────────────
  const [selectedPackage, setSelectedPackage] = useState<EnergyPackage | null>(null)
  const [purchaseKwh, setPurchaseKwh] = useState<number>(10)
  const [billingOption, setBillingOption] = useState<'discom_bill' | 'wallet_upi' | 'blockchain_escrow'>('discom_bill')
  const [isCheckingGrid, setIsCheckingGrid] = useState(false)
  const [gridApproved, setGridApproved] = useState(false)
  const [purchaseStep, setPurchaseStep] = useState<1 | 2 | 3 | 4>(1) // 1: Browse -> 2: Configure -> 3: Grid Pricing -> 4: Complete
  const [purchaseSuccess, setPurchaseSuccess] = useState<string | null>(null)

  // ── Seller post listing form state ──────────────────────────────────────────
  const [isSellerModalOpen, setIsSellerModalOpen] = useState(false)
  const [sellQty, setSellQty] = useState('8.0')
  const [sellPrice, setSellPrice] = useState('4.20')
  const [submittingOrder, setSubmittingOrder] = useState(false)

  // ── Modals: Invoice & Blockchain ────────────────────────────────────────────
  const [settlementModalData, setSettlementModalData] = useState<Settlement | null>(null)
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false)
  const [blockchainProof, setBlockchainProof] = useState<BlockchainProof | null>(null)
  const [isBlockchainOpen, setIsBlockchainOpen] = useState(false)

  // ── Check token on mount — requires active session to bypass login ──────────
  useEffect(() => {
    const activeSession = sessionStorage.getItem('gridmind_active_session')
    const savedToken = localStorage.getItem('gridmind_token')
    const savedUser = localStorage.getItem('gridmind_username')
    const savedRole = localStorage.getItem('gridmind_role')
    const savedFeeder = localStorage.getItem('gridmind_feeder') || 'FEEDER-01'

    if (activeSession && savedToken) {
      setToken(savedToken)
      setIsLoggedIn(true)
      setUserProfile({
        username: savedUser || 'demo_consumer_01',
        role: savedRole || 'consumer',
        feeder: savedFeeder,
      })
    } else {
      // Always show login page by default!
      setIsLoggedIn(false)
      setToken('')
    }
  }, [])

  // ── Load live marketplace data ──────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!isLoggedIn) return
    setLoadingData(true)
    try {
      const [p, ords, trds, gr, sm] = await Promise.allSettled([
        getMarketPrice(selectedFeeder),
        getOrders(),
        getTrades(selectedFeeder),
        getFeederStatus(selectedFeeder),
        getDashboardSummary(),
      ])

      if (p.status === 'fulfilled') setMarketPrice(p.value)
      if (ords.status === 'fulfilled') setOrders(ords.value)
      if (trds.status === 'fulfilled') setTrades(trds.value)
      if (gr.status === 'fulfilled') setGridState(gr.value)
      if (sm.status === 'fulfilled') setSummary(sm.value)

      try {
        const readings = await getMeterReadings('MTR-PRO-01')
        setMeterReadings(readings.slice(-8))
      } catch {
        // Meter optional
      }
    } catch {
      // Graceful handling
    } finally {
      setLoadingData(false)
    }
  }, [isLoggedIn, selectedFeeder])

  useEffect(() => {
    if (isLoggedIn) {
      loadData()
      const interval = setInterval(loadData, 8000)
      return () => clearInterval(interval)
    }
  }, [isLoggedIn, loadData])

  // ── Auth Handlers ───────────────────────────────────────────────────────────
  const handleLogin = async (e?: React.FormEvent, customUser?: string, customPass?: string) => {
    if (e) e.preventDefault()
    const targetUser = customUser || username
    const targetPass = customPass || password
    setAuthLoading(true)
    setAuthError(null)

    try {
      const token = await login(targetUser, targetPass)
      setToken(token.access_token)
      sessionStorage.setItem('gridmind_active_session', 'true')
      localStorage.setItem('gridmind_token', token.access_token)
      localStorage.setItem('gridmind_username', targetUser)
      localStorage.setItem('gridmind_role', token.role)
      localStorage.setItem('gridmind_feeder', token.feeder_id || 'FEEDER-01')

      setUserProfile({
        username: targetUser,
        role: token.role,
        feeder: token.feeder_id || 'FEEDER-01',
      })
      setIsLoggedIn(true)
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Invalid credentials or backend offline')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = () => {
    setToken('')
    sessionStorage.removeItem('gridmind_active_session')
    localStorage.removeItem('gridmind_token')
    localStorage.removeItem('gridmind_username')
    localStorage.removeItem('gridmind_role')
    localStorage.removeItem('gridmind_feeder')
    setIsLoggedIn(false)
    setUserProfile(null)
  }

  // ── Construct Sensible Energy Packages ───────────────────────────────────────
  // Combines active sell orders with curated smart-contract verified energy batches
  const availablePackages: EnergyPackage[] = [
    {
      id: 'pkg-solar-01',
      title: 'Green Valley Rooftop Solar Cluster',
      sourceType: 'Rooftop Solar',
      sellerName: 'Prosumer Sharma (#4401)',
      feederId: 'FEEDER-01',
      pricePerKwh: 4.10,
      availableKwh: 25.0,
      rating: 4.9,
      co2SavedKgPerKwh: 0.85,
      isCertified: true,
    },
    {
      id: 'pkg-solar-02',
      title: 'EcoGrid Community Solar Co-Op',
      sourceType: 'Community Solar',
      sellerName: 'Sector 4 Solar Trust',
      feederId: 'FEEDER-01',
      pricePerKwh: 4.30,
      availableKwh: 60.0,
      rating: 5.0,
      co2SavedKgPerKwh: 0.89,
      isCertified: true,
    },
    {
      id: 'pkg-battery-01',
      title: 'Peak-Shaved Lithium Battery Bank',
      sourceType: 'Battery Storage',
      sellerName: 'Apex Clean Energy Reseller',
      feederId: 'FEEDER-02',
      pricePerKwh: 4.60,
      availableKwh: 40.0,
      rating: 4.8,
      co2SavedKgPerKwh: 0.78,
      isCertified: true,
    },
    // Map in any actual user-submitted sell orders dynamically!
    ...orders
      .filter((o) => o.side === 'sell' && (o.status === 'OPEN' || o.status === 'PARTIALLY_FILLED'))
      .map((o) => ({
        id: o.order_id,
        title: `Rooftop Solar Batch #${o.order_id.slice(0, 6)}`,
        sourceType: 'Rooftop Solar' as const,
        sellerName: `Solar Producer #${o.user_id.slice(0, 6)}`,
        feederId: o.feeder_id,
        pricePerKwh: o.min_price || 4.20,
        availableKwh: o.quantity_kwh - o.filled_kwh,
        rating: 4.9,
        co2SavedKgPerKwh: 0.86,
        isCertified: true,
        rawOrder: o,
      })),
  ]

  // ── Purchase Workflow Actions ───────────────────────────────────────────────
  const handleSelectPackage = (pkg: EnergyPackage) => {
    setSelectedPackage(pkg)
    setPurchaseStep(2) // Move to configuration
  }

  const handleProceedToGrid = () => {
    setPurchaseStep(3)
    setIsCheckingGrid(true)
    // Simulate grid headroom clearance & dynamic congestion pricing computation
    setTimeout(() => {
      setIsCheckingGrid(false)
      setGridApproved(true)
    }, 1200)
  }

  const handleExecutePurchaseAndSettle = async () => {
    if (!selectedPackage) return
    setSubmittingOrder(true)
    try {
      const now = new Date()
      const interval = `${now.toISOString().slice(0, 10)}T${now.toTimeString().slice(0, 5)}`

      // 1. Submit matching buy order
      await createOrder({
        side: 'buy',
        quantity_kwh: purchaseKwh,
        max_price: selectedPackage.pricePerKwh + 0.3,
        interval,
      })

      // 2. Fetch or trigger latest trade settlement
      await loadData()
      const currentTrades = await getTrades(selectedFeeder)
      const matchedTrade = currentTrades.find(
        (t) => t.status === 'MATCHED' || t.status === 'GRID_LIMITED' || t.status === 'SETTLED'
      )

      if (matchedTrade) {
        // Settle immediately through DISCOM median
        try {
          const settlement = await settleTrade(matchedTrade.trade_id)
          setSettlementModalData(settlement)
        } catch {
          // If already settled, fetch invoice
          const existing = await getTradeSettlement(matchedTrade.trade_id).catch(() => null)
          if (existing) setSettlementModalData(existing)
        }
      }

      setPurchaseStep(4)
      setPurchaseSuccess(`Successfully purchased ${purchaseKwh} kWh from ${selectedPackage.sellerName}!`)
      loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error executing trade')
    } finally {
      setSubmittingOrder(false)
    }
  }

  // ── View Invoice & Blockchain Proof Handlers ────────────────────────────────
  const handleOpenInvoice = async (tradeId: string) => {
    try {
      const s = await getTradeSettlement(tradeId)
      setSettlementModalData(s)
      setIsInvoiceOpen(true)
    } catch {
      alert('Settlement invoice record not available.')
    }
  }

  const handleOpenBlockchain = async (tradeId?: string) => {
    try {
      const targetId = tradeId || (settlementModalData ? settlementModalData.trade_id : trades[0]?.trade_id)
      if (!targetId) {
        alert('No settled transaction available for blockchain inspection.')
        return
      }
      const proof = await getBlockchainProof(targetId)
      setBlockchainProof(proof)
      setIsBlockchainOpen(true)
    } catch {
      alert('Blockchain record could not be fetched.')
    }
  }

  // ── Seller: Post Solar Listing ──────────────────────────────────────────────
  const handlePostSellOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingOrder(true)
    try {
      const now = new Date()
      const interval = `${now.toISOString().slice(0, 10)}T${now.toTimeString().slice(0, 5)}`
      await createOrder({
        side: 'sell',
        quantity_kwh: parseFloat(sellQty),
        min_price: parseFloat(sellPrice),
        interval,
      })
      setIsSellerModalOpen(false)
      alert(`Successfully listed ${sellQty} kWh solar generation at ₹${sellPrice}/kWh!`)
      loadData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to post listing')
    } finally {
      setSubmittingOrder(false)
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // VIEW A: Pristine White & Emerald Login Page
  // ────────────────────────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-3xl p-8 shadow-xl shadow-slate-200/50 animate-fade-in">
          {/* Logo & Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 mb-4 shadow-sm">
              <Zap className="w-7 h-7 fill-emerald-600" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">GRIDMIND</h1>
            <p className="text-xs text-emerald-700 font-bold uppercase tracking-wider mt-1">
              Renewable Energy P2P Marketplace
            </p>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Buy local clean power at sensible prices, with automated DISCOM grid clearance & on-bill settlement.
            </p>
          </div>

          {/* Error notice */}
          {authError && (
            <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-medium"
                placeholder="Enter username"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-medium"
                placeholder="Enter password"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {authLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Enter Energy Marketplace
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* 1-Click Quick Fill Pills */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-3 text-center">
              Quick Sign In (Password: demo)
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setUsername('demo_consumer_01')
                  setPassword('demo')
                  handleLogin(undefined, 'demo_consumer_01', 'demo')
                }}
                className="p-2.5 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-center transition-all cursor-pointer group"
              >
                <Zap className="w-4 h-4 text-blue-600 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-slate-800 block">Buyer</span>
                <span className="text-[10px] text-slate-500">Consumer</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUsername('demo_prosumer_01')
                  setPassword('demo')
                  handleLogin(undefined, 'demo_prosumer_01', 'demo')
                }}
                className="p-2.5 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-center transition-all cursor-pointer group"
              >
                <Sun className="w-4 h-4 text-amber-600 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-slate-800 block">Seller</span>
                <span className="text-[10px] text-slate-500">Prosumer</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setUsername('demo_operator')
                  setPassword('demo')
                  handleLogin(undefined, 'demo_operator', 'demo')
                }}
                className="p-2.5 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-center transition-all cursor-pointer group"
              >
                <Shield className="w-4 h-4 text-emerald-600 mx-auto mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-slate-800 block">DISCOM</span>
                <span className="text-[10px] text-slate-500">Median</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // ────────────────────────────────────────────────────────────────────────────
  // VIEW B: Crisp White Theme Unified Marketplace Workspace
  // ────────────────────────────────────────────────────────────────────────────
  const utilityGridTariff = 8.50 // ₹/kWh standard utility bill rate
  const activePackagePrice = selectedPackage?.pricePerKwh || marketPrice?.price || 4.20
  const energyCost = purchaseKwh * activePackagePrice
  const wheelingCharge = purchaseKwh * 0.02 // ₹0.02/kWh DISCOM fee
  const estimatedTotal = energyCost + wheelingCharge
  const gridBaselineTotal = purchaseKwh * utilityGridTariff
  const totalSavings = gridBaselineTotal - estimatedTotal

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* ── TOP HEADER ──────────────────────────────────────────────────────── */}
      <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
            <Zap className="w-5 h-5 fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-slate-900">GRIDMIND</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                MARKET LIVE
              </span>
            </div>
            <span className="text-[10px] text-slate-500 hidden sm:inline">
              Decentralized Renewable P2P Energy & DISCOM Settlement
            </span>
          </div>
        </div>

        {/* Right Header Badges */}
        <div className="flex items-center gap-3">
          {/* Market Price Ticker */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <span className="text-slate-500 font-medium">Market Clearing Rate:</span>
            <span className="font-mono font-bold text-emerald-700">
              ₹{marketPrice ? marketPrice.price.toFixed(2) : '4.10'}/kWh
            </span>
            <span className="text-[10px] text-slate-400 line-through">₹8.50 Grid</span>
          </div>

          {/* Feeder selector */}
          <select
            value={selectedFeeder}
            onChange={(e) => setSelectedFeeder(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-xs focus:outline-none focus:border-emerald-600"
          >
            <option value="FEEDER-01">Feeder 01 (Residential)</option>
            <option value="FEEDER-02">Feeder 02 (Commercial)</option>
          </select>

          {/* User profile pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs">
            <UserIcon className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-semibold text-slate-800">{userProfile?.username}</span>
          </div>

          {/* Sign Out button */}
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── WORKSPACE BODY ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Left Navigation Sidebar */}
        <aside className="w-full md:w-64 border-r border-slate-200 bg-white p-4 flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-visible">
          <button
            onClick={() => setActiveTab('buy_workflow')}
            className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
              activeTab === 'buy_workflow'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <ShoppingCart className="w-4 h-4 flex-shrink-0" />
            <div>
              <span>Buy Sensible Energy</span>
              <span className="block text-[10px] font-normal opacity-85">4-Step Guided Purchase</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('marketplace')}
            className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
              activeTab === 'marketplace'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Sun className="w-4 h-4 flex-shrink-0" />
            <div>
              <span>Seller Listings</span>
              <span className="block text-[10px] font-normal opacity-85">Prosumer Solar Batches</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('grid_median')}
            className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
              activeTab === 'grid_median'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Shield className="w-4 h-4 flex-shrink-0" />
            <div>
              <span>Grid Median & Pricing</span>
              <span className="block text-[10px] font-normal opacity-85">Headroom & Wheeling</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('invoices')}
            className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
              activeTab === 'invoices'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4 flex-shrink-0" />
            <div>
              <span>DISCOM Invoices</span>
              <span className="block text-[10px] font-normal opacity-85">On-Bill Settlement Ledger</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('blockchain')}
            className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
              activeTab === 'blockchain'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Blocks className="w-4 h-4 flex-shrink-0" />
            <div>
              <span>Blockchain Proof</span>
              <span className="block text-[10px] font-normal opacity-85">Smart Contract & Escrow</span>
            </div>
          </button>

          {/* Sidebar Footer Call to Action */}
          <div className="hidden md:block mt-auto pt-4 border-t border-slate-100">
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100 text-xs">
              <span className="font-bold text-emerald-900 block mb-1">Rooftop Solar Owner?</span>
              <p className="text-[11px] text-emerald-800 leading-tight mb-2.5">
                Earn ₹4.10-₹4.50/kWh vs ₹2.50 net-metering feed-in export.
              </p>
              <button
                onClick={() => setIsSellerModalOpen(true)}
                className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                List Energy for Sale
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* TAB 1: REALISTIC 4-STEP BUYER WORKFLOW                                */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'buy_workflow' && (
            <div className="space-y-6">
              {/* Stepper Progress Bar */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
                <div className="flex items-center justify-between max-w-3xl mx-auto">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        purchaseStep >= 1 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      1
                    </span>
                    <span className={`text-xs font-bold ${purchaseStep >= 1 ? 'text-slate-900' : 'text-slate-400'}`}>
                      Select Energy
                    </span>
                  </div>
                  <div className={`flex-1 h-0.5 mx-4 ${purchaseStep >= 2 ? 'bg-emerald-500' : 'bg-slate-200'}`} />

                  <div className="flex items-center gap-2">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        purchaseStep >= 2 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      2
                    </span>
                    <span className={`text-xs font-bold ${purchaseStep >= 2 ? 'text-slate-900' : 'text-slate-400'}`}>
                      Configure Units
                    </span>
                  </div>
                  <div className={`flex-1 h-0.5 mx-4 ${purchaseStep >= 3 ? 'bg-emerald-500' : 'bg-slate-200'}`} />

                  <div className="flex items-center gap-2">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        purchaseStep >= 3 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      3
                    </span>
                    <span className={`text-xs font-bold ${purchaseStep >= 3 ? 'text-slate-900' : 'text-slate-400'}`}>
                      Grid Clearance
                    </span>
                  </div>
                  <div className={`flex-1 h-0.5 mx-4 ${purchaseStep >= 4 ? 'bg-emerald-500' : 'bg-slate-200'}`} />

                  <div className="flex items-center gap-2">
                    <span
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        purchaseStep >= 4 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      4
                    </span>
                    <span className={`text-xs font-bold ${purchaseStep >= 4 ? 'text-slate-900' : 'text-slate-400'}`}>
                      Billing & Invoice
                    </span>
                  </div>
                </div>
              </div>

              {/* STEP 1: BROWSE SENSIBLE ELECTRICITY */}
              {purchaseStep === 1 && (
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">
                        Choose Sensible Clean Electricity
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Verified neighborhood solar generation at ~45% lower prices than standard utility grid tariffs.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-2xl border border-slate-200 shadow-xs text-xs">
                      <span className="text-slate-500">Retail Grid Baseline:</span>
                      <span className="font-bold text-slate-900 font-mono">₹8.50/kWh</span>
                    </div>
                  </div>

                  {/* Energy Package Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {availablePackages.map((pkg) => {
                      const savingsPct = Math.round(((utilityGridTariff - pkg.pricePerKwh) / utilityGridTariff) * 100)
                      return (
                        <div
                          key={pkg.id}
                          className="bg-white border border-slate-200 hover:border-emerald-500 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                        >
                          <div>
                            {/* Badges */}
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                                {pkg.sourceType}
                              </span>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                Save {savingsPct}%
                              </span>
                            </div>

                            <h3 className="font-bold text-slate-900 text-sm mb-1 group-hover:text-emerald-700 transition-colors">
                              {pkg.title}
                            </h3>
                            <p className="text-xs text-slate-500 mb-4">{pkg.sellerName} • {pkg.feederId}</p>

                            {/* Price Comparison Callout */}
                            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 mb-4">
                              <div className="flex items-baseline justify-between">
                                <span className="text-xs text-slate-500">P2P Tariff:</span>
                                <span className="text-2xl font-black text-slate-900 font-mono">
                                  ₹{pkg.pricePerKwh.toFixed(2)}
                                  <span className="text-xs text-slate-500 font-normal"> / kWh</span>
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] text-emerald-700 font-semibold mt-1">
                                <span>vs ₹8.50 Grid Rate</span>
                                <span>Save ₹{(utilityGridTariff - pkg.pricePerKwh).toFixed(2)}/kWh</span>
                              </div>
                            </div>

                            {/* Details */}
                            <div className="space-y-1.5 text-xs text-slate-600 mb-4">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Available:</span>
                                <span className="font-mono font-semibold text-slate-800">{pkg.availableKwh.toFixed(1)} kWh</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Green Impact:</span>
                                <span className="font-medium text-emerald-700">{pkg.co2SavedKgPerKwh} kg CO2/kWh</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Reliability Score:</span>
                                <span className="font-semibold text-slate-800">★ {pkg.rating} / 5.0</span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleSelectPackage(pkg)}
                            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-emerald-600 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            Select & Configure
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* STEP 2: CONFIGURE UNITS & ESTIMATE BILL */}
              {purchaseStep === 2 && selectedPackage && (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs max-w-2xl mx-auto space-y-6 animate-fade-in">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <span className="text-xs text-slate-500 block">Configuring Purchase From:</span>
                      <h2 className="text-base font-bold text-slate-900">{selectedPackage.title}</h2>
                      <span className="text-xs text-emerald-700 font-semibold font-mono">
                        ₹{selectedPackage.pricePerKwh.toFixed(2)} / kWh
                      </span>
                    </div>
                    <button
                      onClick={() => setPurchaseStep(1)}
                      className="text-xs text-slate-500 hover:text-slate-900 font-medium cursor-pointer"
                    >
                      Change Package
                    </button>
                  </div>

                  {/* Quantity Slider & Presets */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-2">
                      How much electricity do you need?
                    </label>
                    <div className="flex items-center gap-4 mb-3">
                      <input
                        type="range"
                        min="1"
                        max={Math.min(selectedPackage.availableKwh, 50)}
                        value={purchaseKwh}
                        onChange={(e) => setPurchaseKwh(parseFloat(e.target.value))}
                        className="flex-1 accent-emerald-600 cursor-pointer"
                      />
                      <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-base text-slate-900">
                        {purchaseKwh} kWh
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {[5, 10, 20, 30].map((units) => (
                        <button
                          key={units}
                          type="button"
                          onClick={() => setPurchaseKwh(units)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            purchaseKwh === units
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {units} kWh
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Real-time Bill Estimate Box */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Clean Energy Cost ({purchaseKwh} kWh @ ₹{selectedPackage.pricePerKwh}):</span>
                      <span className="font-mono font-semibold text-slate-900">₹{energyCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>DISCOM Grid Wheeling Fee (₹0.02/kWh):</span>
                      <span className="font-mono font-semibold text-amber-700">₹{wheelingCharge.toFixed(2)}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-sm text-slate-900">
                      <span>Total P2P Cost:</span>
                      <span className="font-mono text-emerald-700">₹{estimatedTotal.toFixed(2)}</span>
                    </div>
                    <div className="pt-1 flex justify-between text-[11px] text-emerald-800 font-semibold bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                      <span>Instant Savings vs Utility Bill (₹{gridBaselineTotal.toFixed(2)}):</span>
                      <span>Save ₹{totalSavings.toFixed(2)} (49%)</span>
                    </div>
                  </div>

                  <button
                    onClick={handleProceedToGrid}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    Proceed to Grid Clearance & Dynamic Pricing
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* STEP 3: DISCOM GRID CLEARANCE & PRICING HANDLING */}
              {purchaseStep === 3 && selectedPackage && (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs max-w-2xl mx-auto space-y-6 animate-fade-in">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                      <Shield className="w-6 h-6" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900">
                      DISCOM Grid Verification & Pricing Check
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                      The grid operator validates local transformer capacity to prevent line overload before transmission.
                    </p>
                  </div>

                  {/* Grid Checks Status */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 flex items-center gap-2">
                        <Activity className="w-4 h-4 text-emerald-600" />
                        Feeder Transformer Load:
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        {gridState ? gridState.load_kw.toFixed(1) : '32.0'} kW / 100 kW
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 flex items-center gap-2">
                        <BatteryCharging className="w-4 h-4 text-emerald-600" />
                        Available Headroom for Injection:
                      </span>
                      <span className="font-mono font-bold text-emerald-700">
                        {gridState ? gridState.headroom_kw.toFixed(1) : '68.0'} kW (Ample capacity)
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
                      <span className="text-slate-600">Congestion Band:</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        GREEN — UNRESTRICTED TRANSMISSION
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Clearing Price Callout */}
                  <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-blue-900 block">
                        Dynamic Market Price Locked
                      </span>
                      <span className="text-[11px] text-blue-800">
                        P_final = min(P_max, max(P_min, P_market)) = ₹{selectedPackage.pricePerKwh.toFixed(2)}/kWh
                      </span>
                    </div>
                    <CheckCircle2 className="w-6 h-6 text-blue-600 flex-shrink-0" />
                  </div>

                  {/* Billing Option Selection */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-2">
                      Choose Your Preferred Settlement & Billing Option:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        onClick={() => setBillingOption('discom_bill')}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                          billingOption === 'discom_bill'
                            ? 'bg-emerald-50 border-emerald-500 shadow-xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <Building className="w-4 h-4 text-emerald-600 mb-1.5" />
                        <span className="text-xs font-bold text-slate-900 block">DISCOM Bill</span>
                        <span className="text-[10px] text-slate-500">Deduct on monthly power statement</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBillingOption('wallet_upi')}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                          billingOption === 'wallet_upi'
                            ? 'bg-emerald-50 border-emerald-500 shadow-xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <CreditCard className="w-4 h-4 text-blue-600 mb-1.5" />
                        <span className="text-xs font-bold text-slate-900 block">Energy Wallet / UPI</span>
                        <span className="text-[10px] text-slate-500">Instant direct peer payment</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBillingOption('blockchain_escrow')}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                          billingOption === 'blockchain_escrow'
                            ? 'bg-emerald-50 border-emerald-500 shadow-xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <Blocks className="w-4 h-4 text-purple-600 mb-1.5" />
                        <span className="text-xs font-bold text-slate-900 block">Blockchain Escrow</span>
                        <span className="text-[10px] text-slate-500">Smart contract auto-settle</span>
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleExecutePurchaseAndSettle}
                    disabled={submittingOrder}
                    className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    {submittingOrder ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Matching & Settling via DISCOM...
                      </>
                    ) : (
                      <>
                        Authorize Transmission & Settle (₹{estimatedTotal.toFixed(2)})
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* STEP 4: ORDER COMPLETE & INVOICE GENERATION */}
              {purchaseStep === 4 && (
                <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xs max-w-xl mx-auto text-center space-y-5 animate-fade-in">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-200">
                    <Check className="w-8 h-8 stroke-[3]" />
                  </div>

                  <div>
                    <h2 className="text-xl font-black text-slate-900">Energy Cleared & Settled!</h2>
                    <p className="text-xs text-slate-500 mt-1">{purchaseSuccess}</p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2 text-left">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Volume Transferred:</span>
                      <span className="font-bold text-slate-900 font-mono">{purchaseKwh} kWh Clean Solar</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Settled Price:</span>
                      <span className="font-bold text-emerald-700 font-mono">₹{activePackagePrice.toFixed(2)} / kWh</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Charged:</span>
                      <span className="font-bold text-slate-900 font-mono">₹{estimatedTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Your Money Saved:</span>
                      <span className="font-bold text-emerald-700 font-mono">₹{totalSavings.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setIsInvoiceOpen(true)}
                      className="flex-1 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      View DISCOM Invoice
                    </button>

                    <button
                      onClick={() => handleOpenBlockchain()}
                      className="flex-1 py-3 px-4 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-bold text-xs shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <Blocks className="w-4 h-4 text-purple-600" />
                      On-Chain Proof
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setPurchaseStep(1)
                      setSelectedPackage(null)
                    }}
                    className="text-xs text-slate-500 hover:text-slate-900 font-semibold cursor-pointer block mx-auto mt-2"
                  >
                    ← Buy More Solar Power
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* TAB 2: SELLER LISTINGS & PROSUMER BATCHES                              */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'marketplace' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Active Prosumer Solar Batches</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Solar households in your neighborhood feeding surplus electricity into the grid.
                  </p>
                </div>
                <button
                  onClick={() => setIsSellerModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  List Surplus Solar Energy
                </button>
              </div>

              {/* Order Book Table */}
              <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="p-4 font-bold">Listing ID</th>
                      <th className="p-4 font-bold">Seller Type</th>
                      <th className="p-4 font-bold">Feeder</th>
                      <th className="p-4 font-bold">Quantity</th>
                      <th className="p-4 font-bold">Ask Rate</th>
                      <th className="p-4 font-bold">Status</th>
                      <th className="p-4 text-right font-bold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders
                      .filter((o) => o.side === 'sell')
                      .map((o) => (
                        <tr key={o.order_id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4 font-mono text-slate-600">#{o.order_id.slice(0, 8)}</td>
                          <td className="p-4 font-semibold text-slate-900 flex items-center gap-1.5">
                            <Sun className="w-3.5 h-3.5 text-amber-500" />
                            Rooftop Prosumer
                          </td>
                          <td className="p-4 text-slate-600">{o.feeder_id}</td>
                          <td className="p-4 font-mono font-bold text-slate-900">
                            {(o.quantity_kwh - o.filled_kwh).toFixed(1)} kWh
                          </td>
                          <td className="p-4 font-mono font-bold text-emerald-700">
                            ₹{(o.min_price || 4.2).toFixed(2)} / kWh
                          </td>
                          <td className="p-4">
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                              {o.status}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedPackage({
                                  id: o.order_id,
                                  title: `Solar Batch #${o.order_id.slice(0, 6)}`,
                                  sourceType: 'Rooftop Solar',
                                  sellerName: `Seller #${o.user_id.slice(0, 6)}`,
                                  feederId: o.feeder_id,
                                  pricePerKwh: o.min_price || 4.2,
                                  availableKwh: o.quantity_kwh - o.filled_kwh,
                                  rating: 4.9,
                                  co2SavedKgPerKwh: 0.85,
                                  isCertified: true,
                                })
                                setActiveTab('buy_workflow')
                                setPurchaseStep(2)
                              }}
                              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-emerald-600 text-white font-bold text-xs transition-colors cursor-pointer"
                            >
                              Buy From Seller
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* TAB 3: GRID MEDIAN & WHEELING                                         */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'grid_median' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">DISCOM Grid Median & Wheeling Operations</h2>
                    <p className="text-xs text-slate-500">
                      Physical grid oversight: verifies reverse-power injection limits and computes non-discriminatory wheeling rates.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-xs text-slate-500 block mb-1">Feeder Transformer Load</span>
                    <span className="text-2xl font-black font-mono text-slate-900">
                      {gridState ? gridState.load_kw.toFixed(1) : '32.0'}{' '}
                      <span className="text-xs text-slate-400 font-normal">/ 100 kW</span>
                    </span>
                    <div className="w-full bg-slate-200 h-2 rounded-full mt-3 overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all"
                        style={{ width: `${gridState ? (gridState.load_kw / gridState.capacity_kw) * 100 : 32}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-xs text-slate-500 block mb-1">Available Reverse Headroom</span>
                    <span className="text-2xl font-black font-mono text-emerald-700">
                      {gridState ? gridState.headroom_kw.toFixed(1) : '68.0'}{' '}
                      <span className="text-xs text-slate-400 font-normal">kW</span>
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-3">
                      Allowed for injection without thermal stress
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <span className="text-xs text-slate-500 block mb-1">DISCOM Wheeling Fee Earned</span>
                    <span className="text-2xl font-black font-mono text-blue-700">
                      ₹0.02 <span className="text-xs text-slate-400 font-normal">/ kWh</span>
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-3">
                      Grid maintenance & technical loss recovery
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* TAB 4: DISCOM SETTLEMENT INVOICES                                     */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'invoices' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
                <h2 className="text-lg font-bold text-slate-900 mb-1">
                  Official DISCOM Settlement & Billing Invoices
                </h2>
                <p className="text-xs text-slate-500 mb-6">
                  Itemized electricity invoices reflecting peer credits and debits cleared through the utility grid.
                </p>

                <div className="space-y-3">
                  {trades.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      No settled invoices available yet. Buy energy in the first tab to generate your first invoice!
                    </div>
                  ) : (
                    trades.map((t) => (
                      <div
                        key={t.trade_id}
                        className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-emerald-300 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm font-bold text-slate-900">
                              {t.quantity_kwh.toFixed(2)} kWh @ ₹{t.clearing_price.toFixed(2)}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              {t.status}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 font-mono">
                            Trade #{t.trade_id.slice(0, 8)} • Cleared: {new Date(t.timestamp).toLocaleTimeString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleOpenInvoice(t.trade_id)}
                            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-emerald-600 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            View DISCOM Invoice
                          </button>

                          <button
                            onClick={() => handleOpenBlockchain(t.trade_id)}
                            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-purple-700 border border-purple-200 font-bold text-xs shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Blocks className="w-3.5 h-3.5 text-purple-600" />
                            On-Chain Proof
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* TAB 5: BLOCKCHAIN INTEGRATION                                         */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'blockchain' && (
            <div className="space-y-6">
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Blocks className="w-5 h-5 text-purple-600" />
                    Blockchain Smart Contract Architecture
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    EnergyMarketplace.sol deployed on Polygon Amoy / Ethereum Sepolia Testnet for tamper-proof escrow.
                  </p>
                </div>

                {/* Contract Status Card */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200">
                    <span className="text-xs text-purple-800 font-semibold block mb-1">Contract Address</span>
                    <span className="font-mono text-xs font-bold text-purple-950 break-all">
                      0x89205A3A3b2A55610C09E71A911cA444B669AC48
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200">
                    <span className="text-xs text-emerald-800 font-semibold block mb-1">Consensus Network</span>
                    <span className="text-xs font-bold text-emerald-950 block">
                      Polygon Amoy (EVM Layer 2)
                    </span>
                    <span className="text-[10px] text-emerald-700">Proof-of-Stake Eco-Friendly</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200">
                    <span className="text-xs text-blue-800 font-semibold block mb-1">Smart Contract Functions</span>
                    <span className="text-xs font-bold text-blue-950 block">
                      listEnergy(), buyEnergy(), settleTrade()
                    </span>
                    <span className="text-[10px] text-blue-700">Automated DISCOM fee split</span>
                  </div>
                </div>

                {/* Solidity Snippet View */}
                <div className="p-4 rounded-2xl bg-slate-900 text-slate-200 font-mono text-xs overflow-x-auto space-y-1">
                  <div className="text-slate-400">// EnergyMarketplace.sol — Escrow & Settlement Event</div>
                  <div className="text-emerald-400">event TradeSettled(</div>
                  <div className="text-slate-300 pl-4">uint256 indexed tradeId,</div>
                  <div className="text-slate-300 pl-4">bytes32 auditHash,</div>
                  <div className="text-slate-300 pl-4">string discomInvoiceRef,</div>
                  <div className="text-slate-300 pl-4">uint256 grossAmount,</div>
                  <div className="text-slate-300 pl-4">uint256 discomFee,</div>
                  <div className="text-slate-300 pl-4">uint256 sellerCredit</div>
                  <div className="text-emerald-400">);</div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <span className="text-xs text-slate-500">
                    Every trade produces an immutable cryptographic digest linking physical energy flow to the financial ledger.
                  </span>
                  <button
                    onClick={() => handleOpenBlockchain()}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    Inspect Latest Block Receipt
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ── SELLER POST LISTING MODAL ───────────────────────────────────────── */}
      {isSellerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-md w-full space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-500" />
                List Rooftop Solar Surplus
              </h3>
              <button
                onClick={() => setIsSellerModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePostSellOrder} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Energy to Sell (kWh)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={sellQty}
                  onChange={(e) => setSellQty(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Minimum Ask Rate (₹/kWh)</label>
                <input
                  type="number"
                  step="0.1"
                  min="2.0"
                  max="8.0"
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Recommended: ₹4.00 - ₹4.50 (Attractive to buyers while beating net-metering ₹2.50)
                </span>
              </div>

              <button
                type="submit"
                disabled={submittingOrder}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                {submittingOrder ? 'Publishing...' : 'Publish Solar Listing to Grid'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MODALS: INVOICE & BLOCKCHAIN PROOF ───────────────────────────────── */}
      <InvoiceModal
        settlement={settlementModalData}
        isOpen={isInvoiceOpen}
        onClose={() => setIsInvoiceOpen(false)}
        onViewBlockchain={() => {
          setIsInvoiceOpen(false)
          handleOpenBlockchain(settlementModalData?.trade_id)
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
