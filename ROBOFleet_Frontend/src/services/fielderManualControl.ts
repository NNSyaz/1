// src/services/fielderManualControl.ts
/**
 * WebSocket-based manual control for Fielder/AMR robots
 * Connects to /api/v1/robot/control/manual WebSocket endpoint
 */

class FielderManualControl {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 3;
  private commandQueue: any[] = [];
  private baseUrl: string;
  
  constructor(baseUrl: string = "ws://192.168.0.183:8000") {
    this.baseUrl = baseUrl;
  }
  
  /**
   * Connect to manual control WebSocket
   */
  async connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${this.baseUrl}/api/v1/robot/control/manual`;
        console.log(`Connecting to Fielder manual control: ${wsUrl}`);
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
          console.log("✅ Fielder manual control connected");
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          // Send any queued commands
          while (this.commandQueue.length > 0) {
            const cmd = this.commandQueue.shift();
            this.sendCommand(cmd.linear, cmd.angular);
          }
          
          resolve(true);
        };
        
        this.ws.onerror = (error) => {
          console.error("❌ Fielder manual control error:", error);
          this.isConnected = false;
          reject(error);
        };
        
        this.ws.onclose = () => {
          console.log("Fielder manual control disconnected");
          this.isConnected = false;
          
          // Auto-reconnect if needed
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => this.connect(), 1000);
          }
        };
        
        this.ws.onmessage = (event) => {
          // Handle feedback from robot
          console.log("Fielder feedback:", event.data);
        };
        
      } catch (error) {
        console.error("Failed to create WebSocket:", error);
        reject(error);
      }
    });
  }
  
  /**
   * Send control command
   */
  sendCommand(linear: number, angular: number) {
    if (!this.isConnected || !this.ws) {
      // Queue command for when connected
      this.commandQueue.push({ linear, angular });
      
      // Try to connect if not connected
      if (!this.isConnected) {
        this.connect().catch(console.error);
      }
      return;
    }
    
    try {
      const command = {
        linear: linear,
        angular: angular
      };
      
      this.ws.send(JSON.stringify(command));
    } catch (error) {
      console.error("Failed to send command:", error);
    }
  }
  
  /**
   * Stop robot (send zero velocities)
   */
  stop() {
    this.sendCommand(0, 0);
  }
  
  /**
   * Disconnect
   */
  disconnect() {
    if (this.ws) {
      this.isConnected = false;
      this.ws.close();
      this.ws = null;
    }
  }
  
  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }
}

// Export singleton instance
export const fielderManualControl = new FielderManualControl();