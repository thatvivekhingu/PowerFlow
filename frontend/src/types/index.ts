// ── Shared API types matching backend Pydantic schemas ────────────────────────

export type UserRole = 'prosumer' | 'consumer' | 'discom_operator' | 'regulator'
export type OrderSide = 'buy' | 'sell'
export type OrderStatus = 'OPEN' | 'PARTIALLY_FILLED' | 'MATCHED' | 'SETTLED' | 'CANCELLED' | 'EXPIRED'
export type TradeStatus = 'OPEN' | 'MATCHED' | 'GRID_LIMITED' | 'SETTLED' | 'REJECTED' | 'UTILITY_EXPORT'
export type CongestionBand = 'GREEN' | 'AMBER' | 'RED'
export type BillingStatus = 'PENDING' | 'DISPATCHED' | 'CONFIRMED' | 'FAILED'

export interface AuthToken {
  access_token: string
  token_type: string
  role: UserRole
  user_id: string
  feeder_id: string
}

export interface MeterReading {
  reading_id: string
  meter_id: string
  feeder_id: string
  timestamp: string
  generation_kwh: number
  consumption_kwh: number
  export_kwh: number
  surplus_kwh: number
  is_valid: boolean
  ingested_at: string
}

export interface MarketPrice {
  feeder_id: string
  price: number
  p_base: number
  demand_index: number
  supply_index: number
  c_congestion: number
  timestamp: string
}

export interface Order {
  order_id: string
  user_id: string
  feeder_id: string
  side: OrderSide
  quantity_kwh: number
  filled_kwh: number
  min_price?: number
  max_price?: number
  interval: string
  status: OrderStatus
  created_at: string
  updated_at: string
}

export interface Trade {
  trade_id: string
  buy_order_id?: string
  sell_order_id: string
  feeder_id: string
  quantity_kwh: number
  allowed_kwh?: number
  clearing_price: number
  status: TradeStatus
  grid_notes?: string
  timestamp: string
  settled_at?: string
}

export interface GridState {
  feeder_id: string
  transformer_id: string
  load_kw: number
  capacity_kw: number
  headroom_kw: number
  congestion_level: number
  congestion_band: CongestionBand
  recorded_at: string
}

export interface Settlement {
  settlement_id: string
  trade_id: string
  seller_ref: string
  buyer_ref: string
  quantity_kwh: number
  clearing_price: number
  gross_value: number
  platform_fee: number
  seller_credit: number
  buyer_debit: number
  utility_reference?: string
  billing_status: BillingStatus
  audit_tx?: string
  settled_at: string
}

export interface DashboardSummary {
  prosumer_revenue_uplift_inr: number
  consumer_savings_inr: number
  local_matching_rate: number
  grid_utilization_pct: number
  unmatched_energy_rate: number
  settlement_success_rate: number
  total_trades: number
  settled_trades: number
  rejected_trades: number
  utility_export_trades: number
  total_surplus_kwh: number
  matched_kwh: number
  unmatched_kwh: number
  current_price_inr: Record<string, number>
  active_orders: number
  as_of: string
}

export type WSEventType = 'price_update' | 'order_matched' | 'grid_alert' | 'settlement_complete' | 'connected' | 'pong'

export interface WSEvent {
  event: WSEventType
  data: Record<string, unknown>
  timestamp: string
}

export interface BlockchainProof {
  status: string
  network: string
  chain_id: number
  contract_address: string
  tx_hash: string
  block_number: number
  gas_used: number
  audit_hash: string
  explorer_url: string
  raw_payload: string
  verified: boolean
}
