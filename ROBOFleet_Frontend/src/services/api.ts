// src/services/api.ts - UPDATED WITH POI IMPROVEMENTS
import axios from "axios";

// Base API URL - adjust this to match your backend
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://192.168.0.183:8000";

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

export const getRobotList = async () => {
  const response = await api.get("/api/v1/robot/get/robot_list");
  return response.data;
};

export const getRobotStatus = async (sn: string) => {
  const response = await api.get("/api/v1/robot/get/robot_status", {
    params: { sn },
  });
  return response.data;
};

export const registerRobot = async (robotData: any) => {
  const response = await api.post("/api/v1/robot/register", robotData);
  return response.data;
};

export const updateRobot = async (sn: string, updateData: any) => {
  const response = await api.put(`/api/v1/robot/update/${sn}`, updateData);
  return response.data;
};

export const deleteRobot = async (sn: string) => {
  const response = await api.delete(`/api/v1/robot/delete/${sn}`);
  return response.data;
};

// ============================================================================
// POI (Point of Interest) APIs - IMPROVED
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
 * ✅ IMPROVED: Set/Save current position as POI (accessible to all robots)
 * @param poiName POI name
 * @param sn Robot serial number (optional)
 * @param position Position data with x, y, yaw/ori
 */
export const setPOI = async (
  poiName: string, 
  sn?: string, 
  position?: { x: number; y: number; yaw?: number; ori?: number }
) => {
  // Prepare payload
  const payload: any = {
    name: poiName,
  };
  
  // Add position data if provided
  if (position) {
    payload.x = position.x;
    payload.y = position.y;
    payload.ori = position.yaw ?? position.ori ?? 0; // Support both yaw and ori
  }
  
  // Add robot SN if provided
  if (sn) {
    payload.sn = sn;
  }
  
  const response = await api.post("/api/v1/robot/set/poi", payload);
  return response.data;
};

/**
 * Delete a POI
 * @param poiName POI name
 */
export const deletePOI = async (poiName: string) => {
  const response = await api.delete(`/api/v1/poi/delete/${poiName}`);
  return response.data;
};

/**
 * Update a POI
 * @param poiName POI name
 * @param updateData Data to update
 */
export const updatePOI = async (poiName: string, updateData: any) => {
  const response = await api.put(`/api/v1/poi/update/${poiName}`, updateData);
  return response.data;
};

// ============================================================================
// TASK MANAGEMENT APIs
// ============================================================================

export const getTaskHistory = async () => {
  const response = await api.get("/api/v1/robot/get/task_history");
  return response.data;
};

export const getTaskDetails = async (taskId: string) => {
  const response = await api.get(`/api/v1/robot/get/task/${taskId}`);
  return response.data;
};

export const cancelTask = async (sn: string) => {
  const response = await api.post("/api/v1/robot/cancel/task", { sn });
  return response.data;
};

export const cancelMove = async () => {
  const response = await api.post("/api/v1/robot/control/cancel");
  return response.data;
};

// ============================================================================
// TEMI ROBOT CONTROL APIs
// ============================================================================

export const moveTemiToPOI = async (sn: string, poiName: string) => {
  const response = await api.post("/api/v1/robot/temi/command/goto", {
    sn,
    location: poiName,
  });
  return response.data;
};

export const stopTemi = async (sn: string) => {
  const response = await api.post("/api/v1/robot/temi/command/stop", { sn });
  return response.data;
};

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

export const moveAMRToPOI = async (sn: string, poiName: string) => {
  const response = await api.post("/api/v1/robot/control/goto", {
    sn,
    location: poiName,
  });
  return response.data;
};

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

export const stopAMR = async (sn: string) => {
  const response = await api.post("/api/v1/robot/control/stop", { sn });
  return response.data;
};

