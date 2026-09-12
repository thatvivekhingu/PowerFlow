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
