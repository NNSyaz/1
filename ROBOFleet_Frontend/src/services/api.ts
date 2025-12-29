// src/services/api.ts - UPDATED WITH LOCATION FETCHING FROM ROBOT MAPS
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

export const getRegisteredRobots = getRobotList;

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

export const deleteRobot = async (sn: string) => {
  const response = await api.delete(`/api/v1/robot/delete/${sn}`);
  return response.data;
};

export const updateRobot = async (sn: string, updateData: any) => {
  const response = await api.put(`/api/v1/robot/update/${sn}`, updateData);
  return response.data;
};

// ============================================================================
// POI (Point of Interest) APIs - IMPROVED
// ============================================================================

export const getPOIList = async () => {
  const response = await api.get("/api/v1/robot/get/poi_list");
  return response.data;
};

export const setPOI = async (
  poiName: string, 
  sn?: string, 
  position?: { x: number; y: number; yaw?: number; ori?: number }
) => {
  const params = new URLSearchParams({ name: poiName });
  const response = await api.get("/api/v1/robot/set/poi", { params });
  return response.data;
};

export const addPOI = async (poiData: any) => {
  const response = await api.post("/api/v1/poi/add", poiData);
  return response.data;
};

export const deletePOI = async (poiName: string) => {
  const response = await api.delete(`/api/v1/poi/delete/${poiName}`);
  return response.data;
};

export const updatePOI = async (poiName: string, updateData: any) => {
  const response = await api.put(`/api/v1/poi/update/${poiName}`, updateData);
  return response.data;
};

// ============================================================================
// LOCATION APIs - ✅ NEW: Fetch locations from robot saved maps
// ============================================================================

/**
 * ✅ Get Temi-specific locations from the robot's saved locations
 * This fetches locations that are saved in the Temi robot itself
 * @param sn Robot serial number
 * @returns Array of location names or objects with name/value
 */
export const getTemiLocations = async (sn: string) => {
  try {
    const response = await api.get("/api/v1/robot/temi/locations", {
      params: { sn },
    });
    
    // Response format: [{ name: "kitchen", value: "kitchen" }, ...] or ["kitchen", "office", ...]
    const locations = response.data;
    
    // Normalize to array of objects with name property
    if (Array.isArray(locations)) {
      return locations.map((loc: any) => {
        if (typeof loc === "string") {
          return { name: loc, value: loc };
        }
        return loc;
      });
    }
    
    return [];
  } catch (error) {
    console.warn("Temi locations endpoint not available, falling back to POI list");
    // Fallback to POI list if Temi endpoint fails
    const pois = await getPOIList();
    return pois.map((poi: any) => ({ name: poi.name, value: poi.name }));
  }
};

/**
 * ✅ Get Fielder/AMR locations from saved POIs in MongoDB
 * @returns Array of POI locations
 */
export const getFielderLocations = async () => {
  const pois = await getPOIList();
  return pois.map((poi: any) => ({ name: poi.name, value: poi.name }));
};

/**
 * ✅ Get all locations for any robot type (unified function)
 * @param sn Robot serial number
 * @param model Robot model (TEMI, AMR, FIELDER)
 * @returns Array of locations
 */
export const getRobotLocations = async (sn: string, model: string) => {
  const isTemi = model?.toUpperCase() === "TEMI";
  
  if (isTemi) {
    return await getTemiLocations(sn);
  } else {
    return await getFielderLocations();
  }
};

/**
 * ✅ Get all robot locations (for maps/monitoring)
 * Returns all robots with their current positions and named locations
 * @returns { locations: Array, count: number }
 */
export const getAllRobotLocations = async () => {
  const response = await api.get("/api/v1/robot/get/all_locations");
  return response.data;
};

/**
 * ✅ Get specific robot location by serial number
 * @param sn Robot serial number
 * @returns { x, y, ori, location (named), online }
 */
