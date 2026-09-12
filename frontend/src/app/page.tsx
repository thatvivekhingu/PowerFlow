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
import CopilotDrawer from '@/components/CopilotDrawer'
import DemandResponseModal from '@/components/DemandResponseModal'
import DisputeResolutionModal from '@/components/DisputeResolutionModal'
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

type NavigationTab = 'unified' | 'sell_studio' | 'invoices' | 'blockchain'

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
  const [activeTab, setActiveTab] = useState<NavigationTab>('unified')
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

  // ── Prosumer / Seller Studio State ──────────────────────────────────────────
  const [isSellerModalOpen, setIsSellerModalOpen] = useState(false)
  const [sellQty, setSellQty] = useState('10.0')
  const [sellPrice, setSellPrice] = useState('4.20')
  const [sellSlot, setSellSlot] = useState<'immediate' | 'solar_peak' | 'evening_battery'>('solar_peak')
  const [autoPilotListing, setAutoPilotListing] = useState(false)
  const [submittingOrder, setSubmittingOrder] = useState(false)
  const [sellPublishSuccess, setSellPublishSuccess] = useState<string | null>(null)

  // ── Modals: Invoice & Blockchain ────────────────────────────────────────────
  const [settlementModalData, setSettlementModalData] = useState<Settlement | null>(null)
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false)
  const [blockchainProof, setBlockchainProof] = useState<BlockchainProof | null>(null)
  const [isBlockchainOpen, setIsBlockchainOpen] = useState(false)

  // ── Modals: LangGraph AI Optimization & Dispute ─────────────────────────────
  const [isDemandResponseOpen, setIsDemandResponseOpen] = useState(false)
  const [isDisputeOpen, setIsDisputeOpen] = useState(false)
  const [activeDisputeTrade, setActiveDisputeTrade] = useState<{ id: string; kwh: number; price: number } | null>(null)

  // ── Check token on mount — auto-authenticates demo user so Cockpit is immediately visible ──────────
  useEffect(() => {
    const savedToken = localStorage.getItem('gridmind_token')
    const savedUser = localStorage.getItem('gridmind_username') || 'demo_consumer_01'
    const savedRole = localStorage.getItem('gridmind_role') || 'consumer'
    const savedFeeder = localStorage.getItem('gridmind_feeder') || 'FEEDER-01'

    if (savedToken) {
      setToken(savedToken)
      setIsLoggedIn(true)
      setUserProfile({
        username: savedUser,
        role: savedRole,
        feeder: savedFeeder,
      })
      if (savedRole === 'prosumer') {
        setActiveTab('sell_studio')
      }
    } else {
      // Auto-authenticate as demo consumer so the app opens immediately
      login('demo_consumer_01', 'demo')
        .then((tok) => {
          setToken(tok.access_token)
          localStorage.setItem('gridmind_token', tok.access_token)
          localStorage.setItem('gridmind_username', 'demo_consumer_01')
          localStorage.setItem('gridmind_role', tok.role)
          localStorage.setItem('gridmind_feeder', tok.feeder_id || 'FEEDER-01')
          setUserProfile({
            username: 'demo_consumer_01',
            role: tok.role,
            feeder: tok.feeder_id || 'FEEDER-01',
          })
          setIsLoggedIn(true)
        })
        .catch(() => {
          // Fallback demo state
          setUserProfile({
            username: 'demo_consumer_01',
            role: 'consumer',
            feeder: 'FEEDER-01',
          })
          setIsLoggedIn(true)
        })
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
      if (token.role === 'prosumer') {
        setActiveTab('sell_studio')
      } else {
        setActiveTab('unified')
      }
      setIsLoggedIn(true)
    } catch {
      // Graceful fallback to client demo session so the app is always accessible
      const fallbackRole = targetUser.includes('prosumer') ? 'prosumer' : targetUser.includes('operator') ? 'discom_operator' : 'consumer'
      localStorage.setItem('gridmind_username', targetUser)
      localStorage.setItem('gridmind_role', fallbackRole)
      localStorage.setItem('gridmind_feeder', 'FEEDER-01')
      setUserProfile({
        username: targetUser,
        role: fallbackRole,
        feeder: 'FEEDER-01',
      })
      if (fallbackRole === 'prosumer') {
        setActiveTab('sell_studio')
      } else {
        setActiveTab('unified')
      }
      setIsLoggedIn(true)
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

  const handleOpenDispute = (trade?: Trade) => {
    if (trade) {
      setActiveDisputeTrade({
        id: trade.trade_id,
        kwh: trade.quantity_kwh,
        price: trade.clearing_price,
      })
    } else {
      setActiveDisputeTrade(null)
    }
    setIsDisputeOpen(true)
  }

  // ── Seller: Post Solar Listing ──────────────────────────────────────────────
  const handlePostSellOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingOrder(true)
    setSellPublishSuccess(null)
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
      setSellPublishSuccess(`Successfully listed ${sellQty} kWh solar generation at ₹${sellPrice}/kWh to ${selectedFeeder}!`)
      await loadData()
      setTimeout(() => setSellPublishSuccess(null), 6000)
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
  // ── Buyer calculations ──────────────────────────────────────────────────────
  const utilityGridTariff = 8.50 // ₹/kWh standard utility bill rate
  const activePackagePrice = selectedPackage?.pricePerKwh || marketPrice?.price || 4.20
  const energyCost = purchaseKwh * activePackagePrice
  const wheelingCharge = purchaseKwh * 0.02 // ₹0.02/kWh DISCOM fee
  const estimatedTotal = energyCost + wheelingCharge
  const gridBaselineTotal = purchaseKwh * utilityGridTariff
  const totalSavings = gridBaselineTotal - estimatedTotal

  // ── Prosumer / Seller calculations ──────────────────────────────────────────
  const sellerKwh = parseFloat(sellQty) || 0
  const sellerUnitPrice = parseFloat(sellPrice) || 4.20
  const sellerGrossEarnings = sellerKwh * sellerUnitPrice
  const sellerWheelingDeduction = sellerKwh * 0.02
  const sellerNetEarnings = sellerGrossEarnings - sellerWheelingDeduction
  const utilityNetMeteringBaseline = sellerKwh * 2.50 // Standard DISCOM feed-in tariff
  const sellerNetUplift = sellerNetEarnings - utilityNetMeteringBaseline
  const sellerUpliftPercent = utilityNetMeteringBaseline > 0 ? Math.round((sellerNetUplift / utilityNetMeteringBaseline) * 100) : 0

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

        {/* Right Header Badges & Mode Switcher */}
        <div className="flex items-center gap-3">
          {/* Mode Switcher: Buy Energy vs Sell Solar */}
          <div className="hidden sm:flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab('unified')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'unified'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5 text-emerald-600" />
              <span>Buy Energy</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sell_studio')}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'sell_studio'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Sell Solar</span>
            </button>
          </div>

          {/* Market Price Ticker */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            <span className="text-slate-500 font-medium">Clearing Rate:</span>
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
            onClick={() => setActiveTab('unified')}
            className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
              activeTab === 'unified'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <ShoppingCart className="w-4 h-4 flex-shrink-0" />
            <div>
              <span>Buy Clean Energy</span>
              <span className="block text-[10px] font-normal opacity-85">Consumer Cockpit</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('sell_studio')}
            className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl text-xs font-bold transition-all text-left cursor-pointer ${
              activeTab === 'sell_studio'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Sun className="w-4 h-4 flex-shrink-0" />
            <div>
              <span>Sell Solar Power</span>
              <span className="block text-[10px] font-normal opacity-85">Prosumer Studio</span>
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
              <span className="block text-[10px] font-normal opacity-85">Full Settlement Ledger</span>
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
            <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs">
              <span className="font-bold text-amber-950 block mb-1">Rooftop Solar Owner?</span>
              <p className="text-[11px] text-amber-900 leading-tight mb-2.5">
                Earn ₹4.10-₹4.50/kWh vs ₹2.50 net-metering feed-in export.
              </p>
              <button
                onClick={() => setActiveTab('sell_studio')}
                className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <Sun className="w-3.5 h-3.5" />
                Open Prosumer Studio
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* CONSOLIDATED TWO-PANE DASHBOARD (ACTIVE TAB: UNIFIED)                */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'unified' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* ── LEFT PANE: MARKETPLACE & GUIDED TRADING (7 cols on xl, 8 on 2xl) ── */}
              <div className="xl:col-span-7 2xl:col-span-8 space-y-6">
                {/* Stepper Progress Bar */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs">
                  <div className="flex items-center justify-between max-w-2xl mx-auto">
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
                    <div className={`flex-1 h-0.5 mx-3 ${purchaseStep >= 2 ? 'bg-emerald-500' : 'bg-slate-200'}`} />

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
                    <div className={`flex-1 h-0.5 mx-3 ${purchaseStep >= 3 ? 'bg-emerald-500' : 'bg-slate-200'}`} />

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
                    <div className={`flex-1 h-0.5 mx-3 ${purchaseStep >= 4 ? 'bg-emerald-500' : 'bg-slate-200'}`} />

                    <div className="flex items-center gap-2">
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          purchaseStep >= 4 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        4
                      </span>
                      <span className={`text-xs font-bold ${purchaseStep >= 4 ? 'text-slate-900' : 'text-slate-400'}`}>
                        Settlement
                      </span>
                    </div>
                  </div>
                </div>

                {/* STEP 1: BROWSE SENSIBLE ELECTRICITY */}
                {purchaseStep === 1 && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">
                          Choose Sensible Clean Electricity
                        </h2>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Verified neighborhood solar generation at ~45% lower prices than standard grid tariffs.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-2xl border border-slate-200 shadow-xs text-xs self-start sm:self-auto">
                        <span className="text-slate-500">Grid Rate:</span>
                        <span className="font-bold text-slate-900 font-mono">₹8.50/kWh</span>
                      </div>
                    </div>

                    {/* Energy Package Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
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
                              <p className="text-xs text-slate-500 mb-3">{pkg.sellerName} • {pkg.feederId}</p>

                              {/* Price Comparison Callout */}
                              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 mb-3">
                                <div className="flex items-baseline justify-between">
                                  <span className="text-xs text-slate-500">P2P Tariff:</span>
                                  <span className="text-xl font-black text-slate-900 font-mono">
                                    ₹{pkg.pricePerKwh.toFixed(2)}
                                    <span className="text-xs text-slate-500 font-normal"> / kWh</span>
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] text-emerald-700 font-semibold mt-1">
                                  <span>vs ₹8.50 Grid</span>
                                  <span>Save ₹{(utilityGridTariff - pkg.pricePerKwh).toFixed(2)}/kWh</span>
                                </div>
                              </div>

                              {/* Details */}
                              <div className="space-y-1 text-xs text-slate-600 mb-3">
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

                              <div className="flex items-center justify-between text-[10px] text-slate-500 bg-slate-50 px-2 py-1 rounded-lg mb-3 border border-slate-100 font-medium">
                                <span className="text-amber-700 flex items-center gap-1">⚡ DR-Ready</span>
                                <span className="text-slate-300">|</span>
                                <span className="text-indigo-700 flex items-center gap-1">⚖️ Oracle Protected</span>
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

                    {/* Quantity Input */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-slate-700">Purchase Volume (kWh)</label>
                        <span className="text-xs font-mono text-emerald-700 font-semibold">
                          Max Available: {selectedPackage.availableKwh.toFixed(1)} kWh
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="1"
                          max={Math.min(selectedPackage.availableKwh, 50)}
                          step="1"
                          value={purchaseKwh}
                          onChange={(e) => setPurchaseKwh(Number(e.target.value))}
                          className="flex-1 accent-emerald-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                        />
                        <div className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-center font-bold text-slate-900 text-sm">
                          {purchaseKwh} kWh
                        </div>
                      </div>
                    </div>

                    {/* Financial Summary Box */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                      <div className="flex justify-between text-slate-600">
                        <span>Solar Clean Energy ({purchaseKwh} kWh @ ₹{activePackagePrice.toFixed(2)}):</span>
                        <span className="font-mono font-bold text-slate-900">₹{energyCost.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span className="flex items-center gap-1">
                          DISCOM Grid Wheeling Fee (₹0.02/kWh):
                          <span className="text-[10px] text-slate-400" title="Utility distribution fee">ⓘ</span>
                        </span>
                        <span className="font-mono font-bold text-slate-900">₹{wheelingCharge.toFixed(2)}</span>
                      </div>
                      <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                        <span>Estimated Total Bill:</span>
                        <span className="font-mono text-sm text-emerald-700">₹{estimatedTotal.toFixed(2)}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-between text-emerald-900">
                        <span className="font-medium text-[11px]">Savings compared to ₹8.50 utility tariff:</span>
                        <span className="font-mono font-bold text-xs text-emerald-700">
                          Save ₹{totalSavings.toFixed(2)} (
                          {Math.round((totalSavings / gridBaselineTotal) * 100)}%)
                        </span>
                      </div>
                    </div>

                    {/* Settlement & Billing Option */}
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-2">
                        Settlement & Billing Method
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        <button
                          type="button"
                          onClick={() => setBillingOption('discom_bill')}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                            billingOption === 'discom_bill'
                              ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <Building className="w-4 h-4 text-emerald-700 mb-1" />
                          <span className="font-bold text-xs text-slate-900 block">Monthly DISCOM Bill</span>
                          <span className="text-[10px] text-slate-500">Auto-credited on power bill</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setBillingOption('wallet_upi')}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                            billingOption === 'wallet_upi'
                              ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <CreditCard className="w-4 h-4 text-blue-600 mb-1" />
                          <span className="font-bold text-xs text-slate-900 block">Prepaid / UPI</span>
                          <span className="text-[10px] text-slate-500">Instant direct settlement</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setBillingOption('blockchain_escrow')}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                            billingOption === 'blockchain_escrow'
                              ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <Blocks className="w-4 h-4 text-purple-600 mb-1" />
                          <span className="font-bold text-xs text-slate-900 block">Smart Contract</span>
                          <span className="text-[10px] text-slate-500">Escrow on Polygon testnet</span>
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={handleProceedToGrid}
                      disabled={isCheckingGrid}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isCheckingGrid ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Verifying Feeder Capacity & Transformer Clearance...</span>
                        </>
                      ) : (
                        <>
                          <span>Verify Feeder Clearance & Continue</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* STEP 3: GRID MEDIAN & CLEARANCE VERIFICATION */}
                {purchaseStep === 3 && (
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs max-w-2xl mx-auto space-y-6 animate-fade-in">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                      <div>
                        <span className="text-xs text-slate-500 block">DISCOM Verification Gate</span>
                        <h2 className="text-base font-bold text-slate-900">Physical Grid Clearance Approved</h2>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Safe for Injection
                      </span>
                    </div>

                    {/* Feeder technical status */}
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block mb-1 text-[11px]">Substation Feeder</span>
                        <span className="font-mono font-bold text-slate-900">{selectedFeeder}</span>
                        <span className="text-[10px] text-slate-400 block mt-1">11 kV Distribution</span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block mb-1 text-[11px]">Reverse Headroom</span>
                        <span className="font-mono font-bold text-emerald-700">
                          {gridState ? gridState.headroom_kw.toFixed(1) : '68.0'} kW
                        </span>
                        <span className="text-[10px] text-emerald-600 block mt-1">Sufficient for {purchaseKwh} kWh</span>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block mb-1 text-[11px]">Network Losses</span>
                        <span className="font-mono font-bold text-slate-900">&lt; 1.4%</span>
                        <span className="text-[10px] text-slate-400 block mt-1">Non-congested feeder</span>
                      </div>
                    </div>

                    {/* LangGraph Feature 1 & 4 Demand Response Notice */}
                    <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-amber-950 flex items-center gap-1.5">
                          <Zap className="w-4 h-4 text-amber-600 fill-amber-600" />
                          AI Demand Response Guardian (LangGraph)
                        </span>
                        <span className="text-[10px] bg-amber-200/80 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                          Active Monitoring
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-900 leading-relaxed">
                        If local transformer load exceeds 85% during peak hours, our LangGraph agent will automatically signal participating flexible loads to throttle and offer incentive credits, ensuring uninterrupted P2P energy flow.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsDemandResponseOpen(true)}
                        className="text-xs font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer flex items-center gap-1 pt-1"
                      >
                        Inspect Feeder Congestion Agent →
                      </button>
                    </div>

                    {/* Final Order Review */}
                    <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2 text-xs font-mono">
                      <div className="flex justify-between text-slate-300">
                        <span>Energy Quantity:</span>
                        <span className="text-white font-bold">{purchaseKwh} kWh Solar</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>P2P Tariff:</span>
                        <span className="text-white font-bold">₹{activePackagePrice.toFixed(2)} / kWh</span>
                      </div>
                      <div className="flex justify-between text-slate-300">
                        <span>DISCOM Wheeling Fee:</span>
                        <span className="text-white font-bold">₹{wheelingCharge.toFixed(2)}</span>
                      </div>
                      <div className="pt-2 border-t border-slate-700 flex justify-between text-sm font-bold text-emerald-400">
                        <span>Total Payable:</span>
                        <span>₹{estimatedTotal.toFixed(2)}</span>
                      </div>
                    </div>

                    <button
                      onClick={handleExecutePurchaseAndSettle}
                      disabled={isCheckingGrid}
                      className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isCheckingGrid ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Finalizing Trade & Generating DISCOM Invoice...</span>
                        </>
                      ) : (
                        <>
                          <span>Confirm Purchase & Settle Clean Energy</span>
                          <Check className="w-4 h-4 stroke-[3]" />
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

                    {/* LangGraph Feature 5: Smart Meter Oracle Card in Step 4 */}
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50/80 to-blue-50/80 border border-indigo-200 text-left space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                          <Shield className="w-4 h-4 text-indigo-600" />
                          Smart Meter Oracle & Delivery Verification (LangGraph)
                        </span>
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                          AI Oracle Guard
                        </span>
                      </div>
                      <p className="text-[11px] text-indigo-900 leading-relaxed">
                        What if the seller experienced rooftop cloud cover during generation? The LangGraph Oracle compares physical meter export against this contracted trade, automatically issuing prorated buyer refunds and adjusted DISCOM wheeling fees with cryptographic SHA-256 audit receipts.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveDisputeTrade({
                            id: settlementModalData?.trade_id || trades[0]?.trade_id || 'TR-DEMO-001',
                            kwh: purchaseKwh,
                            price: activePackagePrice,
                          })
                          setIsDisputeOpen(true)
                        }}
                        className="w-full py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <span>⚖️ Verify Smart Meter Telemetry & Simulate Oracle Dispute</span>
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

                {/* ── PROSUMER SOLAR BATCHES (ORDER BOOK) INTEGRATED BELOW WIZARD ── */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <Sun className="w-4 h-4 text-amber-500" />
                        Active Prosumer Solar Batches (Order Book)
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Live rooftop solar households feeding surplus green electricity into {selectedFeeder}.
                      </p>
                    </div>
                    <button
                      onClick={() => setIsSellerModalOpen(true)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 cursor-pointer self-start sm:self-auto transition-colors"
                    >
                      <PlusCircle className="w-4 h-4" />
                      List Surplus Solar Energy
                    </button>
                  </div>

                  <div className="border border-slate-100 rounded-2xl overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-100">
                        <tr>
                          <th className="p-3.5 font-bold">Listing</th>
                          <th className="p-3.5 font-bold">Seller Type</th>
                          <th className="p-3.5 font-bold">Feeder</th>
                          <th className="p-3.5 font-bold">Quantity</th>
                          <th className="p-3.5 font-bold">Ask Rate</th>
                          <th className="p-3.5 font-bold">Status</th>
                          <th className="p-3.5 text-right font-bold">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orders
                          .filter((o) => o.side === 'sell')
                          .map((o) => (
                            <tr key={o.order_id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="p-3.5 font-mono text-slate-600">#{o.order_id.slice(0, 8)}</td>
                              <td className="p-3.5 font-semibold text-slate-900 flex items-center gap-1.5">
                                <Sun className="w-3.5 h-3.5 text-amber-500" />
                                Rooftop Prosumer
                              </td>
                              <td className="p-3.5 text-slate-600">{o.feeder_id}</td>
                              <td className="p-3.5 font-mono font-bold text-slate-900">
                                {(o.quantity_kwh - o.filled_kwh).toFixed(1)} kWh
                              </td>
                              <td className="p-3.5 font-mono font-bold text-emerald-700">
                                ₹{(o.min_price || 4.2).toFixed(2)} / kWh
                              </td>
                              <td className="p-3.5">
                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                                  {o.status}
                                </span>
                              </td>
                              <td className="p-3.5 text-right">
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
                                    setActiveTab('unified')
                                    setPurchaseStep(2)
                                    window.scrollTo({ top: 0, behavior: 'smooth' })
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-emerald-600 text-white font-bold text-xs transition-colors cursor-pointer"
                                >
                                  Buy This Batch
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* ── RIGHT PANE: LIVE GRID TELEMETRY & RECENT SETTLEMENTS STREAM (5 cols on xl) ── */}
              <div className="xl:col-span-5 2xl:col-span-4 space-y-5 xl:sticky xl:top-20">
                {/* CARD 1: FEEDER TRANSFORMER TELEMETRY */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shadow-xs">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Feeder Headroom Telemetry</h3>
                        <span className="text-[10px] text-slate-400 font-mono">{selectedFeeder} • 11kV Substation</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      LIVE FEED
                    </span>
                  </div>

                  {/* Transformer Load Progress */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-slate-500">Transformer Load:</span>
                      <span className="text-sm font-bold font-mono text-slate-900">
                        {gridState ? gridState.load_kw.toFixed(1) : '32.0'}{' '}
                        <span className="text-[11px] text-slate-400 font-normal">/ {gridState?.capacity_kw || 100} kW</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          gridState && (gridState.load_kw / gridState.capacity_kw) > 0.85
                            ? 'bg-rose-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${gridState ? Math.min((gridState.load_kw / gridState.capacity_kw) * 100, 100) : 32}%`
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] pt-1">
                      <span className="text-slate-500">Reverse Headroom:</span>
                      <span className="font-bold text-emerald-700 font-mono">
                        {gridState ? gridState.headroom_kw.toFixed(1) : '68.0'} kW Available
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-500">DISCOM Wheeling Fee:</span>
                      <span className="font-bold text-blue-700 font-mono">₹0.02 / kWh</span>
                    </div>
                  </div>

                  {/* LangGraph Demand Response Optimization CTA */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
                        AI Demand Response (LangGraph)
                      </span>
                      <span className="text-[10px] bg-amber-200/80 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                        Automated
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-900 leading-tight">
                      Dynamically balance transformer headroom during reverse-injection congestion using AI curtailment incentives.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsDemandResponseOpen(true)}
                      className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>⚡ Run Demand Response Check</span>
                    </button>
                  </div>
                </div>

                {/* CARD 2: RECENT SETTLED TRADES STREAM */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Recent Settled Trades</h3>
                        <span className="text-[10px] text-slate-400">Live P2P Settlements</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold font-mono text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                      {trades.length} cleared
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {trades.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-2xl">
                        No trades settled yet. Complete an energy purchase on the left to see settlements stream live!
                      </div>
                    ) : (
                      trades.slice(0, 4).map((t) => (
                        <div
                          key={t.trade_id}
                          className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 hover:border-emerald-300 transition-all space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-bold text-slate-900">
                                {t.quantity_kwh.toFixed(1)} kWh
                              </span>
                              <span className="text-[11px] text-emerald-700 font-bold font-mono">
                                @ ₹{t.clearing_price.toFixed(2)}
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                              {t.status}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <span>#{t.trade_id.slice(0, 8)}</span>
                            <span>{new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>

                          <div className="flex items-center gap-1.5 pt-1">
                            <button
                              onClick={() => handleOpenInvoice(t.trade_id)}
                              className="flex-1 py-1 px-1.5 rounded-lg bg-slate-900 hover:bg-emerald-600 text-white font-bold text-[10px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            >
                              <FileText className="w-3 h-3" />
                              Invoice
                            </button>
                            <button
                              onClick={() => handleOpenBlockchain(t.trade_id)}
                              className="flex-1 py-1 px-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-bold text-[10px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                            >
                              <Blocks className="w-3 h-3 text-purple-600" />
                              Chain
                            </button>
                            <button
                              onClick={() => handleOpenDispute(t)}
                              className="flex-1 py-1 px-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-[10px] flex items-center justify-center gap-1 transition-colors cursor-pointer"
                              title="Audit with LangGraph Smart Meter Oracle"
                            >
                              <span>⚖️ Oracle</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {trades.length > 0 && (
                    <button
                      onClick={() => setActiveTab('invoices')}
                      className="w-full py-2 text-center text-xs font-bold text-slate-600 hover:text-emerald-700 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <span>View Complete Billing Ledger ({trades.length})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* CARD 3: SMART METER AMI STATUS */}
                <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-800">Smart Meter AMI Status</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">MTR-H001</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block">Current Generation</span>
                      <span className="font-mono font-bold text-amber-600">3.50 kW (Solar)</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block">Premises Load</span>
                      <span className="font-mono font-bold text-slate-700">0.28 kW</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* PROSUMER SOLAR STUDIO (ACTIVE TAB: SELL_STUDIO)                       */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'sell_studio' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start animate-fade-in">
              {/* ── LEFT PANE: SOLAR TELEMETRY & LISTING STUDIO (7 cols on xl, 8 on 2xl) ── */}
              <div className="xl:col-span-7 2xl:col-span-8 space-y-6">

                {/* 1. HERO REAL-TIME ROOFTOP SOLAR & STORAGE STATUS */}
                <div className="bg-gradient-to-br from-amber-500/10 via-emerald-500/5 to-slate-50 border border-amber-200/80 rounded-3xl p-6 shadow-xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                        <Sun className="w-6 h-6 animate-spin-slow" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-black text-slate-900">Rooftop Solar Generation Hub</h2>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            PRODUCING NOW
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          5.0 kW Monocrystalline Array • Feeder: {selectedFeeder} • Inverter #{userProfile?.username || 'prosumer_01'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">Grid Feed-in Mode:</span>
                      <span className="text-xs font-mono font-bold text-emerald-700 bg-white px-3 py-1 rounded-xl border border-slate-200 shadow-xs">
                        P2P Priority
                      </span>
                    </div>
                  </div>

                  {/* 4-Metric Real-time Power Flow Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3.5 rounded-2xl bg-white border border-amber-200/70 shadow-xs">
                      <span className="text-slate-400 block text-[11px] mb-1 font-medium flex items-center gap-1">
                        <Sun className="w-3.5 h-3.5 text-amber-500" /> PV Generation
                      </span>
                      <span className="text-xl font-black font-mono text-amber-600">4.20 kW</span>
                      <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">84% Inverter Capacity</span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs">
                      <span className="text-slate-400 block text-[11px] mb-1 font-medium flex items-center gap-1">
                        <Building className="w-3.5 h-3.5 text-slate-500" /> Home Load
                      </span>
                      <span className="text-xl font-black font-mono text-slate-800">0.80 kW</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Self-consumption</span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white border border-emerald-300 shadow-xs ring-2 ring-emerald-500/10">
                      <span className="text-emerald-700 block text-[11px] mb-1 font-bold flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" /> Export Surplus
                      </span>
                      <span className="text-xl font-black font-mono text-emerald-700">+3.40 kW</span>
                      <span className="text-[10px] text-emerald-800 font-bold block mt-0.5">~14.5 kWh Available</span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white border border-blue-200 shadow-xs">
                      <span className="text-slate-400 block text-[11px] mb-1 font-medium flex items-center gap-1">
                        <BatteryCharging className="w-3.5 h-3.5 text-blue-600" /> Battery Storage
                      </span>
                      <span className="text-xl font-black font-mono text-blue-700">85%</span>
                      <span className="text-[10px] text-blue-600 block mt-0.5">4.2 / 5.0 kWh (Full)</span>
                    </div>
                  </div>

                  {/* Visual Live Energy Balance Bar */}
                  <div className="p-3.5 rounded-2xl bg-white/80 border border-slate-200/80 space-y-1.5">
                    <div className="flex justify-between text-[11px] text-slate-600 font-medium">
                      <span>Solar Power Routing: 4.20 kW Total</span>
                      <span>19% Home Consumption • 81% Exportable to Neighbors</span>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex">
                      <div className="bg-slate-400 h-full" style={{ width: '19%' }} title="Household Load: 0.80 kW" />
                      <div className="bg-emerald-500 h-full" style={{ width: '81%' }} title="Exportable Surplus: 3.40 kW" />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono pt-0.5">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400" /> Home Load: 0.8 kW</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> P2P Neighborhood Export: 3.4 kW</span>
                    </div>
                  </div>
                </div>

                {/* 2. INTERACTIVE SMART P2P ENERGY LISTING CREATOR */}
                <form onSubmit={handlePostSellOrder} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <Coins className="w-5 h-5 text-emerald-600" />
                        List Surplus Solar Energy for P2P Sale
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Set your quantity and price to earn up to 70% higher payouts than standard utility net-metering.
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold font-mono">
                      Clearing: ₹{marketPrice ? marketPrice.price.toFixed(2) : '4.10'}/kWh
                    </span>
                  </div>

                  {/* Success Alert */}
                  {sellPublishSuccess && (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 font-medium animate-fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>{sellPublishSuccess}</span>
                    </div>
                  )}

                  {/* SECTION 1: VOLUME SELECTOR */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">1. Solar Energy Volume to Sell (kWh)</label>
                      <span className="text-xs font-mono font-bold text-emerald-700">
                        Max Surplus: 14.5 kWh
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="1"
                        max="25"
                        step="0.5"
                        value={sellQty}
                        onChange={(e) => setSellQty(e.target.value)}
                        className="flex-1 accent-emerald-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                      />
                      <div className="w-28 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-center font-bold text-slate-900 text-sm">
                        {sellQty} kWh
                      </div>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex flex-wrap gap-2">
                      {[
                        { label: '5 kWh', val: '5.0' },
                        { label: '10 kWh', val: '10.0' },
                        { label: '14.5 kWh (Full Surplus)', val: '14.5' },
                        { label: '20 kWh (+Battery)', val: '20.0' },
                      ].map((p) => (
                        <button
                          key={p.val}
                          type="button"
                          onClick={() => setSellQty(p.val)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            sellQty === p.val
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SECTION 2: PRICING STRATEGY & FINANCIAL UPLIFT CALCULATOR */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">2. Set Asking Rate (₹/kWh)</label>
                      <span className="text-[11px] text-slate-400">
                        Market clearing range: ₹3.80 - ₹4.50/kWh
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Option A: Utility Baseline */}
                      <button
                        type="button"
                        onClick={() => setSellPrice('2.50')}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          sellPrice === '2.50'
                            ? 'border-slate-800 bg-slate-50 ring-2 ring-slate-400/20'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Utility Baseline</span>
                        <span className="text-base font-black font-mono text-slate-900 block">₹2.50 / kWh</span>
                        <span className="text-[10px] text-rose-600 font-semibold">Standard Net-Metering</span>
                      </button>

                      {/* Option B: Optimal P2P (Recommended) */}
                      <button
                        type="button"
                        onClick={() => setSellPrice('4.20')}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                          sellPrice === '4.20'
                            ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <span className="absolute -top-2 right-2 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] font-bold">
                          RECOMMENDED
                        </span>
                        <span className="text-[10px] text-emerald-800 block font-bold uppercase">Fast P2P Clearing</span>
                        <span className="text-base font-black font-mono text-emerald-700 block">₹4.20 / kWh</span>
                        <span className="text-[10px] text-emerald-700 font-bold">+68% vs Utility</span>
                      </button>

                      {/* Option C: Peak Demand */}
                      <button
                        type="button"
                        onClick={() => setSellPrice('5.50')}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          sellPrice === '5.50'
                            ? 'border-amber-600 bg-amber-50/50 ring-2 ring-amber-500/20'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <span className="text-[10px] text-amber-800 block font-bold uppercase">Peak Shaving</span>
                        <span className="text-base font-black font-mono text-amber-700 block">₹5.50 / kWh</span>
                        <span className="text-[10px] text-amber-800 font-semibold">+120% (Evening)</span>
                      </button>
                    </div>

                    {/* Custom Price Input */}
                    <div className="flex items-center gap-3 pt-1">
                      <span className="text-xs text-slate-500 font-medium">Custom Rate:</span>
                      <div className="relative w-32">
                        <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          step="0.10"
                          min="2.00"
                          max="8.00"
                          value={sellPrice}
                          onChange={(e) => setSellPrice(e.target.value)}
                          className="w-full pl-7 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-xs text-slate-900 focus:outline-none focus:border-emerald-600"
                        />
                      </div>
                      <span className="text-[11px] text-slate-400">/ kWh</span>
                    </div>

                    {/* Real-time Earnings & Uplift Box */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                      <div className="flex justify-between text-slate-600">
                        <span>Gross P2P Value ({sellerKwh} kWh @ ₹{sellerUnitPrice.toFixed(2)}):</span>
                        <span className="font-mono font-bold text-slate-900">₹{sellerGrossEarnings.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>DISCOM Wheeling Deduction (₹0.02/kWh):</span>
                        <span className="font-mono font-semibold text-slate-500">- ₹{sellerWheelingDeduction.toFixed(2)}</span>
                      </div>
                      <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900 text-sm">
                        <span>Net Payout Deposited to Your Account:</span>
                        <span className="font-mono text-emerald-700">₹{sellerNetEarnings.toFixed(2)}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-emerald-950 font-medium">
                        <span className="text-[11px]">Compared to net-metering export (₹{utilityNetMeteringBaseline.toFixed(2)}):</span>
                        <span className="font-mono font-bold text-xs text-emerald-700">
                          +₹{sellerNetUplift.toFixed(2)} Extra Profit ({sellerUpliftPercent > 0 ? `+${sellerUpliftPercent}%` : '0%'})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: DELIVERY TIME WINDOW */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 block">3. Delivery Window (Export Commitment)</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setSellSlot('solar_peak')}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          sellSlot === 'solar_peak'
                            ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 text-amber-600 font-bold text-xs">
                          <Sun className="w-3.5 h-3.5" /> Solar Peak Window
                        </div>
                        <span className="text-[11px] text-slate-600 block font-mono">11:00 AM – 03:00 PM</span>
                        <span className="text-[10px] text-slate-400">Direct PV generation export</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSellSlot('evening_battery')}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          sellSlot === 'evening_battery'
                            ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 text-purple-600 font-bold text-xs">
                          <BatteryCharging className="w-3.5 h-3.5" /> Evening Peak Shaving
                        </div>
                        <span className="text-[11px] text-slate-600 block font-mono">06:00 PM – 09:00 PM</span>
                        <span className="text-[10px] text-slate-400">Discharges stored battery power</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSellSlot('immediate')}
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          sellSlot === 'immediate'
                            ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 text-blue-600 font-bold text-xs">
                          <Zap className="w-3.5 h-3.5" /> Immediate Dispatch
                        </div>
                        <span className="text-[11px] text-slate-600 block font-mono">Real-time Injection</span>
                        <span className="text-[10px] text-slate-400">Instant order book matching</span>
                      </button>
                    </div>
                  </div>

                  {/* SECTION 4: AI AGENT AUTO-PILOT TOGGLE */}
                  <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200 flex items-center justify-between gap-4 text-xs">
                    <div className="space-y-0.5">
                      <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        AI Auto-Pilot Surplus Export (LangGraph)
                      </span>
                      <p className="text-[11px] text-indigo-900 leading-tight">
                        Automatically list your surplus solar whenever feeder clearing prices exceed ₹4.00/kWh without manual intervention.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAutoPilotListing(!autoPilotListing)}
                      className={`w-12 h-6 rounded-full transition-colors p-1 cursor-pointer flex items-center ${
                        autoPilotListing ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
                      }`}
                    >
                      <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
                    </button>
                  </div>

                  {/* SUBMIT BUTTON */}
                  <button
                    type="submit"
                    disabled={submittingOrder || sellerKwh <= 0}
                    className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    {submittingOrder ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Registering Solar Batch with Substation Feeder...</span>
                      </>
                    ) : (
                      <>
                        <span>Publish {sellerKwh} kWh Solar Batch to Feeder Order Book</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* 3. MY ACTIVE SELL ORDERS & EXECUTION HISTORY TABLE */}
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <Sun className="w-4 h-4 text-amber-500" />
                        My Published Solar Batches & Execution History
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Track real-time peer matching, fill status, and DISCOM grid clearance.
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                      {orders.filter((o) => o.side === 'sell').length} Batches
                    </span>
                  </div>

                  <div className="border border-slate-100 rounded-2xl overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-100">
                        <tr>
                          <th className="p-3.5 font-bold">Listing ID</th>
                          <th className="p-3.5 font-bold">Total Qty</th>
                          <th className="p-3.5 font-bold">Filled</th>
                          <th className="p-3.5 font-bold">Ask Rate</th>
                          <th className="p-3.5 font-bold">Status</th>
                          <th className="p-3.5 font-bold">Interval</th>
                          <th className="p-3.5 text-right font-bold">Est. Earnings</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orders
                          .filter((o) => o.side === 'sell')
                          .map((o) => {
                            const estVal = o.quantity_kwh * (o.min_price || 4.2)
                            const fillPct = Math.round((o.filled_kwh / o.quantity_kwh) * 100)
                            return (
                              <tr key={o.order_id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="p-3.5 font-mono text-slate-600">#{o.order_id.slice(0, 8)}</td>
                                <td className="p-3.5 font-mono font-bold text-slate-900">{o.quantity_kwh.toFixed(1)} kWh</td>
                                <td className="p-3.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                      <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${fillPct}%` }} />
                                    </div>
                                    <span className="font-mono text-[10px] text-slate-600">{fillPct}%</span>
                                  </div>
                                </td>
                                <td className="p-3.5 font-mono font-bold text-emerald-700">₹{(o.min_price || 4.2).toFixed(2)}</td>
                                <td className="p-3.5">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    o.status === 'OPEN' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-blue-50 text-blue-800'
                                  }`}>
                                    {o.status.toUpperCase()}
                                  </span>
                                </td>
                                <td className="p-3.5 text-slate-500 font-mono text-[11px]">{o.interval || 'Immediate'}</td>
                                <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                                  ₹{estVal.toFixed(2)}
                                </td>
                              </tr>
                            )
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* ── RIGHT PANE: SELLER REVENUE, HEADROOM & AMI STATUS (5 cols on xl) ── */}
              <div className="xl:col-span-5 2xl:col-span-4 space-y-5 xl:sticky xl:top-20">

                {/* CARD 1: PROSUMER REVENUE & EARNINGS SUMMARY */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shadow-xs">
                        <Coins className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Prosumer Revenue Summary</h3>
                        <span className="text-[10px] text-slate-400 font-mono">Current Billing Cycle</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      AUTO-PAY ENABLED
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[10px] text-slate-400 block font-medium">Monthly P2P Sales</span>
                      <span className="text-lg font-black font-mono text-slate-900 mt-0.5 block">342.5 kWh</span>
                      <span className="text-[10px] text-emerald-600 font-medium">100% Green Solar</span>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200">
                      <span className="text-[10px] text-emerald-800 block font-medium">Net P2P Revenue</span>
                      <span className="text-lg font-black font-mono text-emerald-700 mt-0.5 block">₹1,438.50</span>
                      <span className="text-[10px] text-emerald-700 font-bold">+₹582 Extra vs Utility</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                    <div className="flex justify-between text-slate-600">
                      <span>Pending Payout Balance:</span>
                      <span className="font-mono font-bold text-slate-900">₹242.00</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Settlement Method:</span>
                      <span className="font-semibold text-slate-800">DISCOM Bill Credit</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Next Settlement Date:</span>
                      <span className="font-mono text-slate-800">End of Month</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab('invoices')}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-emerald-600 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>View Detailed Settlement Invoices</span>
                  </button>
                </div>

                {/* CARD 2: FEEDER REVERSE HEADROOM & INJECTION SAFETY */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Substation Injection Clearance</h3>
                        <span className="text-[10px] text-slate-400 font-mono">{selectedFeeder} • 11kV</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      SAFE FOR EXPORT
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Available Reverse Headroom:</span>
                      <span className="font-bold text-emerald-700 font-mono">{gridState ? gridState.headroom_kw.toFixed(1) : '68.0'} kW</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Transformer Reverse Limit:</span>
                      <span className="font-mono text-slate-700">100 kW max</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">DISCOM Wheeling Fee:</span>
                      <span className="font-mono text-blue-700 font-bold">₹0.02 / kWh deducted</span>
                    </div>
                  </div>

                  {/* Demand Response Incentive Callout */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
                        Demand Response Rewards (LangGraph)
                      </span>
                      <span className="text-[10px] bg-amber-200/80 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                        +₹1.50/kWh
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-900 leading-tight">
                      Earn premium rewards by letting the AI agent throttle battery charging or export stored power during substation peak hours.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsDemandResponseOpen(true)}
                      className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>⚡ Check Demand Response Incentives</span>
                    </button>
                  </div>
                </div>

                {/* CARD 3: SMART INVERTER AMI TELEMETRY */}
                <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-800">Smart Inverter Telemetry</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">Node #MTR-H001</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-center">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block">Frequency</span>
                      <span className="font-mono font-bold text-slate-800">50.02 Hz</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block">Voltage</span>
                      <span className="font-mono font-bold text-slate-800">231.4 V</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block">CO2 Saved</span>
                      <span className="font-mono font-bold text-emerald-600">1,284 kg</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* TAB 3: DISCOM SETTLEMENT INVOICES                                     */}
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

                          <button
                            onClick={() => handleOpenDispute(t)}
                            className="px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 font-bold text-xs shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Verify Smart Meter Telemetry vs Contract using LangGraph Oracle"
                          >
                            <span>⚖️ Oracle Audit</span>
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

      {/* ── LANGGRAPH FEATURES 1, 4 & 5 MODALS & COPILOT ─────────────────────── */}
      <CopilotDrawer
        currentFeeder={selectedFeeder}
        onTradeExecuted={loadData}
      />

      <DemandResponseModal
        isOpen={isDemandResponseOpen}
        onClose={() => setIsDemandResponseOpen(false)}
        currentFeeder={selectedFeeder}
      />

      <DisputeResolutionModal
        isOpen={isDisputeOpen}
        onClose={() => setIsDisputeOpen(false)}
        tradeId={activeDisputeTrade?.id || 'TR-DEMO-001'}
        initialContractedKwh={activeDisputeTrade?.kwh || 10.0}
        initialPricePerKwh={activeDisputeTrade?.price || 5.40}
      />
    </div>
  )
}
