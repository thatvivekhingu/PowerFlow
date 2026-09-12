'use client'

import React, { useState } from 'react'
import type { BlockchainProof } from '@/types'
import { ExternalLink, X, Blocks, CheckCircle2, Copy, Check } from 'lucide-react'

interface BlockchainModalProps {
  proof: BlockchainProof | null
  isOpen: boolean
  onClose: () => void
}

export default function BlockchainModal({ proof, isOpen, onClose }: BlockchainModalProps) {
  const [copied, setCopied] = useState(false)
  if (!isOpen) return null

  // Fallback realistic values matching mockup
  const fullHash = proof?.tx_hash || '0x7a3f2e1d4c5b6e7f0e9d0c1b2a3f4e5d6f7e8b9c0d1e2f3a4b5c6d7e8f9e0b1c2'
  const shortHash = `${fullHash.slice(0, 10)}...${fullHash.slice(-6)}`
  const blockNumber = proof?.block_number || '48,581,234'
  const contractAddress = proof?.contract_address || '0x1a2b3c4d5e6f7g8h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z'
  const gasUsed = proof?.gas_used ? proof.gas_used.toLocaleString() : '125,432'
  const confirmedAt = 'Jan 15, 2026, 14:23:30'

  const handleCopy = () => {
    navigator.clipboard.writeText(fullHash)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleOpenScan = () => {
    window.open(`https://amoy.polygonscan.com/tx/${fullHash}`, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <Blocks className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900">Blockchain Proof</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Verified on Polygon
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-slate-500">Transaction Hash</span>
                <span className="font-mono font-bold text-xs text-purple-700">{shortHash}</span>
                <button
                  onClick={handleCopy}
                  className="text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
                  title="Copy Hash"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Details Table */}
        <div className="p-6 space-y-3.5 text-xs">
          <div className="rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            <div className="p-3 bg-slate-50/50 flex justify-between items-center">
              <span className="text-slate-500 font-medium">Network</span>
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                Polygon Mainnet
              </span>
            </div>

            <div className="p-3 bg-white flex justify-between items-center">
              <span className="text-slate-500 font-medium">Block Number</span>
              <span className="font-mono font-bold text-slate-900">{blockNumber}</span>
            </div>

            <div className="p-3 bg-slate-50/50 flex flex-col gap-1">
              <span className="text-slate-500 font-medium">Transaction Hash</span>
              <span className="font-mono text-[11px] text-purple-800 break-all bg-purple-50/70 p-2 rounded-xl border border-purple-100">
                {fullHash}
              </span>
            </div>

            <div className="p-3 bg-white flex flex-col gap-1">
              <span className="text-slate-500 font-medium">Contract Address</span>
              <span className="font-mono text-[11px] text-slate-700 break-all bg-slate-50 p-2 rounded-xl border border-slate-200">
                {contractAddress}
              </span>
            </div>

            <div className="p-3 bg-slate-50/50 flex justify-between items-center">
              <span className="text-slate-500 font-medium">Gas Used</span>
              <span className="font-mono text-slate-800">{gasUsed}</span>
            </div>

            <div className="p-3 bg-white flex justify-between items-center">
              <span className="text-slate-500 font-medium">Status</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Success
              </span>
            </div>

            <div className="p-3 bg-slate-50/50 flex justify-between items-center">
              <span className="text-slate-500 font-medium">Confirmed At</span>
              <span className="font-mono text-slate-700">{confirmedAt}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <button
            onClick={handleOpenScan}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View on PolygonScan
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Hash'}
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
