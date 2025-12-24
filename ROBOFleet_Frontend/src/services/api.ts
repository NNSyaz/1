import axios from "axios";

// Base API URL - adjust this to match your backend
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor for auth if needed
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("API Error:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// ============================================================================
// ROBOT MANAGEMENT APIs
// ============================================================================

/**
 * Get list of all registered robots
 */
export const getRobotList = async () => {
  const response = await api.get("/api/v1/robot/get/robot_list");
  return response.data;
};

/**
 * Get detailed status of a specific robot
 * @param sn Robot serial number
 */
export const getRobotStatus = async (sn: string) => {
  const response = await api.get("/api/v1/robot/get/robot_status", {
    params: { sn },
  });
  return response.data;
};

/**
 * Register a new robot
 * @param robotData Robot registration data
 */
export const registerRobot = async (robotData: any) => {
  const response = await api.post("/api/v1/robot/register", robotData);
  return response.data;
};

/**
 * Update robot information
 * @param sn Robot serial number
 * @param updateData Data to update
 */
export const updateRobot = async (sn: string, updateData: any) => {
  const response = await api.put(`/api/v1/robot/update/${sn}`, updateData);
  return response.data;
};

/**
 * Delete a robot
 * @param sn Robot serial number
 */
export const deleteRobot = async (sn: string) => {
  const response = await api.delete(`/api/v1/robot/delete/${sn}`);
  return response.data;
};

// ============================================================================
// POI (Point of Interest) APIs
// ============================================================================

/**
 * Get list of all POIs/locations
 */
export const getPOIList = async () => {
  const response = await api.get("/api/v1/robot/get/poi_list");
  return response.data;
};

/**
 * Add a new POI
 * @param poiData POI data
 */
export const addPOI = async (poiData: any) => {
  const response = await api.post("/api/v1/poi/add", poiData);
  return response.data;
};

/**
 * Get Temi-specific locations
 * @param sn Robot serial number
 */
export const getTemiLocations = async (sn: string) => {
  const response = await api.get("/api/v1/robot/temi/locations", {
    params: { sn },
  });
  return response.data;
};

/**
 * Set/Save current position as POI
 * @param poiName POI name
 * @param sn Robot serial number (optional)
 * @param position Position data (optional)
 */
export const setPOI = async (poiName: string, sn?: string, position?: any) => {
  const response = await api.post("/api/v1/poi/set", {
    name: poiName,
    sn,
    ...position,
  });
  return response.data;
};

// ============================================================================
// TASK MANAGEMENT APIs
// ============================================================================

/**
 * Get task history
 */
export const getTaskHistory = async () => {
  const response = await api.get("/api/v1/robot/get/task_history");
  return response.data;
};

/**
 * Get specific task details
 * @param taskId Task ID
 */
export const getTaskDetails = async (taskId: string) => {
  const response = await api.get(`/api/v1/robot/get/task/${taskId}`);
  return response.data;
};

/**
 * Cancel a running task
 * @param sn Robot serial number
 */
export const cancelTask = async (sn: string) => {
  const response = await api.post("/api/v1/robot/cancel/task", { sn });
  return response.data;
};

/**
 * Dispatch a task to a robot
 * @param taskType Type of task (goto, patrol, etc)
 * @param sn Robot serial number
 * @param params Task parameters
 */
export const dispatchTask = async (taskType: string, sn: string, params: any) => {
  const response = await api.post("/api/v1/robot/dispatch/task", {
    task_type: taskType,
    sn,
    ...params,
  });
  return response.data;
};

/**
 * Cancel ongoing movement (AMR/Fielder)
 */
export const cancelMove = async () => {
  const response = await api.post("/api/v1/robot/control/cancel");
  return response.data;
};

// ============================================================================
// TEMI ROBOT CONTROL APIs
// ============================================================================

/**
 * Move Temi robot to a POI
 * @param sn Robot serial number
 * @param poiName Target POI name
 */
export const moveTemiToPOI = async (sn: string, poiName: string) => {
  const response = await api.post("/api/v1/robot/temi/command/goto", {
    sn,
    location: poiName,
  });
  return response.data;
};

/**
 * Stop Temi robot
 * @param sn Robot serial number
 */
export const stopTemi = async (sn: string) => {
  const response = await api.post("/api/v1/robot/temi/command/stop", { sn });
  return response.data;
};

/**
 * Manual control for Temi robot
 * @param sn Robot serial number
 * @param linearVelocity Linear velocity (-1 to 1)
 * @param angularVelocity Angular velocity (-1 to 1)
 */
export const controlTemiManual = async (
  sn: string,
  linearVelocity: number,
  angularVelocity: number
) => {
  const response = await api.post("/api/v1/robot/temi/command/manual_control", {
    sn,
    linear: linearVelocity,
    angular: angularVelocity,
  });
  return response.data;
};

/**
 * Make Temi robot speak (TTS)
 * @param sn Robot serial number
 * @param text Text to speak
 */
export const makeTemiSpeak = async (sn: string, text: string) => {
  const response = await api.post("/api/v1/robot/temi/command/tts", {
    sn,
    text,
  });
  return response.data;
};

/**
 * Tilt Temi's head
 * @param sn Robot serial number
 * @param angle Tilt angle
 */
export const tiltTemiHead = async (sn: string, angle: number) => {
  const response = await api.post("/api/v1/robot/temi/command/tilt", {
    sn,
    angle,
  });
  return response.data;
};

// ============================================================================
// AMR/FIELDER ROBOT CONTROL APIs
// ============================================================================

/**
 * Move AMR/Fielder to coordinates
 * @param sn Robot serial number
 * @param x X coordinate
 * @param y Y coordinate
 * @param yaw Yaw angle (optional)
 */
export const moveAMRToCoordinates = async (
  sn: string,
  x: number,
  y: number,
  yaw?: number
) => {
  const response = await api.post("/api/v1/robot/control/move", {
    sn,
    x,
    y,
    yaw: yaw || 0,
  });
  return response.data;
};

/**
 * Move AMR/Fielder to POI
 * @param sn Robot serial number
 * @param poiName Target POI name
 */
export const moveAMRToPOI = async (sn: string, poiName: string) => {
  const response = await api.post("/api/v1/robot/control/goto", {
    sn,
    location: poiName,
  });
  return response.data;
};

/**
 * Manual control for AMR/Fielder
 * @param sn Robot serial number
 * @param linearVelocity Linear velocity
 * @param angularVelocity Angular velocity
 */
export const controlAMRManual = async (
  sn: string,
  linearVelocity: number,
  angularVelocity: number
) => {
  const response = await api.post("/api/v1/robot/control/manual", {
    sn,
    linear_velocity: linearVelocity,
    angular_velocity: angularVelocity,
  });
  return response.data;
};

/**
 * Stop AMR/Fielder movement
 * @param sn Robot serial number
 */
export const stopAMR = async (sn: string) => {
  const response = await api.post("/api/v1/robot/control/stop", { sn });
  return response.data;
};

/**
 * Send manual control command (generic for both robot types)
 * @param linear Linear velocity
 * @param angular Angular velocity
 * @param sn Robot serial number (optional, mainly for Temi)
 */
export const sendManualControl = async (
  linear: number,
  angular: number,
  sn?: string
) => {
  if (sn) {
    // Temi robot
    return controlTemiManual(sn, linear, angular);
  } else {
    // AMR/Fielder robot - might need different endpoint
    const response = await api.post("/api/v1/robot/control/manual", {
      linear_velocity: linear,
      angular_velocity: angular,
    });
    return response.data;
  }
};

/**
 * Enable remote control mode (mainly for AMR/Fielder)
 */
export const enableRemoteControl = async () => {
  const response = await api.post("/api/v1/robot/control/enable_remote");
  return response.data;
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generic robot movement to POI (auto-detects robot type)
 * @param sn Robot serial number
 * @param poiName Target POI name
 * @param robotType Robot type (TEMI, AMR, FIELDER)
 */
export const moveToPOI = async (
  sn: string,
  poiName: string,
  robotType: string
) => {
  if (robotType.toUpperCase() === "TEMI") {
    return moveTemiToPOI(sn, poiName);
  } else {
    return moveAMRToPOI(sn, poiName);
  }
};

/**
 * Generic robot stop (auto-detects robot type)
 * @param sn Robot serial number
 * @param robotType Robot type (TEMI, AMR, FIELDER)
 */
export const stopRobot = async (sn: string, robotType: string) => {
  if (robotType.toUpperCase() === "TEMI") {
    return stopTemi(sn);
  } else {
    return stopAMR(sn);
  }
};

/**
 * Generic manual control (auto-detects robot type)
 * @param sn Robot serial number
 * @param linearVelocity Linear velocity
 * @param angularVelocity Angular velocity
 * @param robotType Robot type (TEMI, AMR, FIELDER)
 */
export const controlRobotManual = async (
  sn: string,
  linearVelocity: number,
  angularVelocity: number,
  robotType: string
) => {
  if (robotType.toUpperCase() === "TEMI") {
    return controlTemiManual(sn, linearVelocity, angularVelocity);
  } else {
    return controlAMRManual(sn, linearVelocity, angularVelocity);
  }
};

/**
 * Alias for getRobotList (for backward compatibility)
 */
export const getRegisteredRobots = getRobotList;

/**
 * Move robot to charging station
 * @param sn Robot serial number
 * @param robotType Robot type
 */
export const moveToCharge = async (sn: string, robotType: string) => {
  // Use the appropriate method based on robot type
  if (robotType.toUpperCase() === "TEMI") {
    return moveTemiToPOI(sn, "home_base");
  } else {
    return moveAMRToPOI(sn, "charging_station");
  }
};

/**
 * Get robot location/position
 * @param sn Robot serial number
 */
export const getRobotLocation = async (sn: string) => {
  const status = await getRobotStatus(sn);
  return status.robotStatus?.position || { x: 0, y: 0, yaw: 0 };
};

/**
 * Check API health status
 */
export const checkHealth = async () => {
  const response = await api.get("/api/health");
  return response.data;
};

/**
 * Create WebSocket connection for robot status updates
 * @param sn Robot serial number
 */
export const createRobotStatusWebSocket = (sn: string) => {
  const wsUrl = API_BASE_URL.replace('http://', 'ws://').replace('https://', 'wss://');
  return new WebSocket(`${wsUrl}/ws/robot/${sn}`);
};

// ============================================================================
// EXPORT DEFAULT API OBJECT
// ============================================================================

export default {
  // Robot Management
  getRobotList,
  getRegisteredRobots,
  getRobotStatus,
  registerRobot,
  updateRobot,
  deleteRobot,

  // POI Management
  getPOIList,
  addPOI,
  getTemiLocations,
  setPOI,

  // Task Management
  getTaskHistory,
  getTaskDetails,
  cancelTask,
  dispatchTask,
  cancelMove,

  // Temi Control
  moveTemiToPOI,
  stopTemi,
  controlTemiManual,
  makeTemiSpeak,
  tiltTemiHead,

  // AMR/Fielder Control
  moveAMRToCoordinates,
  moveAMRToPOI,
  controlAMRManual,
  stopAMR,
  sendManualControl,
  enableRemoteControl,

  // Utility Functions
  moveToPOI,
  stopRobot,
  controlRobotManual,
  
  // Additional Utility Methods
  moveToCharge,
  getRobotLocation,
  checkHealth,
  createRobotStatusWebSocket,
};