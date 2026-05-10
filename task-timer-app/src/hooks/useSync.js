import { useEffect, useRef, useCallback } from 'react';
import { STORAGE_KEYS, getItem, setItem } from '../utils/storageUtils';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const RECONNECT_DELAY = 5000;
const AUTH_CLOSE_CODE = 4001;

const useSync = (onEvent) => {
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const refreshToken = async () => {
    const refresh = getItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refresh) return false;
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      const data = await res.json();
      if (data.success) {
        setItem(STORAGE_KEYS.AUTH_TOKEN, data.data.token);
        setItem(STORAGE_KEYS.REFRESH_TOKEN, data.data.refreshToken);
        return true;
      }
    } catch (_) {}
    return false;
  };

  const connect = useCallback(() => {
    const token = getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws?token=${token}`;

    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (onEvent) onEvent({ type: 'CONNECTED' });
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (onEvent) onEvent(payload);
      } catch (e) {}
    };

    socket.onclose = (event) => {
      socketRef.current = null;
      if (event.code === 1000) return; // deliberate close

      reconnectTimeoutRef.current = setTimeout(async () => {
        if (event.code === AUTH_CLOSE_CODE) {
          const ok = await refreshToken();
          if (!ok) return; // can't refresh — give up
        }
        connect();
      }, RECONNECT_DELAY);
    };

    socket.onerror = () => {
      socket.close();
    };

    socketRef.current = socket;
  }, [onEvent]);

  useEffect(() => {
    connect();
    return () => {
      if (socketRef.current) {
        socketRef.current.close(1000, 'Component unmounting');
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return {
    isConnected: !!socketRef.current && socketRef.current.readyState === WebSocket.OPEN,
  };
};

export default useSync;
