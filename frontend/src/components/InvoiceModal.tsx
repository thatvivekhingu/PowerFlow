'use client'

import React from 'react'
import type { Settlement } from '@/types'
import { CheckCircle2, Download, X, User } from 'lucide-react'

interface InvoiceModalProps {
  settlement: Settlement | null
  isOpen: boolean
  onClose: () => void
  onViewBlockchain?: () => void
}

export default function InvoiceModal({ settlement, isOpen, onClose, onViewBlockchain }: InvoiceModalProps) {
  if (!isOpen) return null

  // Fallback / default values matching the mockup
  const tradeId = settlement?.trade_id || 'TRD-2026-001234'
  const qty = settlement?.quantity_kwh || 5.0
  const price = settlement?.clearing_price || 4.20
  const energyCost = settlement ? settlement.quantity_kwh * settlement.clearing_price : 21.00
  const wheelingFee = settlement?.platform_fee ? Number(settlement.platform_fee) : 1.25
  const platformFee = 0.50
  const totalAmount = energyCost + wheelingFee + platformFee

  const buyerName = settlement?.buyer_ref ? `Priya Sharma (${settlement.buyer_ref.slice(0, 8)})` : 'Priya Sharma'
  const sellerName = settlement?.seller_ref ? `Rohit Mehta (${settlement.seller_ref.slice(0, 8)})` : 'Rohit Mehta'

  const handleDownloadPdf = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-black">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm tracking-tight text-slate-900 uppercase">POWERFLOW</span>
                <span className="text-slate-400 text-xs">•</span>
                <h3 className="font-bold text-sm text-slate-800">Trade Invoice</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Completed
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                Transaction #{tradeId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Counterparties Cards */}
        <div className="p-5 space-y-4 text-xs text-slate-600">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                PS
              </div>
              <div className="overflow-hidden">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Buyer</span>
                <span className="font-bold text-slate-900 block truncate">{buyerName}</span>
                <span className="text-[10px] text-slate-500 truncate block">priya@example.com</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                RM
              </div>
              <div className="overflow-hidden">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Seller</span>
                <span className="font-bold text-slate-900 block truncate">{sellerName}</span>
                <span className="text-[10px] text-slate-500 truncate block">rohit@example.com</span>
              </div>
            </div>
          </div>

          {/* Trade Details Table */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50/80 px-4 py-2 border-b border-slate-100">
              <span className="font-bold text-[11px] text-slate-700">Trade Details</span>
            </div>
            <div className="p-4 space-y-2.5">
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-600">Energy Quantity</span>
                <span className="font-mono font-bold text-slate-900">{qty.toFixed(1)} kWh</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-600">Price per kWh</span>
                <span className="font-mono font-bold text-slate-900">₹{price.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-slate-100 pt-2">
                <span className="text-slate-600">Energy Cost</span>
                <span className="font-mono font-bold text-slate-900">₹{energyCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-1 text-slate-600">
                <span>DISCOM Wheeling Charge (₹0.25/kWh)</span>
                <span className="font-mono text-slate-900">₹{wheelingFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-1 text-slate-600">
                <span>Platform Fee</span>
                <span className="font-mono text-slate-900">₹{platformFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-t border-slate-200 mt-1 font-bold text-sm text-slate-900">
                <span>Total Amount</span>
                <span className="font-mono text-emerald-700 text-base">₹{totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div>
              <span className="text-slate-400 block text-[10px]">Date & Time</span>
              <span className="font-mono text-slate-700">Jan 15, 2026, 14:23:15</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Feeder</span>
              <span className="font-mono font-semibold text-slate-700">Feeder-01</span>
            </div>
            <div className="mt-1">
              <span className="text-slate-400 block text-[10px]">Payment Method</span>
              <span className="text-slate-700 font-medium">UPI Wallet</span>
            </div>
            <div className="mt-1">
              <span className="text-slate-400 block text-[10px]">Status</span>
              <span className="text-emerald-700 font-bold">Completed</span>
            </div>
          </div>

          {/* Eco Note */}
          <div className="text-center text-[11px] text-emerald-700 font-medium pt-1">
            🌱 Thank you for supporting clean energy!
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
          {onViewBlockchain && (
            <button
              onClick={onViewBlockchain}
              className="px-3.5 py-2 text-xs font-bold text-purple-700 hover:text-purple-900 hover:bg-purple-50 rounded-xl transition-colors cursor-pointer"
            >
              View Blockchain Proof
            </button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleDownloadPdf}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
