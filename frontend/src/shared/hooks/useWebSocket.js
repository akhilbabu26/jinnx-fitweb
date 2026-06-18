import { useEffect, useRef, useCallback, useState } from 'react';

const WS_BASE_URL =
  window.location.protocol === 'https:'
    ? `wss://${window.location.host}/ws`
    : `ws://${window.location.host}/ws`;

/**
 * useWebSocket — connects to /ws?token=<jwt> and keeps the connection alive.
 *
 * @param {function} onMessage  - called with parsed JSON payload on every server push
 * @param {boolean}  enabled    - set false to skip connecting (e.g. not logged in)
 * @returns {{ sendFrame, isConnected }}
 */
export function useWebSocket(onMessage, enabled = true) {
  const wsRef        = useRef(null);
  const reconnectRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    const token = localStorage.getItem('access_token');
    if (!token || !enabled) return;

    const url = `${WS_BASE_URL}?token=${encodeURIComponent(token)}`;
    const ws  = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      console.log('[ws] connected');
      // Clear any pending reconnect timer
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        onMessage(data);
      } catch {
        // Non-JSON frame — ignore
      }
    };

    ws.onclose = (evt) => {
      setIsConnected(false);
      console.log(`[ws] closed (code=${evt.code}) — reconnecting in 3s`);
      // Auto-reconnect unless closed intentionally (code 1000)
      if (evt.code !== 1000 && enabled) {
        reconnectRef.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = (err) => {
      console.error('[ws] error:', err);
      ws.close();
    };
  }, [onMessage, enabled]);

  useEffect(() => {
    connect();
    return () => {
      // Clean disconnect on unmount
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close(1000, 'component unmounted');
      }
    };
  }, [connect]);

  /**
   * sendFrame — sends a JSON frame to the server.
   * e.g. sendFrame({ action: 'chat', message: 'Hello' })
   */
  const sendFrame = useCallback((payload) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  return { sendFrame, isConnected };
}
