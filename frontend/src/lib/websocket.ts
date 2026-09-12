'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import type { WSEvent, WSEventType } from '@/types'

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'

type EventHandler = (event: WSEvent) => void

interface UseWebSocketOptions {
  onEvent?: EventHandler
  onSpecificEvent?: Partial<Record<WSEventType, (data: WSEvent['data']) => void>>
  reconnectDelay?: number
}

export function useWebSocket({
  onEvent,
  onSpecificEvent,
  reconnectDelay = 3000,
}: UseWebSocketOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(`${WS_BASE}/ws/live`)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      console.log('🔌 WebSocket connected')
    }

    ws.onmessage = (e) => {
      try {
        const event: WSEvent = JSON.parse(e.data)
        onEvent?.(event)
        if (event.event && onSpecificEvent?.[event.event]) {
          onSpecificEvent[event.event]!(event.data)
        }
      } catch (err) {
        console.warn('WS parse error:', err)
      }
    }

    ws.onerror = () => {
      console.warn('⚠️ WebSocket error')
    }

    ws.onclose = () => {
      setConnected(false)
      console.log('🔌 WebSocket disconnected, reconnecting...')
      reconnectTimer.current = setTimeout(connect, reconnectDelay)
    }
  }, [onEvent, onSpecificEvent, reconnectDelay])

  useEffect(() => {
    connect()
    const ping = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send('ping')
      }
    }, 30000)

    return () => {
      clearInterval(ping)
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { connected }
}
