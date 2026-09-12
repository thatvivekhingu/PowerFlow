'use client'

import React from 'react'
import type { BlockchainProof } from '@/types'
import { ShieldCheck, ExternalLink, X, Blocks, CheckCircle2, Hash, Cpu } from 'lucide-react'

interface BlockchainModalProps {
  proof: BlockchainProof | null
  isOpen: boolean
  onClose: () => void
}

export default function BlockchainModal({ proof, isOpen, onClose }: BlockchainModalProps) {
  if (!isOpen || !proof) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Blocks className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                On-Chain Smart Contract Ledger
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                  Confirmed
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Ethereum / Polygon Renewable Energy Escrow Proof
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-600">
          {/* Status banner */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-900 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <span className="font-bold block text-sm">Transaction Cryptographically Verified</span>
              <span className="text-xs text-emerald-700">
                Settled through EnergyMarketplace.sol with automated DISCOM fee deduction.
              </span>
            </div>
          </div>

          {/* Details Table */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-1">
                Transaction Hash (txHash)
              </span>
              <div className="font-mono text-xs font-semibold text-slate-800 break-all bg-white p-2.5 rounded-xl border border-slate-200">
                {proof.tx_hash}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-1">
                  Block Height
                </span>
                <span className="font-mono font-bold text-slate-900 text-sm flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5 text-blue-500" />
                  #{proof.block_number}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-1">
                  Network / Chain ID
                </span>
                <span className="font-semibold text-slate-800 text-xs">
                  {proof.network} ({proof.chain_id})
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-1">
                Verified Smart Contract
              </span>
              <span className="font-mono text-xs text-slate-700 break-all">
                {proof.contract_address}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block mb-1">
                Audit Fingerprint (Keccak / SHA-256 Digest)
              </span>
              <div className="font-mono text-[11px] text-emerald-700 break-all bg-white p-2 rounded-xl border border-slate-200">
                {proof.audit_hash}
              </div>
            </div>

            <div className="flex justify-between items-center text-[11px] pt-2 border-t border-slate-200 text-slate-500">
              <span className="flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-slate-400" /> Gas Consumed: {proof.gas_used.toLocaleString()} units
              </span>
              <span className="font-medium text-emerald-700">100% Green Certified</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <a
            href={proof.explorer_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1.5 hover:underline"
          >
            View on Blockchain Explorer
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
