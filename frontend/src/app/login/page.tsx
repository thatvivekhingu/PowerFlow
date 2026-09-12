'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { login, setToken } from '@/lib/api'
import { Zap, Sun, Shield, AlertTriangle, ArrowRight, RefreshCw, Lock, Mail, Users } from 'lucide-react'

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
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2 border border-slate-200">
        
        {/* Left Side: Brand & Hero Graphic */}
        <div className="relative min-h-[460px] md:min-h-[640px] flex flex-col justify-between p-8 md:p-12 text-slate-800 overflow-hidden bg-emerald-50/50">
          <div className="absolute inset-0 z-0">
            <Image
              src="/images/login_hero.jpg"
              alt="Clean Energy Neighborhood"
              fill
              className="object-cover object-center opacity-85"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-white/90 via-white/40 to-transparent" />
          </div>

          {/* Top Brand Logo */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 text-white">
              <Zap className="w-5 h-5 fill-white" />
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-slate-900">POWERFLOW</span>
          </div>

          {/* Center Pitch */}
          <div className="relative z-10 my-auto py-10">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 leading-tight tracking-tight mb-4">
              Clean Energy.<br />Stronger Communities.
            </h1>
            <p className="text-sm md:text-base text-slate-700 font-medium max-w-sm leading-relaxed">
              Buy and sell clean energy with your neighbors. Grid-aware. Transparent. Sustainable.
            </p>
          </div>

          {/* Footer Note */}
          <div className="relative z-10 text-xs font-semibold text-slate-600">
            PowerFlow © 2026 | Building a Greener Tomorrow
          </div>
        </div>

        {/* Right Side: Welcome Back & Quick Demo Sign In */}
        <div className="p-8 md:p-12 flex flex-col justify-center bg-white">
          <div className="max-w-md mx-auto w-full">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome Back</h2>
              <p className="text-xs text-slate-500 mt-1 font-medium">Sign in to your PowerFlow account.</p>
            </div>

            {authError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> Email
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 text-slate-900 bg-slate-50/50"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" /> Password
                  </label>
                  <span className="text-[11px] text-emerald-600 hover:underline cursor-pointer font-medium">Forgot password?</span>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 text-slate-900 bg-slate-50/50"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer mt-2"
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

            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <span className="relative px-3 bg-white text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                OR
              </span>
            </div>

            {/* Quick Demo Sign In matching Mockup */}
            <div>
              <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 text-center">
                Quick Demo Sign In
              </span>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    setUsername('demo_consumer_01')
                    setPassword('demo')
                    handleLogin(undefined, 'demo_consumer_01', 'demo')
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all flex items-center gap-3 text-left group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800">Login as Consumer</p>
                    <p className="text-[11px] text-slate-500">Buy clean energy</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUsername('demo_prosumer_01')
                    setPassword('demo')
                    handleLogin(undefined, 'demo_prosumer_01', 'demo')
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all flex items-center gap-3 text-left group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Sun className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800">Login as Prosumer</p>
                    <p className="text-[11px] text-slate-500">Sell your solar energy</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUsername('demo_operator')
                    setPassword('demo')
                    handleLogin(undefined, 'demo_operator', 'demo')
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition-all flex items-center gap-3 text-left group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800">Login as DISCOM Operator</p>
                    <p className="text-[11px] text-slate-500">Monitor the grid</p>
                  </div>
                </button>
              </div>
            </div>

          </div>
        </div>

      </div>
    </main>
  )
}
