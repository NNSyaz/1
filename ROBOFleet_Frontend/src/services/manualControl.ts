// src/services/manualControl.ts - FIXED VERSION
/**
 * ✅ FIXED: Matches working HTML implementation
 */

const ROBOT_WS_URL = "ws://192.168.0.250:8090/ws/v2/topics";

class ManualControlService {
  private ws: WebSocket | null = null;
  private isActive = false;
  private commandInterval: ReturnType<typeof setInterval> | null = null;
  private currentLinear = 0;
  private currentAngular = 0;
  private commandDelay = 200; // ✅ Increased from 100ms to match HTML
  private topicAdvertised = false;
  private readyForControl = false; // ✅ NEW: Wait for readiness

  async start(): Promise<boolean> {
    if (this.isActive) {
      console.log("Manual control already active");
      return true;
    }

    try {
      // ✅ CRITICAL: Enable remote control mode FIRST
      console.log("🔧 Enabling remote control mode...");
      await this.enableRemoteMode();
      
      console.log("🎮 Connecting to robot WebSocket...");
      this.ws = new WebSocket(ROBOT_WS_URL);
      
      return new Promise((resolve, reject) => {
        if (!this.ws) {
          reject(new Error("Failed to create WebSocket"));
          return;
        }

        this.ws.onopen = () => {
          console.log("✅ WebSocket connected");
          
          // ✅ CRITICAL: Advertise topic immediately on connect
          this.advertiseTopic();
          
          // ✅ Wait for topic to be ready before marking as active
          setTimeout(() => {
            this.readyForControl = true;
            console.log("✅ Ready for control!");
            console.log("🎯 Press W/A/S/D or arrow keys to move");
            this.isActive = true;
            resolve(true);
          }, 1000); // Give robot time to register topic
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log("📨 Robot:", data);
          } catch (e) {
            console.log("📨 Robot (raw):", event.data);
          }
        };

        this.ws.onerror = (error) => {
          console.error("❌ WebSocket error:", error);
          this.isActive = false;
          reject(new Error("WebSocket connection failed"));
        };

        this.ws.onclose = () => {
          console.log("WebSocket closed");
          this.cleanup();
        };

        setTimeout(() => {
          if (!this.isActive) {
            this.cleanup();
            reject(new Error("WebSocket timeout"));
          }
        }, 5000);
      });
    } catch (error) {
      console.error("❌ Start error:", error);
      this.cleanup();
      throw error;
    }
  }

  private advertiseTopic(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("⚠️ Cannot advertise - WebSocket not open");
      return;
    }

    const advertiseMsg = {
      op: "advertise",
      topic: "/twist",
      type: "geometry_msgs/Twist"
    };

    console.log("📢 Advertising /twist topic:", advertiseMsg);
    this.ws.send(JSON.stringify(advertiseMsg));
    this.topicAdvertised = true;
  }

  async stop(): Promise<void> {
    console.log("🛑 Stopping manual control...");
    
    // Send stop command first
    await this.sendCommand(0, 0);
    
    this.cleanup();
    
    // Unadvertise topic
    if (this.topicAdvertised && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const unadvertiseMsg = {
        op: "unadvertise",
        topic: "/twist"
      };
      console.log("📢 Unadvertising /twist");
      this.ws.send(JSON.stringify(unadvertiseMsg));
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    console.log("✅ Manual control stopped");
  }

  private cleanup(): void {
    this.isActive = false;
    this.readyForControl = false;
    this.topicAdvertised = false;
    
    if (this.commandInterval) {
      clearInterval(this.commandInterval);
      this.commandInterval = null;
    }
    
    this.currentLinear = 0;
    this.currentAngular = 0;
  }

  setVelocities(linear: number, angular: number): void {
    const changed = (linear !== this.currentLinear || angular !== this.currentAngular);
    
    this.currentLinear = linear;
    this.currentAngular = angular;
    
    if (changed) {
      console.log(`🎮 NEW velocities: linear=${linear.toFixed(2)}, angular=${angular.toFixed(2)}`);
      console.log(`   isActive=${this.isActive}, topicAdvertised=${this.topicAdvertised}, wsState=${this.ws?.readyState}`);
      
      // ✅ Send immediately when velocities change
      if (this.readyForControl) {
        this.sendCommand(linear, angular);
      }
    }
  }

  async sendCommand(linear: number, angular: number): Promise<boolean> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("⚠️ WebSocket not open, state:", this.ws?.readyState);
      return false;
    }

    if (!this.topicAdvertised) {
      console.warn("⚠️ Topic not advertised yet");
      return false;
    }

    if (!this.readyForControl) {
      console.warn("⚠️ Not ready for control yet");
      return false;
    }

    try {
      // ✅ CRITICAL: Match the exact message format from working HTML
      const message = {
        op: "publish",
        topic: "/twist",
        msg: {
          linear: {
            x: linear,
            y: 0,
            z: 0
          },
          angular: {
            x: 0,
            y: 0,
            z: angular
          }
        }
      };

      console.log(`📤 SENDING: linear=${linear.toFixed(2)}, angular=${angular.toFixed(2)}`);
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error("❌ Send error:", error);
      return false;
    }
  }

  async emergencyStop(): Promise<void> {
    console.log("🛑 EMERGENCY STOP!");
    this.currentLinear = 0;
    this.currentAngular = 0;
    await this.sendCommand(0, 0);
  }

  isControlActive(): boolean {
    return this.isActive && this.readyForControl;
  }

  getCurrentVelocities() {
    return {
      linear: this.currentLinear,
      angular: this.currentAngular
    };
  }

  private async enableRemoteMode(): Promise<void> {
    try {
      // ✅ CRITICAL: Use backend endpoint to enable remote mode (avoids CORS)
      const response = await fetch("http://192.168.0.183:8000/api/v1/robot/control/enable_remote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        }
      });

      if (!response.ok) {
        console.warn("⚠️ Failed to enable remote mode:", response.status);
        throw new Error("Failed to enable remote mode");
      }

      const data = await response.json();
      
      if (data.ready) {
        console.log("✅ Remote control mode enabled");
      } else {
        console.warn("⚠️ Remote mode response:", data);
        throw new Error(data.msg || "Failed to enable remote mode");
      }
      
      // Wait a bit for robot to switch modes
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error("❌ Enable remote mode error:", error);
      throw error;
    }
  }
}

export const manualControl = new ManualControlService();