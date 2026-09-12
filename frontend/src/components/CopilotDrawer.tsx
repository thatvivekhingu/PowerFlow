'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  sendAgentMessage,
  confirmAgentAction,
  AgentChatResponse,
} from '@/lib/api'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolsCalled?: string[]
  trace?: string[]
  proposedAction?: AgentChatResponse['proposed_action']
  confirmationRequired?: boolean
  actionResolved?: boolean
  actionStatus?: 'CONFIRMED' | 'CANCELLED'
  actionResultMsg?: string
}

interface CopilotDrawerProps {
  currentFeeder: string
  onTradeExecuted?: () => void
}

export default function CopilotDrawer({
  currentFeeder,
  onTradeExecuted,
}: CopilotDrawerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputQuery, setInputQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hello! I'm your **PowerFlow AI Copilot** powered by LangGraph. I can check real-time feeder headroom, analyze solar forecasts, find the best energy prices, and execute peer-to-peer trades with your approval.",
      toolsCalled: ['get_market_price', 'get_grid_status'],
    },
  ])

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
    }
  }, [messages, isOpen])

  const handleSend = async (queryText?: string) => {
    const text = (queryText || inputQuery).trim()
    if (!text || isLoading) return

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
    }

    setMessages((prev) => [...prev, userMsg])
    setInputQuery('')
    setIsLoading(true)

    try {
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await sendAgentMessage(text, history, currentFeeder)

      const assistantMsg: Message = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        content: res.response,
        toolsCalled: res.tools_called,
        trace: res.trace,
        proposedAction: res.proposed_action,
        confirmationRequired: res.confirmation_required,
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ Error executing request: ${err.message || 'Server error'}`,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleActionConfirm = async (
    msgId: string,
    action: any,
    approved: boolean
  ) => {
    try {
      const res = await confirmAgentAction(approved, action)
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === msgId) {
            return {
              ...m,
              actionResolved: true,
              actionStatus: approved ? 'CONFIRMED' : 'CANCELLED',
              actionResultMsg: res.message,
            }
          }
          return m
        })
      )
      if (approved && onTradeExecuted) {
        onTradeExecuted()
      }
    } catch (err: any) {
      alert(`Error confirming action: ${err.message}`)
    }
  }

  const quickPrompts = [
    'What is the current market price and solar surplus?',
    'Check feeder headroom on FEEDER-A',
    'Recommend best clean energy purchase',
    'Explain DISCOM wheeling charge and billing',
  ]

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-5 py-3.5 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105 ${
          isOpen
            ? 'hidden'
            : 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-emerald-500/25'
        }`}
      >
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
        </span>
        <span className="font-semibold text-sm tracking-wide">⚡ AI Energy Copilot</span>
      </button>

      {/* Slide-Over Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-slide-left">
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-emerald-50/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                    ⚡
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                      PowerFlow Copilot
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">
                        LangGraph
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Grid Feeder: <span className="font-semibold text-slate-700">{currentFeeder}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition"
                >
                  ✕
                </button>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                        msg.role === 'user'
                          ? 'bg-emerald-600 text-white rounded-br-none'
                          : 'bg-white border border-slate-200/80 text-slate-800 rounded-bl-none'
                      }`}
                    >
                      <div className="whitespace-pre-line leading-relaxed">
                        {msg.content}
                      </div>

                      {/* Tools executed badge */}
                      {msg.toolsCalled && msg.toolsCalled.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                          <span className="font-medium text-slate-400">MCP Tools:</span>
                          {msg.toolsCalled.map((tool, idx) => (
                            <span
                              key={idx}
                              className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono text-[10px]"
                            >
                              {tool}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Human-in-the-Loop Action Card */}
                      {msg.confirmationRequired && msg.proposedAction && (
                        <div className="mt-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-2">
                          <div className="font-semibold text-emerald-900 flex items-center justify-between">
                            <span>📋 Proposed Trade Order (HITL Gate)</span>
                            <span className="uppercase text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                              {msg.proposedAction.side}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-slate-600 text-[11px]">
                            <div>Quantity: <span className="font-semibold text-slate-800">{msg.proposedAction.quantity_kwh} kWh</span></div>
                            <div>Price: <span className="font-semibold text-slate-800">₹{msg.proposedAction.target_price}/kWh</span></div>
                            <div>Est. Wheeling: <span className="font-semibold text-slate-800">₹{((msg.proposedAction.quantity_kwh || 2) * 0.25).toFixed(2)}</span></div>
                            <div>Est. Total: <span className="font-semibold text-slate-800">₹{((msg.proposedAction.quantity_kwh || 2) * (msg.proposedAction.target_price || 5.5) + (msg.proposedAction.quantity_kwh || 2) * 0.25).toFixed(2)}</span></div>
                          </div>

                          {!msg.actionResolved ? (
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() => handleActionConfirm(msg.id, msg.proposedAction, true)}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-1.5 rounded-lg text-xs transition"
                              >
                                Approve & Execute
                              </button>
                              <button
                                onClick={() => handleActionConfirm(msg.id, msg.proposedAction, false)}
                                className="px-3 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium py-1.5 rounded-lg text-xs transition"
                              >
                                Decline
                              </button>
                            </div>
                          ) : (
                            <div
                              className={`p-2 rounded-lg font-medium text-[11px] ${
                                msg.actionStatus === 'CONFIRMED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {msg.actionResultMsg}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Collapsible Trace */}
                      {msg.trace && msg.trace.length > 0 && (
                        <details className="mt-2 text-[10px] text-slate-400">
                          <summary className="cursor-pointer hover:text-slate-600">
                            View LangGraph State Execution Trace ({msg.trace.length} steps)
                          </summary>
                          <div className="mt-1 pl-2 border-l-2 border-slate-200 font-mono text-[10px] text-slate-500 space-y-0.5 max-h-32 overflow-y-auto">
                            {msg.trace.map((step, idx) => (
                              <div key={idx}>{step}</div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 text-xs text-slate-400 italic pl-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    LangGraph agent analyzing telemetry and reasoning...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Prompts */}
              <div className="px-3 py-2 border-t border-slate-100 bg-white flex gap-1.5 overflow-x-auto no-scrollbar">
                {quickPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(prompt)}
                    className="whitespace-nowrap text-[11px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 px-2.5 py-1 rounded-full border border-slate-200 transition shrink-0"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Input Bar */}
              <div className="p-3 border-t border-slate-200 bg-white">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleSend()
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    placeholder="Ask about solar surplus, prices, or trade..."
                    className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !inputQuery.trim()}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