export const sendManualControl = async (
  linear: number,
  angular: number,
  sn?: string
) => {
  if (sn) {
    return controlTemiManual(sn, linear, angular);
  } else {
    const response = await api.post("/api/v1/robot/control/manual", {
      linear_velocity: linear,
      angular_velocity: angular,
    });
    return response.data;
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const stopRobot = async (sn: string, robotType: string) => {
  if (robotType.toUpperCase() === "TEMI") {
    return stopTemi(sn);
  } else {
    return stopAMR(sn);
  }
};

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

export const getRegisteredRobots = getRobotList;

export const getRobotLocation = async (sn: string) => {
  const status = await getRobotStatus(sn);
  return status.robotStatus?.position || { x: 0, y: 0, yaw: 0 };
};

export const checkHealth = async () => {
  try {
    const response = await api.get("/health");
    return response.status === 200;
  } catch {
    return false;
  }
};

export const createRobotStatusWebSocket = (sn: string) => {
  const wsUrl = API_BASE_URL.replace('http://', 'ws://').replace('https://', 'wss://');
  return new WebSocket(`${wsUrl}/ws/robot/${sn}`);
};

/**
 * ✅ NEW: Move robot to exact coordinates
 * @param x X coordinate
 * @param y Y coordinate
 * @param ori Orientation
 * @param sn Robot serial number (optional)
 */
export const moveToCoordinate = async (
  x: number,
  y: number,
  ori: number = 0,
  sn?: string
) => {
  const response = await api.post("/api/v1/robot/control/move_coordinate", {
    x,
    y,
    ori,
    sn,
  });
  return response.data;
};

/**
 * Fielder Map API Functions
 */

export const getFielderMaps = async (robotIP: string = "192.168.0.250") => {
  // ✅ CHANGED: Use backend proxy instead of direct access
  const response = await fetch(
    `http://localhost:8000/api/v1/robot/fielder/maps?robot_ip=${robotIP}`
  );
  if (!response.ok) throw new Error("Failed to fetch maps");
  return await response.json();
};

// Get map detail from Fielder robot
export const getFielderMapDetail = async (mapId: number, robotIP: string = "192.168.0.250") => {
  try {
    const response = await fetch(`http://${robotIP}:8090/maps/${mapId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch map detail: ${response.status}`);
    }
    const mapDetail = await response.json();
    return mapDetail;
  } catch (error) {
    console.error("Error fetching Fielder map detail:", error);
    throw error;
  }
};

// Download map image from Fielder robot
export const downloadFielderMapImage = async (mapId: number, robotIP: string = "192.168.0.250") => {
  // ✅ CHANGED: Use backend proxy
  const response = await fetch(
    `http://localhost:8000/api/v1/robot/fielder/maps/${mapId}/image?robot_ip=${robotIP}`
  );
  if (!response.ok) throw new Error("Failed to download map");
  const blob = await response.blob();
  
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Get active map from Fielder robot
export const getFielderActiveMap = async (robotIP: string = "192.168.0.250") => {
  try {
    const maps = await getFielderMaps(robotIP);
    if (!maps || maps.length === 0) {
      throw new Error("No maps found on robot");
    }
    
    // Return the first map (most recent or active)
    // You can add logic here to select the active map based on criteria
    return maps[0];
  } catch (error) {
    console.error("Error getting active Fielder map:", error);
    throw error;
  }
};

// Get robot IP from database/config
export const getRobotIP = async (sn: string): Promise<string> => {
  try {
    const response = await api.get(`/api/v1/robot/get/registered_robots`);
    const robots = response.data;
    
    const robot = robots.find((r: any) => r.data?.sn === sn);
    if (robot && robot.data?.ip) {
      return robot.data.ip;
    }
    
    // Fallback to default Fielder IP
    return "192.168.0.250";
  } catch (error) {
    console.error("Error getting robot IP:", error);
    return "192.168.0.250";
  }
};

/**
 * Updated Navigation Functions (FIXED)
 */

// Temi: Use dispatchTask endpoint
export const dispatchTask = async (action: string, sn: string, params: any) => {
  try {
    const response = await api.post("/api/v1/robot/dispatch/task", {
      action,
      sn,
      ...params
    });
    return response.data;
  } catch (error: any) {
    console.error("Dispatch task error:", error);
    return { status: 500, msg: error.message || "Failed to dispatch task" };
  }
};

// Temi: TTS command
export const makeTemiSpeak = async (sn: string, text: string) => {
  try {
    const response = await api.post("/api/v1/robot/temi/command/tts", {
      sn,
      text
    });
    return response.data;
  } catch (error: any) {
    console.error("TTS error:", error);
    return { status: 500, msg: error.message || "Failed to speak" };
  }
};

// Fielder: GOTO command
export const fielderGoTo = async (sn: string, location: string) => {
  try {
    const response = await api.post("/api/v1/robot/control/goto", {
      sn,
      location
    });
    return response.data;
  } catch (error: any) {
    console.error("Fielder goto error:", error);
    return { status: 500, msg: error.message || "Failed to navigate" };
  }
};

// Fielder: Enable remote control
export const enableRemoteControl = async () => {
  try {
    const response = await api.post("/api/v1/robot/control/enable_remote");
    return response.data;
  } catch (error: any) {
    console.error("Enable remote control error:", error);
    return { status: 500, msg: error.message || "Failed to enable remote control" };
  }
};

/**
 * Universal Navigation Function (handles both Temi and Fielder)
 */
export const moveToPOI = async (sn: string, location: string, model: string) => {
  const isTemi = model?.toUpperCase() === "TEMI";
  
  if (isTemi) {
    // Use Temi dispatch task
    return await dispatchTask("goto", sn, { location });
  } else {
    // Use Fielder goto
    return await fielderGoTo(sn, location);
  }
};

/**
 * Move to Charge (different locations for Temi and Fielder)
 */
export const moveToCharge = async (sn: string, model: string) => {
  const isTemi = model?.toUpperCase() === "TEMI";
  
  if (isTemi) {
    // Temi: Go to "home base"
    return await dispatchTask("goto", sn, { location: "home base" });
  } else {
    // Fielder: Go to "origin"
    return await fielderGoTo(sn, "origin");
  }
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
  deleteRobot,
  getPOIList,
  setPOI,
  deletePOI,
  updatePOI,

  // POI Management
  addPOI,
  getTemiLocations,

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
  moveToCharge,
  getRobotLocation,
  checkHealth,
  createRobotStatusWebSocket,
  moveToCoordinate,
  fielderGoTo, 
  // Map Functions (NEW)
  getFielderMaps,
  getFielderMapDetail,
  downloadFielderMapImage,
  getFielderActiveMap,
  getRobotIP,
};