// src/services/robotStatusService.ts
// Singleton WebSocket service for robot status updates

type StatusCallback = (data: {
  status: string;
  battery: number;
  last_poi: string;
}) => void;

class RobotStatusService {
  private ws: WebSocket | null = null;
  private callbacks: Set<StatusCallback> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private isConnecting = false;
  private shouldReconnect = true;
  private lastData: any = null;
  private WS_URL = "ws://192.168.0.183:8000";

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      console.log("WebSocket already connected or connecting");
      return;
    }

    this.isConnecting = true;
    this.shouldReconnect = true;

    try {
      this.ws = new WebSocket(
        `${this.WS_URL}/api/v1/robot/ws/get/robot_status`
      );

      this.ws.onopen = () => {
        console.log("Robot status WebSocket connected");
        this.reconnectAttempts = 0;
        this.isConnecting = false;

        // Send last known data to new subscribers immediately
        if (this.lastData && this.callbacks.size > 0) {
          this.callbacks.forEach((callback) => {
            try {
              callback(this.lastData);
            } catch (error) {
              console.error("Error in callback:", error);
            }
          });
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("Robot status received:", data);

          // Store last data
          this.lastData = data;

          // Notify all subscribers
          this.callbacks.forEach((callback) => {
            try {
              callback(data);
            } catch (error) {
              console.error("Error in status callback:", error);
            }
          });
        } catch (error) {
          console.error("Failed to parse robot status message:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("Robot status WebSocket error:", error);
        this.isConnecting = false;
      };

      this.ws.onclose = (event) => {
        console.log(
          `Robot status WebSocket closed: ${event.code} - ${event.reason}`
        );
        this.isConnecting = false;
        this.ws = null;

        // Attempt to reconnect if not manually closed
        if (
          this.shouldReconnect &&
          event.code !== 1000 &&
          this.reconnectAttempts < this.maxReconnectAttempts
        ) {
          this.reconnectAttempts++;
          console.log(
            `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`
          );
          setTimeout(() => {
            this.connect();
          }, this.reconnectDelay);
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error("Max reconnection attempts reached for robot status");
        }
      };
    } catch (error) {
      console.error("Failed to create robot status WebSocket:", error);
      this.isConnecting = false;
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.ws) {
      console.log("Disconnecting robot status WebSocket...");
      this.ws.close(1000, "Client disconnecting");
      this.ws = null;
    }
    this.reconnectAttempts = 0;
    this.isConnecting = false;
  }

  subscribe(callback: StatusCallback): () => void {
    this.callbacks.add(callback);

    // Send last known data immediately to new subscriber
    if (this.lastData) {
      try {
        callback(this.lastData);
      } catch (error) {
        console.error("Error in immediate callback:", error);
      }
    }

    // Connect if not already connected
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
    }

    // Return unsubscribe function
    return () => {
      this.callbacks.delete(callback);
      // Disconnect if no more subscribers
      if (this.callbacks.size === 0) {
        this.disconnect();
      }
    };
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getLastData() {
    return this.lastData;
  }
}

// Export singleton instance
export const robotStatusService = new RobotStatusService();
