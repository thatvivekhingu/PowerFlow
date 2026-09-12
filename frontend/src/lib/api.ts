'use client'

import type { AuthToken, MarketPrice, Order, Trade, GridState, DashboardSummary, MeterReading, Settlement, BlockchainProof } from '@/types'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ── Auth storage ──────────────────────────────────────────────────────────────
let _token: string | null = null

export function setToken(t: string) { _token = t }
export function getToken(): string | null { return _token }

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (_token) headers['Authorization'] = `Bearer ${_token}`

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function login(username: string, password: string): Promise<AuthToken> {
  const form = new URLSearchParams()
  form.append('username', username)
  form.append('password', password)
  const res = await fetch(`${API_BASE}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })
  if (!res.ok) throw new Error('Login failed')
  const data: AuthToken = await res.json()
  setToken(data.access_token)
  return data
}

// ── Market ────────────────────────────────────────────────────────────────────
export const getMarketPrice = (feeder_id: string) =>
  request<MarketPrice>(`/api/market/price?feeder_id=${feeder_id}`)

// ── Orders ────────────────────────────────────────────────────────────────────
export const getOrders = (status?: string) =>
  request<Order[]>(`/api/orders${status ? `?status=${status}` : ''}`)

export const getOrder = (id: string) =>
  request<Order>(`/api/orders/${id}`)

export const createOrder = (body: {
  side: 'buy' | 'sell'
  quantity_kwh: number
  min_price?: number
  max_price?: number
  interval: string
}) => request<Order>('/api/orders', { method: 'POST', body: JSON.stringify(body) })

// ── Trades ────────────────────────────────────────────────────────────────────
export const getTrades = (feeder_id?: string, status?: string) => {
  const params = new URLSearchParams()
  if (feeder_id) params.append('feeder_id', feeder_id)
  if (status) params.append('status', status)
  return request<Trade[]>(`/api/trades?${params}`)
}

export const settleTrade = (id: string) =>
  request<Settlement>(`/api/trades/${id}/settle`, { method: 'POST' })

export const getTradeSettlement = (id: string) =>
  request<Settlement>(`/api/trades/${id}/settlement`)

export const getBlockchainProof = (id: string) =>
  request<BlockchainProof>(`/api/trades/${id}/blockchain-proof`)

// ── Grid ──────────────────────────────────────────────────────────────────────
export const getFeederStatus = (feeder_id: string) =>
  request<GridState>(`/api/grid/${feeder_id}/status`)

export const getAllFeeders = () =>
  request<GridState[]>('/api/grid')

// ── Meter Readings ────────────────────────────────────────────────────────────
export const getMeterReadings = (meter_id: string) =>
  request<MeterReading[]>(`/api/meters/readings/${meter_id}`)

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const getDashboardSummary = () =>
  request<DashboardSummary>('/api/dashboard/summary')

// ── LangGraph Agent & Copilot ──────────────────────────────────────────────────
export interface AgentChatResponse {
  response: string
  intent: string
  feeder_id?: string
  confirmation_required: boolean
  proposed_action?: {
    side: 'buy' | 'sell'
    quantity_kwh: number
    target_price: number
    feeder_id?: string
    estimated_discom_fee?: number
    estimated_total_inr?: number
    seller_name?: string
  }
  trace: string[]
  tools_called: string[]
}

export const sendAgentMessage = (
  query: string,
  history: Array<{ role: string; content: string }> = [],
  feederId: string = 'FEEDER-A'
) =>
  request<AgentChatResponse>('/api/agent/chat', {
    method: 'POST',
    body: JSON.stringify({
      query,
      feeder_id: feederId,
      conversation_history: history,
    }),
  })

export const confirmAgentAction = (approved: boolean, proposedAction: any) =>
  request<{
    status: string
    message: string
    order_id?: string
    trade_details?: any
  }>('/api/agent/confirm', {
    method: 'POST',
    body: JSON.stringify({
      approved,
      proposed_action: proposedAction,
    }),
  })

// ── LangGraph Demand Response & Congestion Mitigator ───────────────────────────
export interface DemandResponseResult {
  feeder_id: string
  current_load_kw: number
  capacity_kw: number
  utilization_pct: number
  target_utilization_pct: number
  required_reduction_kw: number
  flexible_loads: Array<{
    meter_id: string
    consumer_name: string
    load_type: string
    current_kw: number
    sheddable_kw: number
    curtailed: boolean
    incentive_earned_inr: number
  }>
  incentive_rate_inr_per_kwh: number
  curtailed_kw_achieved: number
  post_dr_load_kw: number
  post_dr_utilization_pct: number
  status: string
  summary: string
  trace: string[]
}

export const triggerDemandResponse = (
  feeder_id: string = 'FEEDER-A',
  current_load_kw?: number,
  capacity_kw?: number
) =>
  request<DemandResponseResult>('/api/agent/demand-response/trigger', {
    method: 'POST',
    body: JSON.stringify({
      feeder_id,
      current_load_kw,
      capacity_kw,
    }),
  })

// ── LangGraph Smart Meter Oracle & Dispute Resolution ─────────────────────────
export interface DisputeResolutionResult {
  trade_id: string
  contracted_kwh: number
  price_per_kwh: number
  actual_delivered_kwh: number
  shortfall_kwh: number
  shortfall_pct: number
  original_seller_credit: number
  original_buyer_debit: number
  original_discom_fee: number
  adjusted_seller_credit: number
  adjusted_buyer_refund: number
  adjusted_discom_fee: number
  net_buyer_paid: number
  audit_hash: string
  status: string
  resolution_summary: string
  trace: string[]
}

export const resolveDispute = (
  trade_id: string,
  contracted_kwh: number,
  price_per_kwh: number,
  actual_delivered_kwh?: number
) =>
  request<DisputeResolutionResult>('/api/agent/dispute/resolve', {
    method: 'POST',
    body: JSON.stringify({
      trade_id,
      contracted_kwh,
      price_per_kwh,
      actual_delivered_kwh,
    }),
  })

// ── Inter-Operator Handshake & Location API ──────────────────────────────────
export interface InterOperatorHandshakeResult {
  handshake_id: string
  is_cross_operator: boolean
  status: string
  reason?: string
  median_clearing_price: number
  buyer_operator: {
    feeder_id: string
    operator_id: string
    operator_name: string
    substation_name: string
    zone: string
    address: string
    latitude: number
    longitude: number
    transformer_capacity_kw: number
    base_wheeling_rate: number
  }
  seller_operator: {
    feeder_id: string
    operator_id: string
    operator_name: string
    substation_name: string
    zone: string
    address: string
    latitude: number
    longitude: number
    transformer_capacity_kw: number
    base_wheeling_rate: number
  }
  tie_line?: {
    tie_line_id: string
    capacity_kw: number
    current_load_kw: number
    transit_wheeling_fee: number
    status: string
    length_km: number
  }
  wheeling_charge_per_kwh?: number
  clearance_token?: string
  steps: {
    step_num: number
    title: string
    status: string
    timestamp: string
    detail: string
  }[]
  distance_info: {
    is_cross_operator: boolean
    physical_distance_km: number
    electrical_path: string
    transit_loss_pct: number
    wheeling_rate: number
  }
}

export const triggerInterOperatorHandshake = (
  buyer_feeder_id: string,
  seller_feeder_id: string,
  quantity_kwh: number,
  buyer_max_price?: number,
  seller_min_price?: number
) =>
  request<InterOperatorHandshakeResult>('/api/grid/inter-operator/handshake', {
    method: 'POST',
    body: JSON.stringify({
      buyer_feeder_id,
      seller_feeder_id,
      quantity_kwh,
      buyer_max_price,
      seller_min_price,
    }),
  })

export const getParticipantLocations = (
  buyer_feeder = 'FEEDER-02',
  seller_feeder = 'FEEDER-01'
) =>
  request<{
    buyer_location: any
    seller_location: any
    mediating_operator: any
    distance_info: any
  }>(`/api/grid/locations?buyer_feeder=${buyer_feeder}&seller_feeder=${seller_feeder}`)


