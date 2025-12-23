// src/services/websocket.ts

type MessageCallback = (data: any) => void;
type ErrorCallback = (error: any) => void;

interface WebSocketService {
  disconnect(): unknown;
  subscribe(arg0: string, arg1: (data: any) => void): unknown;
  connect(): unknown;
  ws: WebSocket | null;
  messageCallbacks: Set<MessageCallback>;
  errorCallbacks: Set<ErrorCallback>;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  isConnecting: boolean;
}

const WS_URL = "ws://192.168.0.142:8000"; // Match your backend

export const wsService: WebSocketService = {
  ws: null,
  messageCallbacks: new Set(),
  errorCallbacks: new Set(),
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectDelay: 3000,
  isConnecting: false,
  disconnect: function (): unknown {
    throw new Error("Function not implemented.");
  },
  subscribe: function (_arg0: string, _arg1: (data: any) => void): unknown {
    throw new Error("Function not implemented.");
  },
  connect: function (): unknown {
    throw new Error("Function not implemented.");
  },
};

/**
 * Connect to the WebSocket server
 */
export function connect() {
  if (wsService.ws?.readyState === WebSocket.OPEN) {
    console.log("WebSocket already connected");
    return;
  }

  if (wsService.isConnecting) {
    console.log("WebSocket connection already in progress");
    return;
  }

  wsService.isConnecting = true;

  try {
    wsService.ws = new WebSocket(`${WS_URL}/api/v1/robot/ws/current_pose`);

    wsService.ws.onopen = () => {
      console.log("WebSocket connected successfully");
      wsService.reconnectAttempts = 0;
      wsService.isConnecting = false;
    };

    wsService.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("WebSocket message received:", data);

        // Notify all subscribers
        wsService.messageCallbacks.forEach((callback) => {
          try {
            callback(data);
          } catch (error) {
            console.error("Error in message callback:", error);
          }
        });
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
        wsService.errorCallbacks.forEach((callback) => callback(error));
      }
    };

    wsService.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      wsService.isConnecting = false;
      wsService.errorCallbacks.forEach((callback) => callback(error));
    };

    wsService.ws.onclose = (event) => {
      console.log("WebSocket disconnected:", event.code, event.reason);
      wsService.isConnecting = false;
      wsService.ws = null;

      // Attempt to reconnect if not manually closed
      if (
        event.code !== 1000 &&
        wsService.reconnectAttempts < wsService.maxReconnectAttempts
      ) {
        wsService.reconnectAttempts++;
        console.log(
          `Attempting to reconnect (${wsService.reconnectAttempts}/${wsService.maxReconnectAttempts})...`
        );
        setTimeout(() => {
          connect();
        }, wsService.reconnectDelay);
      } else if (
        wsService.reconnectAttempts >= wsService.maxReconnectAttempts
      ) {
        console.error("Max reconnection attempts reached");
        const error = new Error("Failed to reconnect to WebSocket");
        wsService.errorCallbacks.forEach((callback) => callback(error));
      }
    };
  } catch (error) {
    console.error("Failed to create WebSocket:", error);
    wsService.isConnecting = false;
    wsService.errorCallbacks.forEach((callback) => callback(error));
  }
}

/**
 * Disconnect from the WebSocket server
 */
export function disconnect() {
  if (wsService.ws) {
    console.log("Disconnecting WebSocket...");
    wsService.ws.close(1000, "Client disconnecting");
    wsService.ws = null;
  }
  wsService.reconnectAttempts = 0;
  wsService.isConnecting = false;
}

/**
 * Subscribe to WebSocket messages
 * @param callback Function to call when a message is received
 * @returns Unsubscribe function
 */
export function subscribe(callback: MessageCallback): () => void {
  wsService.messageCallbacks.add(callback);

  // Return unsubscribe function
  return () => {
    wsService.messageCallbacks.delete(callback);
  };
}

/**
 * Subscribe to WebSocket errors
 * @param callback Function to call when an error occurs
 * @returns Unsubscribe function
 */
export function onError(callback: ErrorCallback): () => void {
  wsService.errorCallbacks.add(callback);

  // Return unsubscribe function
  return () => {
    wsService.errorCallbacks.delete(callback);
  };
}

/**
 * Send a message through the WebSocket
 * @param data Data to send
 */
export function send(data: any) {
  if (wsService.ws?.readyState === WebSocket.OPEN) {
    wsService.ws.send(JSON.stringify(data));
  } else {
    console.warn("WebSocket is not open. Cannot send message.");
  }
}

/**
 * Check if WebSocket is connected
 */
export function isConnected(): boolean {
  return wsService.ws?.readyState === WebSocket.OPEN;
}

/**
 * Get current WebSocket connection state
 */
export function getState(): number | null {
  return wsService.ws?.readyState ?? null;
}

// Export default object with all functions
export default {
  connect,
  disconnect,
  subscribe,
  onError,
  send,
  isConnected,
  getState,
};