export const getRobotLocationBySN = async (sn: string) => {
  const response = await api.get(`/api/v1/robot/get/robot_location/${sn}`);
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

export const cancelTask = async () => {
  try {
    const response = await api.get("/api/v1/robot/cancel/task");
    return response.data;
  } catch (error: any) {
    console.error("Cancel task error:", error);
    return { status: 500, msg: error.message || "Failed to cancel task" };
  }
};

export const cancelMove = async () => {
  const response = await api.post("/api/v1/robot/control/cancel");
  return response.data;
};

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

// ============================================================================
// TEMI ROBOT CONTROL APIs
// ============================================================================

export const moveTemiToPOI = async (sn: string, location: string) => {
  try {
    const response = await api.post("/api/v1/robot/temi/command/goto", {
      sn: sn,
      location: location
    });
    return response.data;
  } catch (error: any) {
    console.error("Temi goto error:", error);
    return { status: 500, msg: error.message || "Failed to move" };
  }
};

export const stopTemi = async (sn: string) => {
  try {
    const response = await api.post("/api/v1/robot/temi/command/stop", { sn });
    return response.data;
  } catch (error: any) {
    console.error("Temi stop error:", error);
    return { status: 500, msg: error.message || "Failed to stop" };
  }
};

export const controlTemiManual = async (
  sn: string,
  linearVelocity: number,
  angularVelocity: number
) => {
  try {
    const response = await api.post("/api/v1/robot/temi/command/manual_control", {
      sn: sn,
      linear: linearVelocity,
      angular: angularVelocity
    });
    return response.data;
  } catch (error: any) {
    console.error("Temi manual control error:", error);
    throw error;
  }
};

export const makeTemiSpeak = async (sn: string, text: string) => {
  try {
    const response = await api.post("/api/v1/robot/temi/command/speak", {
      sn: sn,
      text: text,
      show_text: true
    });
    return response.data;
  } catch (error: any) {
    console.error("TTS error:", error);
    return { status: 500, msg: error.message || "Failed to speak" };
  }
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

export const sendManualControl = async (linear: number, angular: number) => {
  try {
    const response = await api.post("/api/v1/robot/control/manual", {
      linear_velocity: linear,
      angular_velocity: angular
    });
    return response.data;
  } catch (error: any) {
    console.error("Manual control error:", error);
    throw error;
  }
};

export const enableRemoteControl = async () => {
  try {
    const response = await api.post("/api/v1/robot/control/enable_remote");
    return response.data;
  } catch (error: any) {
    console.error("Enable remote control error:", error);
    return { status: 200, msg: "Remote control enabled" };
  }
};

export const fielderGoTo = async (sn: string, location: string) => {
  try {
    const response = await api.post("/api/v1/robot/control/goto", {
      location: location
    });
    return response.data;
  } catch (error: any) {
    console.error("Fielder goto error:", error);
    return { status: 500, msg: error.message || "Failed to navigate" };
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export const controlRobotManual = async (
  sn: string,
  linearVelocity: number,
  angularVelocity: number,
  robotType: string
) => {
  if (robotType.toUpperCase() === "TEMI") {
    return controlTemiManual(sn, linearVelocity, angularVelocity);
  } else {
    return sendManualControl(linearVelocity, angularVelocity);
  }
};

export const stopRobot = async (sn?: string, model?: string) => {
  if (model?.toUpperCase() === "TEMI" && sn) {
    return stopTemi(sn);
  } else {
    return sendManualControl(0, 0);
  }
};

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

export const moveToCoordinate = async (
  x: number,
  y: number,
  ori: number = 0,
  sn?: string
) => {
  try {
    const response = await api.post("/api/v1/robot/control/move_coordinate", {
      x: x,
      y: y,
      ori: ori
    });
    return response.data;
  } catch (error: any) {
    console.error("Move to coordinate error:", error);
    return { status: 500, msg: error.message || "Failed to move" };
  }
};

export const moveToPOI = async (sn: string, location: string, model: string) => {
  const isTemi = model?.toUpperCase() === "TEMI";
  
  if (isTemi) {
    return await moveTemiToPOI(sn, location);
  } else {
    return await fielderGoTo(sn, location);
  }
};

export const moveToCharge = async (sn: string, model: string) => {
  const isTemi = model?.toUpperCase() === "TEMI";
  
  if (isTemi) {
    return await moveTemiToPOI(sn, "home base");
  } else {
    return await fielderGoTo(sn, "origin");
  }
};

/**
 * Fielder Map API Functions
 */
export const getFielderMaps = async (robotIP: string = "192.168.0.250") => {
  const response = await fetch(
    `http://localhost:8000/api/v1/robot/fielder/maps?robot_ip=${robotIP}`
  );
  if (!response.ok) throw new Error("Failed to fetch maps");
  return await response.json();
};

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

export const downloadFielderMapImage = async (mapId: number, robotIP: string = "192.168.0.250") => {
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

export const getFielderActiveMap = async (robotIP: string = "192.168.0.250") => {
  try {
    const maps = await getFielderMaps(robotIP);
    if (!maps || maps.length === 0) {
      throw new Error("No maps found on robot");
    }
    return maps[0];
  } catch (error) {
    console.error("Error getting active Fielder map:", error);
    throw error;
  }
};

export const getRobotIP = async (sn: string): Promise<string> => {
  try {
    const response = await api.get(`/api/v1/robot/get/registered_robots`);
    const robots = response.data;
    
    const robot = robots.find((r: any) => r.data?.sn === sn);
    if (robot && robot.data?.ip) {
      return robot.data.ip;
    }
    
    return "192.168.0.250";
  } catch (error) {
    console.error("Error getting robot IP:", error);
    return "192.168.0.250";
  }
};

// ============================================================================
// FIELDER WAYPOINT SYNC APIs - ✅ NEW
// ============================================================================

/**
 * ✅ Sync waypoints from Fielder robot map to MongoDB
 * This fetches waypoints/overlays from the Fielder robot's active map
 * and stores them in the MongoDB POI collection
 * 
 * @param robotIp Fielder robot IP address (default: 192.168.0.250)
 * @returns Sync result with waypoint count and details
 */
export const syncFielderWaypoints = async (robotIp: string = "192.168.0.250") => {
  try {
    const response = await api.post(`/api/v1/fielder/sync_waypoints?robot_ip=${robotIp}`);
    return response.data;
  } catch (error: any) {
    console.error("Fielder sync error:", error);
    throw error;
  }
};

/**
 * ✅ Get waypoints from Fielder robot (without syncing to DB)
 * Use this to preview waypoints before syncing
 * 
 * @param robotIp Fielder robot IP address
 * @returns List of waypoints from robot
 */
export const getFielderWaypoints = async (robotIp: string = "192.168.0.250") => {
  try {
    const response = await api.get(`/api/v1/fielder/waypoints?robot_ip=${robotIp}`);
    return response.data;
  } catch (error: any) {
    console.error("Failed to get Fielder waypoints:", error);
    throw error;
  }
};

/**
 * ✅ Get list of maps from Fielder robot
 * 
 * @param robotIp Fielder robot IP address
 * @returns List of maps
 */
export const getFielderMapsList = async (robotIp: string = "192.168.0.250") => {
  try {
    const response = await api.get(`/api/v1/fielder/maps?robot_ip=${robotIp}`);
    return response.data;
  } catch (error: any) {
    console.error("Failed to get Fielder maps:", error);
    throw error;
  }
};

/**
 * ✅ Get overlays for a specific Fielder map
 * 
 * @param mapId Map ID
 * @param robotIp Fielder robot IP address
 * @returns List of overlays (waypoints, walls, etc.)
 */
export const getFielderMapOverlays = async (mapId: number, robotIp: string = "192.168.0.250") => {
  try {
    const response = await api.get(`/api/v1/fielder/overlays/${mapId}?robot_ip=${robotIp}`);
    return response.data;
  } catch (error: any) {
    console.error("Failed to get map overlays:", error);
    throw error;
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
  addPOI,

  // ✅ Location Management (NEW)
  getTemiLocations,
  getFielderLocations,
  getRobotLocations,
  getAllRobotLocations,
  getRobotLocationBySN,

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
  fielderGoTo,

  // Utility Functions
  moveToPOI,
  stopRobot,
  controlRobotManual,
  moveToCharge,
  getRobotLocation,
  checkHealth,
  createRobotStatusWebSocket,
  moveToCoordinate,

  // Map Functions
  getFielderMaps,
  getFielderMapDetail,
  downloadFielderMapImage,
  getFielderActiveMap,
  getRobotIP,

  // ✅ Fielder Waypoint Sync (NEW)
  syncFielderWaypoints,
  getFielderWaypoints,
  getFielderMapsList,
  getFielderMapOverlays,
};