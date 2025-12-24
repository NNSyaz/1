// src/services/api.ts - COMPLETE VERSION
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://192.168.0.183:8000";
const WS_BASE_URL = API_BASE_URL.replace("http", "ws");

const getAuthHeaders = () => ({
  "Content-Type": "application/json",
});

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.msg || errorData.error || errorMessage;
    } catch {}
    throw new Error(errorMessage);
  }
  return response.json();
}

export const api = {
  // ============ Health & Connection ============
  async checkHealth() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      return response.ok;
    } catch {
      return false;
    }
  },

  // ============ Robot Management ============
  async getRegisteredRobots() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/robot/get/robot_list`, {
        headers: getAuthHeaders(),
      });
      const data = await handleResponse<any>(response);
      return Array.isArray(data) ? data : data.robots || [];
    } catch (error) {
      console.error("Failed to get registered robots:", error);
      return [];
    }
  },

  async registerRobot(payload: { name: string; nickname: string; sn: string; ip: string; model: string }) {
    const response = await fetch(`${API_BASE_URL}/api/v1/robot/register`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<{ status: number; msg: string }>(response);
  },

  async deleteRobot(nickname: string) {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/robot/delete/robot_name?name=${encodeURIComponent(nickname)}`,
      { headers: getAuthHeaders() }
    );
    return handleResponse<any>(response);
  },

  async getRobotStatus(sn: string) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/robot/get/robot_status?sn=${encodeURIComponent(sn)}`,
        { headers: getAuthHeaders() }
      );
      if (response.status === 404) {
        return { 
          robotStatus: { state: 0, power: 0, areaName: "Unknown" },
          position: { x: 0, y: 0, yaw: 0 }
        };
      }
      const data = await handleResponse<any>(response);
      
      // Ensure position exists in response
      if (!data.position && data.robotStatus?.position) {
        data.position = data.robotStatus.position;
      }
      
      return data;
    } catch (error) {
      console.error(`Failed to get robot status for ${sn}:`, error);
      return { 
        robotStatus: { state: 0, power: 0, areaName: "Unknown" },
        position: { x: 0, y: 0, yaw: 0 }
      };
    }
  },

  async getRobotLocation(sn: string) {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/robot/get/robot_location/${encodeURIComponent(sn)}`,
      { headers: getAuthHeaders() }
    );
    return handleResponse<any>(response);
  },

  // ============ POI Management ============
  async getPOIList() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/robot/get/poi_list`, {
        headers: getAuthHeaders(),
      });
      const data = await handleResponse<any>(response);
      return Array.isArray(data) ? data : data.pois || [];
    } catch {
      return [];
    }
  },

  async setPOI(name: string) {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/robot/set/poi?name=${encodeURIComponent(name)}`,
      { headers: getAuthHeaders() }
    );
    return handleResponse<any>(response);
  },

  async getPOIDetails(poiName: string) {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/robot/get/poi_details?poi=${encodeURIComponent(poiName)}`,
      { headers: getAuthHeaders() }
    );
    return handleResponse<any>(response);
  },

  // ============ Robot Movement ============
  async moveToPOI(poiName: string) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(
        `${API_BASE_URL}/api/v1/robot/move/poi?name=${encodeURIComponent(poiName)}`,
        { headers: getAuthHeaders(), signal: controller.signal }
      );

      clearTimeout(timeoutId);
      return await response.json();
    } catch (error: any) {
      if (error.name === "AbortError") {
        return { status: 504, msg: "Request timeout" };
      }
      return { status: 500, msg: error.message || "Failed to connect" };
    }
  },

  async moveToCharge() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${API_BASE_URL}/api/v1/robot/move/charge`, {
        headers: getAuthHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return await response.json();
    } catch (error: any) {
      if (error.name === "AbortError") {
        return { status: 504, msg: "Request timeout" };
      }
      return { status: 500, msg: error.message || "Failed to connect" };
    }
  },

  async moveToCoordinate(x: number, y: number, yaw: number, sn?: string) {
    const endpoint = sn
      ? `${API_BASE_URL}/api/v1/robot/temi/command/move_coordinate`
      : `${API_BASE_URL}/edge/v1/robot/move/coordinate`;

    const body = sn
      ? { sn, x, y, yaw }
      : { target_x: x, target_y: y, target_ori: yaw };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse<any>(response);
  },

  async cancelMove() {
    const response = await fetch(`${API_BASE_URL}/api/v1/robot/move/cancel`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  async stopRobot(sn: string) {
    const response = await fetch(`${API_BASE_URL}/api/v1/robot/temi/command/stop`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ sn }),
    });
    return handleResponse<any>(response);
  },

  // ============ Tasks ============
  async dispatchTask(taskType: string, robotSn: string | null, params: any) {
    const response = await fetch(`${API_BASE_URL}/api/v1/task/dispatch`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ task_type: taskType, robot_sn: robotSn, ...params }),
    });
    return handleResponse<any>(response);
  },

  async getTaskHistory() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/robot/get/task_history`, {
        headers: getAuthHeaders(),
      });
      const data = await handleResponse<any>(response);
      return Array.isArray(data) ? data : data.tasks || [];
    } catch {
      return [];
    }
  },

  // ============ Manual Control ============
  async sendManualControl(linear: number, angular: number, sn?: string) {
    const endpoint = sn
      ? `${API_BASE_URL}/api/v1/robot/temi/command/manual_control`
      : `${API_BASE_URL}/edge/v1/robot/control/manual`;

    const body = sn ? { sn, linear, angular } : { linear, angular };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    });
    return handleResponse<any>(response);
  },

  async enableRemoteControl() {
    const response = await fetch(`${API_BASE_URL}/api/v1/robot/control/enable_remote`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<any>(response);
  },

  // ============ Temi Specific ============
  async getTemiLocations(sn: string) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/robot/temi/locations?sn=${encodeURIComponent(sn)}`,
        { headers: getAuthHeaders() }
      );
      return handleResponse<any>(response);
    } catch {
      return [];
    }
  },

  async makeTemiSpeak(sn: string, text: string) {
    return this.dispatchTask("speak", sn, { text });
  },

  // ============ WebSocket Connections ============
  createRobotStatusWebSocket(
    onMessage: (data: { status: string; battery: number; last_poi: string }) => void,
    onError?: (error: any) => void
  ): WebSocket {
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 3000;

    const connect = (): WebSocket => {
      const ws = new WebSocket(`${WS_BASE_URL}/api/v1/robot/ws/get/robot_status`);

      ws.onopen = () => {
        console.log("Robot status WebSocket connected");
        reconnectAttempts = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
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
        console.log(`Robot status WebSocket closed: ${event.code}`);
        if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          setTimeout(() => connect(), reconnectDelay);
        }
      };

      return ws;
    };

    return connect();
  },
};

export { API_BASE_URL, WS_BASE_URL };
export default api;