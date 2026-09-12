/**
 * ⚡ POWERFLOW — Supabase Client & Realtime Layer
 * 
 * Provides typed access to:
 * - Supabase PostgreSQL Database Views (v_marketplace_orders, v_feeder_health, v_available_energy, v_trade_summary)
 * - Supabase RPC Stored Procedures (fn_check_grid_safety, fn_create_validated_order, fn_match_orders, etc.)
 * - Supabase Realtime Channels for live orderbook, telemetry, and trade updates
 */

export interface FeederHealthView {
  feeder_id: string
  feeder_name: string
  feeder_code: string
  discom_name: string
  substation_name: string
  status: string
  nominal_voltage_kv: number
  max_capacity_kw: number
  current_load_kw: number
  headroom_kw: number
  utilization_pct: number
  health_status: 'NORMAL' | 'WARNING' | 'CRITICAL'
  active_meters: number
  active_solar_kw: number
}

export interface MarketplaceOrderView {
  order_id: string
  user_id: string
  full_name: string
  role: string
  feeder_id: string
  feeder_name: string
  feeder_code: string
  order_type: 'BUY' | 'SELL'
  side: 'BUY' | 'SELL'
  quantity_kwh: number
  filled_kwh: number
  remaining_kwh: number
  price_inr_per_kwh: number
  status: string
  delivery_start: string
  delivery_end: string
  created_at: string
}

export interface AvailableEnergyView {
  meter_id: string
  meter_number: string
  owner_id: string
  owner_name: string
  role: string
  feeder_id: string
  feeder_name: string
  feeder_code: string
  current_generation_kw: number
  current_load_kw: number
  realtime_surplus_kw: number
  solar_installed_kw: number
  storage_capacity_kwh: number
  storage_soc_pct: number
  last_telemetry_time: string
}

export interface GridSafetyCheckResult {
  is_safe: boolean
  status: string
  current_load_kw: number
  max_capacity_kw: number
  utilization_pct: number
  available_headroom_kw: number
  rejection_reason?: string
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const isSupabaseConfigured = (): boolean => {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
}

/**
 * Generic Supabase REST Query Helper
 */
async function supabaseRest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  }

  const headers: Record<string, string> = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || `Supabase REST error: ${res.status}`)
  }

  return res.json()
}

/**
 * Invoke Supabase RPC Stored Procedure
 */
export async function invokeRpc<T>(fnName: string, params: Record<string, unknown> = {}): Promise<T> {
  return supabaseRest<T>(`rpc/${fnName}`, {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

/**
 * Fetch Realtime Feeder Health View
 */
export async function getFeederHealth(): Promise<FeederHealthView[]> {
  return supabaseRest<FeederHealthView[]>('v_feeder_health?select=*')
}

/**
 * Fetch Active Marketplace Orders View
 */
export async function getMarketplaceOrders(): Promise<MarketplaceOrderView[]> {
  return supabaseRest<MarketplaceOrderView[]>('v_marketplace_orders?select=*&order=created_at.desc')
}

/**
 * Fetch Available Clean Energy Producers View
 */
export async function getAvailableEnergy(): Promise<AvailableEnergyView[]> {
  return supabaseRest<AvailableEnergyView[]>('v_available_energy?select=*')
}

/**
 * Execute Grid Safety Pre-Check via RPC
 */
export async function checkGridSafety(
  feederId: string,
  energyKwh: number,
  side: 'BUY' | 'SELL'
): Promise<GridSafetyCheckResult> {
  return invokeRpc<GridSafetyCheckResult>('fn_check_grid_safety', {
    p_feeder_id: feederId,
    p_energy_kwh: energyKwh,
    p_side: side,
  })
}

/**
 * Query user's real-time reconciled wallet balance
 */
export async function getWalletBalance(userId: string): Promise<number> {
  return invokeRpc<number>('fn_get_wallet_balance', {
    p_user_id: userId,
  })
}
