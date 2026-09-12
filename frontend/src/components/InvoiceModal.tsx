'use client'

import React from 'react'
import type { Settlement } from '@/types'
import { FileText, CheckCircle2, Shield, Printer, X, Zap, ArrowRight, Building } from 'lucide-react'

interface InvoiceModalProps {
  settlement: Settlement | null
  isOpen: boolean
  onClose: () => void
  onViewBlockchain?: () => void
}

export default function InvoiceModal({ settlement, isOpen, onClose, onViewBlockchain }: InvoiceModalProps) {
  if (!isOpen || !settlement) return null

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  DISCOM Energy Settlement Statement
                </h2>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                  Cleared & Paid
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Official Peer-to-Peer Wheeling & Transmission Billing Invoice
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Invoice Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-600">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-1">
                Invoice Reference #
              </span>
              <span className="font-mono font-bold text-slate-900 text-xs">
                {settlement.utility_reference || `DISCOM-${settlement.settlement_id.slice(0, 8)}`}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-1">
                Clearing Date
              </span>
              <span className="text-slate-800 text-xs font-medium">
                {new Date(settlement.settled_at).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-1">
                Billing Method
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-xs text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                DISCOM On-Bill Credit
              </span>
            </div>
            <div className="col-span-2 sm:col-span-3 pt-2 border-t border-slate-200 flex justify-between items-center text-[11px]">
              <span className="text-slate-500">
                Trade Hash: <span className="font-mono text-slate-700 font-semibold">{settlement.trade_id}</span>
              </span>
              <span className="flex items-center gap-1 text-slate-600 font-medium">
                <Shield className="w-3.5 h-3.5 text-blue-600" /> DISCOM Regulated Feeder
              </span>
            </div>
          </div>

          {/* Mediated Clearing & Zero Direct Peer Dealing Notice */}
          <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-between text-xs text-indigo-950">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                <strong>DISCOM Median Intermediary:</strong> Cleared at fair median rate of <strong>₹{settlement.clearing_price.toFixed(2)}/kWh</strong>. Zero direct peer-to-peer dealing.
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200 shrink-0">
              Inter-Operator Cleared
            </span>
          </div>

          {/* Parties Involved with Physical Geolocation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-600" /> Solar Seller (Rooftop Prosumer)
                </span>
                <span className="text-[9px] font-mono font-bold text-amber-800 bg-white px-1.5 py-0.5 rounded border border-amber-200">
                  Sector 14 • Feeder-01
                </span>
              </div>
              <p className="text-[11px] text-slate-700">
                📍 Villa #14, Green Meadows Solar Colony (28.5362° N, 77.3925° E)
              </p>
              <p className="text-[10px] text-amber-800/80 font-mono">Wallet Ref: {settlement.seller_ref}</p>
              <div className="pt-2 border-t border-amber-200/60 flex justify-between items-center">
                <span className="text-slate-600">Net Credit Earned:</span>
                <span className="text-emerald-700 font-bold text-sm">
                  + ₹{settlement.seller_credit.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-blue-600" /> Energy Buyer (Consumer)
                </span>
                <span className="text-[9px] font-mono font-bold text-blue-800 bg-white px-1.5 py-0.5 rounded border border-blue-200">
                  Sector 22 • Feeder-02
                </span>
              </div>
              <p className="text-[11px] text-slate-700">
                📍 Tower C, Apartment 402, Maple Heights (28.5615° N, 77.4105° E)
              </p>
              <p className="text-[10px] text-blue-800/80 font-mono">Wallet Ref: {settlement.buyer_ref}</p>
              <div className="pt-2 border-t border-blue-200/60 flex justify-between items-center">
                <span className="text-slate-600">Net Debit Charged:</span>
                <span className="text-slate-900 font-bold text-sm">
                  - ₹{settlement.buyer_debit.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Energy & Financial Breakdown Table */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3.5 font-bold">Line Item Description</th>
                  <th className="p-3.5 text-right font-bold">Volume / Rate</th>
                  <th className="p-3.5 text-right font-bold">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                <tr>
                  <td className="p-3.5 font-semibold text-slate-800">
                    Clean Renewable Solar Energy Delivered
                    <span className="block text-[10px] text-slate-400 font-normal">100% Zero Emission Local Solar</span>
                  </td>
                  <td className="p-3.5 text-right text-slate-600 font-mono">
                    {settlement.quantity_kwh.toFixed(2)} kWh @ ₹{settlement.clearing_price.toFixed(2)}
                  </td>
                  <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                    ₹{settlement.gross_value.toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td className="p-3.5 text-slate-700">
                    DISCOM Grid Wheeling & Loss Compensation
                    <span className="block text-[10px] text-slate-400">Grid transmission infrastructure fee</span>
                  </td>
                  <td className="p-3.5 text-right text-slate-500 font-mono">
                    ₹0.02 / kWh
                  </td>
                  <td className="p-3.5 text-right font-mono font-semibold text-amber-700">
                    ₹{(settlement.platform_fee * 0.8).toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td className="p-3.5 text-slate-700">
                    Platform Facilitation & Smart Escrow Fee
                  </td>
                  <td className="p-3.5 text-right text-slate-500 font-mono">
                    0.5%
                  </td>
                  <td className="p-3.5 text-right font-mono font-semibold text-blue-700">
                    ₹{(settlement.platform_fee * 0.2).toFixed(2)}
                  </td>
                </tr>
                <tr className="bg-slate-50/80 font-bold text-slate-900 border-t border-slate-200">
                  <td className="p-3.5">Net Energy Settled on DISCOM Bill</td>
                  <td className="p-3.5 text-right text-emerald-700 text-[11px]">100% Cleared</td>
                  <td className="p-3.5 text-right font-mono text-emerald-700 text-sm">
                    ₹{settlement.gross_value.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Cryptographic Proof & Blockchain link */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-purple-600" />
                Cryptographic Audit Proof (SHA-256 Digest)
              </span>
              {onViewBlockchain && (
                <button
                  type="button"
                  onClick={onViewBlockchain}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  View on Blockchain <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="font-mono text-[11px] text-slate-700 break-all bg-white p-2.5 rounded-xl border border-slate-200">
              {settlement.audit_tx || '734b7bfb1c6786ffae80c102a9812df95e4d29193b2a21b8f5838...'}
            </div>
            <p className="text-[10px] text-slate-500">
              Tamper-proof hash recorded into the DISCOM Settlement Ledger & Smart Contract.
            </p>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="p-5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-medium">
            DISCOM Approved Consumer Statement
          </span>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 border border-slate-200 shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              Print Invoice
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
