// src/services/manualControl.ts
/**
 * ✅ SUPER VERBOSE DEBUG VERSION
 */

const ROBOT_WS_URL = "ws://192.168.0.250:8090/ws/v2/topics";

class ManualControlService {
  private ws: WebSocket | null = null;
  private isActive = false;
  private commandInterval: ReturnType<typeof setInterval> | null = null;
  private currentLinear = 0;
  private currentAngular = 0;
  private commandDelay = 100;
  private topicAdvertised = false;

  async start(): Promise<boolean> {
    if (this.isActive) {
      console.log("Manual control already active");
      return true;
    }

    try {
      console.log("🎮 Connecting to robot WebSocket...");
      this.ws = new WebSocket(ROBOT_WS_URL);
      
      return new Promise((resolve, reject) => {
        if (!this.ws) {
          reject(new Error("Failed to create WebSocket"));
          return;
        }

        this.ws.onopen = () => {
          console.log("✅ WebSocket connected");
          
          // Advertise topic
          this.advertiseTopic();
          
          setTimeout(() => {
            console.log("✅ Ready for control!");
            console.log("🎯 Press W/A/S/D or arrow keys to move");
            this.isActive = true;
            
            // Start command loop
            this.commandInterval = setInterval(() => {
              this.sendCurrentCommand();
            }, this.commandDelay);
            
            resolve(true);
          }, 500);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            // Log ALL messages to see if robot acknowledges advertise
            console.log("📨 Robot:", data);
          } catch (e) {
            console.log("📨 Robot (raw):", event.data);
          }
        };

        this.ws.onerror = (error) => {
          console.error("❌ WebSocket error:", error);
          reject(new Error("WebSocket connection failed"));
        };

        this.ws.onclose = () => {
          console.log("WebSocket closed");
          this.isActive = false;
          this.topicAdvertised = false;
        };

        setTimeout(() => {
          if (!this.isActive) {
            reject(new Error("WebSocket timeout"));
          }
        }, 5000);
      });
    } catch (error) {
      console.error("❌ Start error:", error);
      throw error;
    }
  }

  private advertiseTopic(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const advertiseMsg = {
      op: "advertise",
      topic: "/cmd_vel",
      type: "geometry_msgs/Twist"
    };

    console.log("📢 Advertising /cmd_vel topic:", advertiseMsg);
    this.ws.send(JSON.stringify(advertiseMsg));
    this.topicAdvertised = true;
  }

  async stop(): Promise<void> {
    console.log("🛑 Stopping manual control...");
    this.isActive = false;
    
    if (this.commandInterval) {
      clearInterval(this.commandInterval);
      this.commandInterval = null;
    }

    await this.sendCommand(0, 0);

    if (this.topicAdvertised && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const unadvertiseMsg = {
        op: "unadvertise",
        topic: "/cmd_vel"
      };
      console.log("📢 Unadvertising /cmd_vel");
      this.ws.send(JSON.stringify(unadvertiseMsg));
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.currentLinear = 0;
    this.currentAngular = 0;
    this.topicAdvertised = false;

    console.log("✅ Manual control stopped");
  }

  setVelocities(linear: number, angular: number): void {
    const changed = (linear !== this.currentLinear || angular !== this.currentAngular);
    
    this.currentLinear = linear;
    this.currentAngular = angular;
    
    if (changed) {
      console.log(`🎮 NEW velocities: linear=${linear.toFixed(2)}, angular=${angular.toFixed(2)}`);
      console.log(`   isActive=${this.isActive}, topicAdvertised=${this.topicAdvertised}, wsState=${this.ws?.readyState}`);
    }
  }

  private async sendCurrentCommand(): Promise<void> {
    if (!this.isActive) return;
    
    // Only send if there's movement
    if (this.currentLinear === 0 && this.currentAngular === 0) {
      return;
    }
    
    await this.sendCommand(this.currentLinear, this.currentAngular);
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

    try {
      const message = {
        op: "publish",
        topic: "/cmd_vel",
        msg: {
          linear: { x: linear, y: 0, z: 0 },
          angular: { x: 0, y: 0, z: angular }
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
    return this.isActive;
  }

  getCurrentVelocities() {
    return {
      linear: this.currentLinear,
      angular: this.currentAngular
    };
  }
}

export const manualControl = new ManualControlService();