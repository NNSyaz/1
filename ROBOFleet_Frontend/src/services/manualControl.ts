// src/services/manualControl.ts
/**
 * ✅ CORRECT: Manual Control Service for Fielder/AMR Robots
 * Uses flat linear_velocity and angular_velocity fields (NOT nested objects!)
 */

const ROBOT_WS_URL = "ws://192.168.0.250:8090/ws/v2/topics";
const BACKEND_API_URL = "http://192.168.0.183:8000";

class ManualControlService {
  private ws: WebSocket | null = null;
  private isActive = false;
  private commandInterval: ReturnType<typeof setInterval> | null = null;
  private currentLinear = 0;
  private currentAngular = 0;
  private readyForControl = false;
  
  // ✅ CRITICAL: Send commands continuously at 5Hz (200ms)
  private readonly COMMAND_INTERVAL_MS = 200;

  async start(): Promise<boolean> {
    if (this.isActive) {
      console.log("✅ Manual control already active");
      return true;
    }

    try {
      // ✅ STEP 1: Enable remote control mode on robot
      console.log("🔧 Step 1/4: Enabling remote control mode...");
      await this.enableRemoteMode();
      
      // ✅ STEP 2: Connect to robot WebSocket
      console.log("🔌 Step 2/4: Connecting to robot WebSocket...");
      const connected = await this.connectWebSocket();
      
      if (!connected) {
        throw new Error("Failed to connect to robot");
      }
      
      // ✅ STEP 3: Enable twist feedback topic (like HTML does)
      console.log("📡 Step 3/4: Enabling /twist_feedback topic...");
      this.enableTwistFeedback();
      
      // ✅ STEP 4: Start continuous command sending
      console.log("🎮 Step 4/4: Starting command loop...");
      this.startCommandLoop();
      
      this.isActive = true;
      this.readyForControl = true;
      
      console.log("✅ Manual control ready!");
      console.log("🎯 Use keyboard (WASD/Arrows) or virtual joystick to move");
      
      return true;
    } catch (error) {
      console.error("❌ Failed to start manual control:", error);
      this.cleanup();
      throw error;
    }
  }

  private async enableRemoteMode(): Promise<void> {
    try {
      const response = await fetch(`${BACKEND_API_URL}/api/v1/robot/control/enable_remote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to enable remote mode`);
      }

      const data = await response.json();
      
      if (!data.ready && data.status !== 200) {
        throw new Error(data.msg || "Robot not ready for remote control");
      }

      console.log("✅ Remote control mode enabled");
      
      // ✅ CRITICAL: Wait for robot to switch modes
      await this.delay(1000);
    } catch (error) {
      console.error("❌ Enable remote mode error:", error);
      throw error;
    }
  }

  private connectWebSocket(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(ROBOT_WS_URL);
        
        const timeout = setTimeout(() => {
          this.cleanup();
          reject(new Error("WebSocket connection timeout"));
        }, 5000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          console.log("✅ WebSocket connected");
          
          // Ready after a short delay
          setTimeout(() => {
            console.log("✅ Ready for control");
            resolve(true);
          }, 500);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            // Robot sends feedback on various topics
            if (data.topic === "/twist_feedback") {
              // Robot acknowledges command received
              console.log("🤖 Twist command acknowledged");
            } else if (data.topic) {
              console.log("📨 Robot feedback:", data.topic);
            }
          } catch (e) {
            // Ignore parse errors
          }
        };

        this.ws.onerror = (error) => {
          clearTimeout(timeout);
          console.error("❌ WebSocket error:", error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log(`🔌 WebSocket closed: ${event.code} - ${event.reason}`);
          this.cleanup();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private enableTwistFeedback(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("⚠️ Cannot enable feedback - WebSocket not ready");
      return;
    }

    // ✅ CRITICAL: Enable /twist_feedback topic (matching HTML)
    const enableMsg = {
      enable_topic: ["/twist_feedback"]
    };

    console.log("📢 Enabling twist feedback topic");
    this.ws.send(JSON.stringify(enableMsg));
  }

  private startCommandLoop(): void {
    // ✅ CRITICAL: Send commands continuously at 5Hz (200ms interval)
    // This is REQUIRED for Fielder robots - they expect continuous commands
    this.commandInterval = setInterval(() => {
      if (this.readyForControl) {
        this.sendCommand(this.currentLinear, this.currentAngular);
      }
    }, this.COMMAND_INTERVAL_MS);

    console.log(`🔄 Command loop started (${this.COMMAND_INTERVAL_MS}ms interval)`);
  }

  private sendCommand(linear: number, angular: number): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn("⚠️ WebSocket not open, cannot send command");
      return false;
    }

    if (!this.readyForControl) {
      return false;
    }

    try {
      // ✅ CRITICAL FIX: Robot expects FLAT fields, not nested objects!
      // HTML working format: {"topic":"/twist","linear_velocity":0.25,"angular_velocity":0}
      const message = {
        topic: "/twist",
        linear_velocity: linear,
        angular_velocity: angular
      };

      this.ws.send(JSON.stringify(message));
      
      // Only log when velocities change (avoid spam)
      if (linear !== 0 || angular !== 0) {
        console.log(`📤 CMD: linear=${linear.toFixed(2)}, angular=${angular.toFixed(2)}`);
      }
      
      return true;
    } catch (error) {
      console.error("❌ Send command error:", error);
      return false;
    }
  }

  setVelocities(linear: number, angular: number): void {
    // ✅ Store velocities - they will be sent by the command loop
    const changed = (linear !== this.currentLinear || angular !== this.currentAngular);
    
    this.currentLinear = linear;
    this.currentAngular = angular;
    
    if (changed && (linear !== 0 || angular !== 0)) {
      console.log(`🎮 Velocities updated: linear=${linear.toFixed(2)}, angular=${angular.toFixed(2)}`);
    }
  }

  async stop(): Promise<void> {
    console.log("🛑 Stopping manual control...");
    
    // ✅ STEP 1: Send stop command (zero velocities)
    this.currentLinear = 0;
    this.currentAngular = 0;
    
    // Send stop command multiple times to ensure it's received
    for (let i = 0; i < 5; i++) {
      await this.sendCommand(0, 0);
      await this.delay(50);
    }
    
    // ✅ STEP 2: Stop command loop
    this.cleanup();
    
    // ✅ STEP 3: Close WebSocket
    if (this.ws) {
      this.ws.close(1000, "Manual control stopped");
      this.ws = null;
    }
    
    console.log("✅ Manual control stopped");
  }

  private cleanup(): void {
    this.isActive = false;
    this.readyForControl = false;
    
    if (this.commandInterval) {
      clearInterval(this.commandInterval);
      this.commandInterval = null;
    }
    
    this.currentLinear = 0;
    this.currentAngular = 0;
  }

  async emergencyStop(): Promise<void> {
    console.log("🚨 EMERGENCY STOP!");
    this.currentLinear = 0;
    this.currentAngular = 0;
    
    // Send stop command immediately (don't wait for command loop)
    for (let i = 0; i < 5; i++) {
      await this.sendCommand(0, 0);
      await this.delay(50);
    }
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

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const manualControl = new ManualControlService();