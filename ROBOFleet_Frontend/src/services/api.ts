// src/services/api.ts - FIXED VERSION

// Configuration - Change this to match your backend server
const API_BASE_URL = "http://192.168.0.142:8000";
const WS_BASE_URL = "ws://192.168.0.142:8000";

// Helper function to get auth headers
const getAuthHeaders = () => {
  const loginToken = localStorage.getItem("loginToken");
  return {
    "Content-Type": "application/json",
    ...(loginToken && { Authorization: `Bearer ${loginToken}` }),
  };
};

// Helper function to handle API responses
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

    try {
      const errorData = await response.json();
      errorMessage = errorData.msg || errorData.error || errorMessage;
    } catch {
      // If JSON parsing fails, use the default error message
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

export const api = {
  // ============ Authentication ============

  async getAccessToken() {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/robot/get/access_token`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        }
      );
      return handleResponse<{ accessToken: string; expiresIn: number }>(
        response
      );
    } catch (error) {
      console.error("Failed to get access token:", error);
      throw error;
    }
  },

  // ============ Robot Registration & List ============

  async getRegisteredRobots() {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/robot/get/robot_list`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        }
      );
      const data = await handleResponse<any>(response);
      // Handle both array and object responses
      return Array.isArray(data) ? data : data.robots || [];
    } catch (error) {
      console.error("Failed to get registered robots:", error);
      // Return empty array instead of throwing to prevent app crash
      return [];
    }
  },

  async registerRobot(payload: {
    name: string;
    nickname: string;
    sn: string;
    ip: string;
  }) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/robot/register`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      return handleResponse<{ status: number; msg: string }>(response);
    } catch (error) {
      console.error("Failed to register robot:", error);
      throw error;
    }
  },

  // ============ Robot Status ============

  async getRobotStatus(sn: string) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/robot/get/robot_status?sn=${encodeURIComponent(
          sn
        )}`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        }
      );

      // If 404, return default offline status
      if (response.status === 404) {
        console.warn(
          `Robot status not found for ${sn}, returning offline status`
        );
        return {
          robotStatus: {
            state: 0, // Offline
            power: 0,
            areaName: "Unknown",
          },
        };
      }

      return handleResponse<any>(response);
    } catch (error) {
      console.error(`Failed to get robot status for ${sn}:`, error);
      // Return default offline status on error
      return {
        robotStatus: {
          state: 0,
          power: 0,
          areaName: "Unknown",
        },
      };
    }
  },

  // ============ POI Management ============

  async getPOIList() {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/robot/get/poi_list`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        }
      );
      const data = await handleResponse<any>(response);
      return Array.isArray(data) ? data : data.pois || [];
    } catch (error) {
      console.error("Failed to get POI list:", error);
      return [];
    }
  },

  async getPOIDetails(poiName: string) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/robot/get/poi_details?poi=${encodeURIComponent(
          poiName
        )}`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        }
      );
      return handleResponse<any>(response);
    } catch (error) {
      console.error(`Failed to get POI details for ${poiName}:`, error);
      throw error;
    }
  },

  async setPOILocation(name: string) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/robot/set/poi?name=${encodeURIComponent(name)}`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        }
      );
      return handleResponse<string>(response);
    } catch (error) {
      console.error("Failed to set POI location:", error);
      throw error;
    }
  },

  // ============ Robot Movement & Control ============

  async moveToPOI(poiName: string) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(
        `${API_BASE_URL}/api/v1/robot/move/poi?name=${encodeURIComponent(
          poiName
        )}`,
        {
          method: "GET",
          headers: getAuthHeaders(),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      // ✅ Return the response even if it contains an error status
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error(`Failed to move to POI ${poiName}:`, error);

      if (error.name === "AbortError") {
        return {
          status: 504,
          msg: "Request timeout - robot may not be responding",
        };
      }

      return {
        status: 500,
        msg: error.message || "Failed to connect to robot",
      };
    }
  },

  async moveToCharge() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${API_BASE_URL}/api/v1/robot/move/charge`, {
        method: "GET",
        headers: getAuthHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // ✅ Return the response even if it contains an error status
      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error("Failed to move to charge:", error);

      if (error.name === "AbortError") {
        return {
          status: 504,
          msg: "Request timeout - robot may not be responding",
        };
      }

      return {
        status: 500,
        msg: error.message || "Failed to connect to robot",
      };
    }
  },

  async testRobotConnection() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/robot/hello`, {
        method: "GET",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        return { connected: false, error: "Server not responding" };
      }

      return { connected: true, error: null };
    } catch (error: any) {
      return { connected: false, error: error.message };
    }
  },

  // FIXED: Delete Robot - now properly includes robot ID in path
  async deleteRobot(nickname: string) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/robot/delete/robot_name?name=${encodeURIComponent(
          nickname
        )}`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        }
      );
      return handleResponse<any>(response);
    } catch (error) {
      console.error(`Failed to delete robot ${nickname}:`, error);
      throw error;
    }
  },

  async cancelMove() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/robot/move/cancel`, {
        method: "GET",
        headers: getAuthHeaders(),
      });
      return handleResponse<any>(response);
    } catch (error) {
      console.error("Failed to cancel move:", error);
      throw error;
    }
  },

  async moveRobot() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/robot/move`, {
        method: "GET",
        headers: getAuthHeaders(),
      });
      return handleResponse<any>(response);
    } catch (error) {
      console.error("Failed to move robot:", error);
      throw error;
    }
  },

  // ============ Robot Status & Pose ============

  async getCurrentPose() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/robot/test/pose`, {
        method: "GET",
        headers: getAuthHeaders(),
      });
      return handleResponse<any>(response);
    } catch (error) {
      console.error("Failed to get current pose:", error);
      throw error;
    }
  },

  // ============ Robot Settings ============

  async setControlMode(mode: string) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/robot/set/control_mode?mode=${encodeURIComponent(
          mode
        )}`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        }
      );
      return handleResponse<any>(response);
    } catch (error) {
      console.error("Failed to set control mode:", error);
      throw error;
    }
  },

  async setVelocity(velocity: string) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/robot/set/velocity?vel=${encodeURIComponent(
          velocity
        )}`,
        {
          method: "GET",
          headers: getAuthHeaders(),
        }
      );
      return handleResponse<any>(response);
    } catch (error) {
      console.error("Failed to set velocity:", error);
      throw error;
    }
  },

  // ============ Jack Control ============

  async jackUp() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/robot/jack/up`, {
        method: "GET",
        headers: getAuthHeaders(),
      });
      return handleResponse<any>(response);
    } catch (error) {
      console.error("Failed to raise jack:", error);
      throw error;
    }
  },

  async jackDown() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/robot/jack/down`, {
        method: "GET",
        headers: getAuthHeaders(),
      });
      return handleResponse<any>(response);
    } catch (error) {
      console.error("Failed to lower jack:", error);
      throw error;
    }
  },

  // ============ WebSocket Connections ============

  createPoseWebSocket(
    onMessage: (data: any) => void,
    onError?: (error: any) => void
  ): WebSocket {
    const ws = new WebSocket(`${WS_BASE_URL}/api/v1/robot/ws/current_pose`);

    ws.onopen = () => {
      console.log("Pose WebSocket connected");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error("Failed to parse pose WebSocket message:", error);
        if (onError) onError(error);
      }
    };

    ws.onerror = (error) => {
      console.error("Pose WebSocket error:", error);
      if (onError) onError(error);
    };

    ws.onclose = (event) => {
      console.log(`Pose WebSocket closed: ${event.code} - ${event.reason}`);
    };

    return ws;
  },

  // FIXED: Corrected WebSocket endpoint path
  createRobotStatusWebSocket(
    onMessage: (data: {
      status: string;
      battery: number;
      last_poi: string;
    }) => void,
    onError?: (error: any) => void
  ): WebSocket {
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 3000;

    const connect = (): WebSocket => {
      const ws = new WebSocket(
        `${WS_BASE_URL}/api/v1/robot/ws/get/robot_status`
      );

      ws.onopen = () => {
        console.log("Robot status WebSocket connected");
        reconnectAttempts = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("Robot status received:", data);
          onMessage(data);
        } catch (error) {
          console.error("Failed to parse robot status message:", error);
          if (onError) onError(error);
        }
      };

      ws.onerror = (error) => {
        console.error("Robot status WebSocket error:", error);
        if (onError) onError(error);
      };

      ws.onclose = (event) => {
        console.log(
          `Robot status WebSocket closed: ${event.code} - ${event.reason}`
        );

        // ✅ FIX: Auto-reconnect on unexpected close
        if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          console.log(
            `Reconnecting... Attempt ${reconnectAttempts}/${maxReconnectAttempts}`
          );
          setTimeout(() => {
            if (ws.readyState === WebSocket.CLOSED) {
              connect();
            }
          }, reconnectDelay);
        }
      };

      return ws;
    };

    return connect();
  },

  // ============ Utility Functions ============

  async testConnection() {
    try {
      const response = await fetch(`${API_BASE_URL}/hello`, {
        method: "GET",
      });
      return handleResponse<string>(response);
    } catch (error) {
      console.error("Connection test failed:", error);
      throw error;
    }
  },
};

// Export base URLs for direct use if needed
export { API_BASE_URL, WS_BASE_URL };

// Make this a default export as well
export default api;
