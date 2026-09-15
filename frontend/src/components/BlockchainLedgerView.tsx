'use client'

import React, { useState } from 'react'
import {
  Blocks,
  Link,
  Shield,
  CheckCircle2,
  ExternalLink,
  Cpu,
  Radio,
  FileCode,
  Copy,
  Check,
  Zap,
  Lock,
} from 'lucide-react'
import type { BlockchainProof } from '@/types'

export default function BlockchainLedgerView({
  blockchainProof,
  onOpenProofModal,
}: {
  blockchainProof?: BlockchainProof | null
  onOpenProofModal?: () => void
}) {
  const [walletConnected, setWalletConnected] = useState<boolean>(true)
  const [walletAddress] = useState<string>('0x71C...84eB')
  const [copiedHash, setCopiedHash] = useState<string | null>(null)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedHash(text)
    setTimeout(() => setCopiedHash(null), 2000)
  }

  // Simulated live blocks verified on-chain
  const recentBlocks = [
    {
      height: 19842104,
      txCount: 8,
      gasUsed: '142,500',
      hash: '0x8f2a...c491',
      event: 'EscrowSettled',
      trade: 'Sharma Solar -> Consumer #104',
      time: '12s ago',
    },
    {
      height: 19842103,
      txCount: 14,
      gasUsed: '210,800',
      hash: '0x3d9e...11aa',
      event: 'DeliveryVerified',
      trade: 'Sector 4 Solar Trust -> Apt A',
      time: '28s ago',
    },
    {
      height: 19842102,
      txCount: 6,
      gasUsed: '112,000',
      hash: '0x1c44...bb72',
      event: 'EscrowLocked',
      trade: 'Community Solar -> Green Hub',
      time: '45s ago',
    },
  ]

  // Chainlink Oracle Feed Status
  const oracleFeeds = [
    {
      feedName: 'Chainlink Solar Irradiance Oracle (GHI)',
      value: '912 W/m²',
      pair: 'SOLAR / INR',
      heartbeat: 'Every 60s',
      status: 'VERIFIED',
      roundId: '#149201',
    },
    {
      feedName: 'Smart Meter Cryptographic Oracle',
      value: '3.18 kW Export',
      pair: 'MTR-PRO-01 / DISCOM',
      heartbeat: 'Every 15s',
      status: 'VERIFIED',
      roundId: '#889104',
    },
    {
      feedName: 'DISCOM Base Tariff Reference',
      value: '₹8.50 / kWh',
      pair: 'GRID / INR',
      heartbeat: 'Daily 00:00',
      status: 'ACTIVE',
      roundId: '#441029',
    },
  ]

  return (
    <div className="space-y-6">
      {/* ── Header Banner ────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 border border-purple-500/20 rounded-3xl p-6 backdrop-blur-sm shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-700 border border-purple-500/30 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Blocks className="w-3.5 h-3.5 text-purple-600" />
                Decentralized Smart Contract Ledger
              </span>
              <span className="text-xs text-slate-500 font-mono">Chain ID: 80002 (Polygon Amoy / Ethereum L2)</span>
            </div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
              Blockchain Escrow, Merkle Proofs & Chainlink Oracles
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Every kilowatt-hour traded is cryptographically validated via decentralized smart contracts. Tamper-evident escrow holds buyer funds until IoT smart meters confirm physical electrons were delivered.
            </p>
          </div>

          {/* Web3 Wallet Pill */}
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl p-2.5 shadow-xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">
                Ξ
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-bold">CONNECTED WALLET</span>
                <span className="font-mono text-xs font-bold text-slate-900">{walletAddress}</span>
              </div>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="text-[10px] text-slate-400 block font-bold">BALANCE</span>
              <span className="font-mono text-xs font-bold text-purple-600">1,420 NRG</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Chainlink Oracle & Smart Contract Cards ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chainlink Oracles */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-base font-bold text-slate-900">Chainlink Decentralized Oracle Feeds</h3>
                <p className="text-xs text-slate-500">
                  Off-chain solar irradiance and IoT smart meter measurements attested on-chain by decentralized node operators.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
              5/5 Consensus Reached
            </span>
          </div>

          <div className="space-y-3">
            {oracleFeeds.map((feed, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-slate-800 text-sm block">{feed.feedName}</span>
                  <div className="flex items-center gap-3 mt-1 text-slate-500 text-[11px]">
                    <span>Pair: <strong>{feed.pair}</strong></span>
                    <span>Round: <strong>{feed.roundId}</strong></span>
                    <span>Heartbeat: {feed.heartbeat}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-base font-black font-mono text-purple-700 block">{feed.value}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                    <CheckCircle2 className="w-3 h-3" /> {feed.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Smart Contract Escrow State */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <Lock className="w-5 h-5 text-purple-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">P2P Escrow Contract</h3>
                <span className="text-[10px] font-mono text-slate-400">0x9970aDd8...2e3544</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-2xl bg-purple-50/60 border border-purple-100">
                <span className="text-[10px] font-bold text-purple-800 uppercase block mb-1">Total Value Locked (TVL)</span>
                <div className="text-2xl font-black text-purple-900 font-mono">
                  ₹84,250.00 <span className="text-xs font-sans font-semibold text-purple-600">(62 active trades)</span>
                </div>
              </div>

              <div className="flex justify-between p-2.5 rounded-xl bg-slate-50">
                <span className="text-slate-600 font-medium">Escrow Security:</span>
                <span className="font-bold text-emerald-600">Multi-Sig (2-of-3)</span>
              </div>

              <div className="flex justify-between p-2.5 rounded-xl bg-slate-50">
                <span className="text-slate-600 font-medium">DISCOM Wheeling Fee:</span>
                <span className="font-bold text-slate-900">₹0.02 / kWh (Auto-Split)</span>
              </div>

              <div className="flex justify-between p-2.5 rounded-xl bg-slate-50">
                <span className="text-slate-600 font-medium">Delivery Verification:</span>
                <span className="font-bold text-blue-600">Cryptographic Meter Proof</span>
              </div>
            </div>
          </div>

          <button
            onClick={onOpenProofModal}
            className="w-full mt-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Verify Merkle Proof & Contract ABI</span>
          </button>
        </div>
      </div>

      {/* ── Live Cascading Block Explorer ───────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Live Energy Blocks & Event Logs</h3>
            <p className="text-xs text-slate-500">
              Immutable ledger of smart meter delivery signatures and escrow settlements.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 bg-slate-100 px-3 py-1 rounded-xl">
            Block Time: ~2.1s
          </span>
        </div>

        <div className="space-y-2.5">
          {recentBlocks.map((blk) => (
            <div
              key={blk.height}
              className="p-4 rounded-2xl bg-slate-50 hover:bg-purple-50/40 border border-slate-200 hover:border-purple-200 transition flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-800 flex items-center justify-center font-bold text-xs font-mono shadow-xs">
                  #{blk.height.toString().slice(-4)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 font-mono">Block #{blk.height}</span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold text-[10px]">
                      {blk.event}
                    </span>
                  </div>
                  <span className="text-slate-500 text-[11px] mt-0.5 block">{blk.trade}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-slate-500 text-[11px]">
                <span>Gas: <strong className="font-mono text-slate-700">{blk.gasUsed}</strong></span>
                <span className="hidden sm:inline">TXs: <strong>{blk.txCount}</strong></span>
                <span>{blk.time}</span>
                <button
                  onClick={() => copyToClipboard(blk.hash)}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition flex items-center gap-1 cursor-pointer"
                  title="Copy Hash"
                >
                  {copiedHash === blk.hash ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span className="font-mono text-[10px]">{blk.hash}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
