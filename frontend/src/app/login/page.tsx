'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { login, setToken } from '@/lib/api'
import { Zap, Sun, Shield, AlertTriangle, ArrowRight, RefreshCw, Lock, User as UserIcon } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('demo_consumer_01')
  const [password, setPassword] = useState('demo')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)

  const handleLogin = async (e?: React.FormEvent, customUser?: string, customPass?: string) => {
    if (e) e.preventDefault()
    const targetUser = customUser || username
    const targetPass = customPass || password
    setAuthLoading(true)
    setAuthError(null)

    try {
      const token = await login(targetUser, targetPass)
      setToken(token.access_token)
      localStorage.setItem('gridmind_token', token.access_token)
      localStorage.setItem('gridmind_username', targetUser)
      localStorage.setItem('gridmind_role', token.role)
      localStorage.setItem('gridmind_feeder', token.feeder_id || 'FEEDER-01')

      router.push('/')
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Invalid credentials or backend service offline.')
    } finally {
      setAuthLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      {/* Container */}
      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-3xl p-8 shadow-xl shadow-slate-200/50 animate-fade-in">
        {/* Branding & Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 mb-4 shadow-sm">
            <Zap className="w-7 h-7 fill-emerald-600" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">GRIDMIND</h1>
          <p className="text-xs text-emerald-700 font-bold uppercase tracking-wider mt-1">
            Renewable Energy P2P Trading Marketplace
          </p>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            Please sign in with your username and password to access the energy trading platform.
          </p>
        </div>

        {/* Error Notification */}
        {authError && (
          <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-slate-400" /> Username
            </label>
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
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" /> Password
            </label>
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
                Sign In
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* 1-Click Quick Fill Chips for Demo */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-3 text-center">
            Demo Accounts (Password: demo)
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
