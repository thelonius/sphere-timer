import { useEffect, useRef, useCallback } from 'react';
import { STORAGE_KEYS, getItem } from '../utils/storageUtils';

const useSync = (onEvent) => {
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const connect = useCallback(() => {
    const token = getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) return;

    // Build WS URL based on current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws?token=${token}`;

    console.log('Connecting to WebSocket:', wsUrl);
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('WebSocket connected');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      // Notify parent that we are connected (can trigger a refresh)
      if (onEvent) onEvent({ type: 'CONNECTED' });
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (onEvent) onEvent(payload);
      } catch (e) {
        console.error('Failed to parse WS message:', e);
      }
    };

    socket.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      socketRef.current = null;
      
      // Attempt reconnect if not a deliberate close
      if (event.code !== 1000) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect WebSocket...');
          connect();
        }, 3000);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
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
