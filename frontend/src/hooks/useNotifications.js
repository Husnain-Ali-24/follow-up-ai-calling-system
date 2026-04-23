import { useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export function useNotifications(onMessage) {
  useEffect(() => {
    // Standard EventSource doesn't support headers (for Bearer tokens)
    // For now, we assume the endpoint is accessible or handled by the proxy
    const eventSource = new EventSource(`${API_BASE_URL}/notifications/events`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('Failed to parse SSE message', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error', error);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [onMessage]);
}
