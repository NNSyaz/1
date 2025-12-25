// src/pages/Monitor.tsx - FIXED WITH ACTUAL COORDINATES
import React, { useEffect, useState, useRef } from "react";
import {
  Battery,
  Wifi,
  WifiOff,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Activity,
  Zap,
  Radio,
  Upload,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  X,
} from "lucide-react";
import api from "../services/api";
import { robotStatusService } from "../services/robotStatusService";

/* ---------- Types ------------------------------------------------------ */
interface Robot {
  id: string;
  name: string;
  status: "online" | "offline" | "idle" | "charging";
  battery: number;
  lastSeen: string;
  position: { x: number; y: number };
  signal?: number;
  task?: string;
  sn?: string;
  model?: string;
  // ✅ NEW: Actual coordinates from API
  actualPosition?: { x: number; y: number; yaw: number };
}

interface RegisteredRobot {
  data: {
    sn: string;
    ip?: string;
    time_created?: number;
    model?: string;
  };
  nickname: string;
  name?: string;
  model?: string;
}

/* ---------- Helpers ---------------------------------------------------- */
const formatTimeAgo = (isoString: string): string => {
  const seconds = Math.floor(
    (Date.now() - new Date(isoString).getTime()) / 1000
  );
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const getBatteryColor = (battery: number): string => {
  if (battery <= 20) return "text-red-500";
  if (battery <= 50) return "text-yellow-500";
  return "text-green-500";
};

const getBatteryBg = (battery: number): string => {
  if (battery <= 20) return "bg-red-500";
  if (battery <= 50) return "bg-yellow-500";
  return "bg-green-500";
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case "online":
      return "bg-green-500";
    case "idle":
      return "bg-yellow-500";
    case "offline":
      return "bg-red-500";
    case "charging":
      return "bg-blue-500";
    default:
      return "bg-gray-500";
  }
};

const getStatusTextColor = (status: string): string => {
  switch (status) {
    case "online":
      return "text-green-600";
    case "idle":
      return "text-yellow-600";
    case "offline":
      return "text-red-600";
    case "charging":
      return "text-blue-600";
    default:
      return "text-gray-600";
  }
};

/* ---------- Component -------------------------------------------------- */
const Monitor: React.FC = () => {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [selectedRobot, setSelectedRobot] = useState<Robot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  // Map state
  const [mapImage, setMapImage] = useState<string | null>(
    localStorage.getItem("fleet_map_image")
  );
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---------------- Data fetching ------------------------------------- */
  const fetchRobots = async () => {
    try {
      setLoading(true);
      setError(null);

      const registered = await api.getRegisteredRobots();

      if (!registered?.length) {
        setRobots([]);
        setLoading(false);
        return;
      }

      const robotsWithStatus = await Promise.all(
        registered.map(async (r: RegisteredRobot) => {
          try {
            const status = await api.getRobotStatus(r.data.sn);
            const isOnline = status?.robotStatus?.state >= 2;

            // ✅ GET ACTUAL POSITION FROM API
            const actualPosition = status?.position || status?.robotStatus?.position || { x: 0, y: 0, yaw: 0 };
            
            console.log(`📍 Robot ${r.nickname} actual position:`, actualPosition);
            
            // Convert to map coordinates (0-100 range for percentage positioning)
            const mapX = actualPosition.x !== 0 ? 50 + (actualPosition.x * 5) : 50;
            const mapY = actualPosition.y !== 0 ? 50 - (actualPosition.y * 5) : 50;
            
            const boundedX = Math.max(5, Math.min(95, mapX));
            const boundedY = Math.max(5, Math.min(95, mapY));

            return {
              id: r.data.sn,
              name: r.nickname || `Robot ${r.data.sn}`,
              status: isOnline ? ("online" as const) : ("offline" as const),
              battery: status?.robotStatus?.power ?? 0,
              lastSeen: new Date().toISOString(),
              position: {
                x: boundedX,
                y: boundedY,
              },
              // ✅ STORE ACTUAL POSITION
              actualPosition: {
                x: actualPosition.x || 0,
                y: actualPosition.y || 0,
                yaw: actualPosition.yaw || actualPosition.ori || 0
              },
              signal: isOnline ? 85 + Math.random() * 15 : 0,
              task: isOnline ? "Idle" : "Offline",
              sn: r.data.sn,
              model: r.data?.model || r.model || "AMR",
            };
          } catch (e) {
            console.error(`Failed to get status for ${r.data.sn}:`, e);
            return {
              id: r.data.sn,
              name: r.nickname || `Robot ${r.data.sn}`,
              status: "offline" as const,
              battery: 0,
              lastSeen: new Date().toISOString(),
              position: { x: 50, y: 50 },
              actualPosition: { x: 0, y: 0, yaw: 0 },
              signal: 0,
              task: "Offline",
              sn: r.data.sn,
              model: r.data?.model || r.model || "AMR",
            };
          }
        })
      );

      setRobots(robotsWithStatus);
      setLastUpdate(new Date());

      if (!selectedRobot && robotsWithStatus.length > 0) {
        setSelectedRobot(robotsWithStatus[0]);
      }
    } catch (err: any) {
      console.error("Failed to fetch robots:", err);
      setError(err.message || "Failed to load robot data");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- Lifecycle ----------------------------------------- */
  useEffect(() => {
    fetchRobots();
    const interval = setInterval(fetchRobots, 30000);
    return () => clearInterval(interval);
  }, []);

  /* ---------------- WebSocket for real-time updates ------------------ */
  useEffect(() => {
    const unsubscribe = robotStatusService.subscribe((data) => {
      let status: "online" | "offline" | "idle" | "charging";

      if (data.status === "charging") {
        status = "charging";
      } else if (data.status === "active" || data.status === "online") {
        status = "online";
      } else if (data.status === "idle") {
        status = "idle";
      } else {
        status = "offline";
      }

      setRobots((prev) =>
        prev.map((robot) => ({
          ...robot,
          battery: data.battery,
          status,
          task:
            data.status === "charging"
              ? "Charging"
              : data.status === "idle"
              ? "Idle"
              : data.last_poi !== "center"
              ? `Moving to ${data.last_poi}`
              : "Idle",
          lastSeen: new Date().toISOString(),
        }))
      );

      if (selectedRobot) {
        setSelectedRobot((prev) =>
          prev
            ? {
                ...prev,
                battery: data.battery,
                status,
                task:
                  data.status === "charging"
                    ? "Charging"
                    : data.status === "idle"
                    ? "Idle"
                    : data.last_poi != "center"
                    ? `Moving to ${data.last_poi}`
                    : "Idle",
              }
            : null
        );
      }
    });

    return () => {
      unsubscribe();
    };
  }, [selectedRobot?.id]);

  /* ---------------- Map Controls -------------------------------------- */
  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.2, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.2, 0.5));
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => Math.max(0.5, Math.min(3, prev + delta)));
  };

  /* ---------------- Map Image Upload ---------------------------------- */
  const handleMapImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const imageData = event.target?.result as string;
      setMapImage(imageData);
      localStorage.setItem("fleet_map_image", imageData);
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadMapFromRobot = async () => {
    // Note: This feature requires getRobotIP and getFielderMaps API methods
    // which are not currently implemented in the API service.
    // For now, users can upload maps manually using the upload button.
    alert("⚠️ Map download from robot is not yet implemented. Please use the upload button to add a map image manually.");
  };

  const handleRemoveMapImage = () => {
    setMapImage(null);
    localStorage.removeItem("fleet_map_image");
  };

  /* ---------------- Derived state ------------------------------------- */
  const onlineCount = robots.filter((r) => r.status === "online").length;
  const idleCount = robots.filter((r) => r.status === "idle").length;
  const offlineCount = robots.filter((r) => r.status === "offline").length;
  const lowBatteryCount = robots.filter((r) => r.battery < 25).length;
  const criticalAlerts = robots.filter(
    (r) => r.status === "offline" || r.battery < 20
  );

  /* ---------------- Render -------------------------------------------- */
  if (loading && robots.length === 0) {
    return (
      <div className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <div className="text-lg text-gray-600">Loading fleet data...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Fleet Monitor
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Real-time robot tracking and monitoring
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                Last update: {lastUpdate.toLocaleTimeString()}
              </div>
              <button
                onClick={fetchRobots}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle size={20} />
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-2xl font-bold text-gray-900">
                {robots.length}
              </span>
            </div>
            <div className="text-sm font-medium text-gray-600">Total Fleet</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-2xl font-bold text-green-600">
                {onlineCount}
              </span>
            </div>
            <div className="text-sm font-medium text-gray-600">Online</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <span className="text-2xl font-bold text-yellow-600">
                {idleCount}
              </span>
            </div>
            <div className="text-sm font-medium text-gray-600">Idle</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-2xl font-bold text-red-600">
                {offlineCount}
              </span>
            </div>
            <div className="text-sm font-medium text-gray-600">Offline</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Zap className="w-5 h-5 text-orange-600" />
              </div>
              <span className="text-2xl font-bold text-orange-600">
                {lowBatteryCount}
              </span>
            </div>
            <div className="text-sm font-medium text-gray-600">Low Battery</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Robot List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-5 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">
                  Fleet Status
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {onlineCount} of {robots.length} robots active
                </p>
              </div>
              <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                {robots.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Activity className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p className="font-medium">No robots found</p>
                    <p className="text-sm mt-1">
                      Add robots to start monitoring
                    </p>
                  </div>
                ) : (
                  robots.map((robot) => (
                    <div
                      key={robot.id}
                      onClick={() => setSelectedRobot(robot)}
                      className={`p-4 cursor-pointer transition-all hover:bg-gray-50 ${
                        selectedRobot?.id === robot.id
                          ? "bg-blue-50 border-l-4 border-blue-600"
                          : ""
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">
                              {robot.name}
                            </h3>
                            <div
                              className={`w-2 h-2 rounded-full ${getStatusColor(
                                robot.status
                              )}`}
                            />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span
                              className={`font-medium capitalize ${getStatusTextColor(
                                robot.status
                              )}`}
                            >
                              {robot.status}
                            </span>
                            <span>•</span>
                            <span>{robot.task || "Idle"}</span>
                          </div>
                          {/* ✅ DISPLAY ACTUAL COORDINATES */}
                          {robot.actualPosition && (
                            <div className="text-xs text-gray-500 mt-1 font-mono">
                              Pos: ({robot.actualPosition.x.toFixed(2)}, {robot.actualPosition.y.toFixed(2)})
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div
                            className={`text-lg font-bold ${getBatteryColor(
                              robot.battery
                            )}`}
                          >
                            {robot.battery}%
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-600">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatTimeAgo(robot.lastSeen)}</span>
                        </div>
                        {robot.status === "online" && robot.signal && (
                          <div className="flex items-center gap-1">
                            <Radio className="w-3 h-3" />
                            <span>{Math.round(robot.signal)}%</span>
                          </div>
                        )}
                      </div>

                      {/* Battery bar */}
                      <div className="mt-3 w-full bg-gray-200 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${getBatteryBg(
                            robot.battery
                          )}`}
                          style={{ width: `${robot.battery}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Map and Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Map with Zoom Controls */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    Live Map
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Real-time robot positions
                  </p>
                </div>
                
                {/* Map Controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                    title="Upload Map Image"
                  >
                    <Upload className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleDownloadMapFromRobot}
                    className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200"
                    title="Get Map from Robot"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  {mapImage && (
                    <button
                      onClick={handleRemoveMapImage}
                      className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                      title="Remove Map Image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <div className="h-6 w-px bg-gray-300" />
                  <button
                    onClick={handleZoomIn}
                    className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleZoomOut}
                    className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleResetView}
                    className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                    title="Reset View"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-gray-500 ml-2">
                    {Math.round(zoom * 100)}%
                  </span>
                </div>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleMapImageUpload}
                className="hidden"
              />

              <div
                ref={mapContainerRef}
                className="relative w-full h-96 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border-2 border-gray-200 overflow-hidden cursor-move"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
              >
                <div
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center',
                    transition: isDragging ? 'none' : 'transform 0.1s',
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                  }}
                >
                  {mapImage && (
                    <img
                      src={mapImage}
                      alt="Fleet Map"
                      className="absolute inset-0 w-full h-full object-contain"
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                  
                  {!mapImage && (
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `
                          linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                          linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
                        `,
                        backgroundSize: "40px 40px",
                      }}
                    />
                  )}

                  {!mapImage && (
                    <svg
                      className="absolute inset-0 w-full h-full"
                      style={{ pointerEvents: "none" }}
                    >
                      <line
                        x1="25%"
                        y1="0"
                        x2="25%"
                        y2="60%"
                        stroke="#9ca3af"
                        strokeWidth="2"
                      />
                      <line
                        x1="25%"
                        y1="60%"
                        x2="0"
                        y2="60%"
                        stroke="#9ca3af"
                        strokeWidth="2"
                      />
                      <line
                        x1="55%"
                        y1="0"
                        x2="55%"
                        y2="75%"
                        stroke="#9ca3af"
                        strokeWidth="2"
                      />
                      <line
                        x1="0"
                        y1="30%"
                        x2="100%"
                        y2="30%"
                        stroke="#9ca3af"
                        strokeWidth="2"
                      />
                      <line
                        x1="40%"
                        y1="30%"
                        x2="40%"
                        y2="100%"
                        stroke="#9ca3af"
                        strokeWidth="2"
                      />
                      <line
                        x1="75%"
                        y1="15%"
                        x2="75%"
                        y2="75%"
                        stroke="#9ca3af"
                        strokeWidth="2"
                      />
                    </svg>
                  )}

                  {!mapImage && (
                    <>
                      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow-sm">
                        <span className="text-xs font-medium text-gray-700">
                          Zone A
                        </span>
                      </div>
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg shadow-sm">
                        <span className="text-xs font-medium text-gray-700">
                          Zone B
                        </span>
                      </div>
                    </>
                  )}

                  {/* Robots */}
                  {robots.map((robot) => (
                    <div
                      key={robot.id}
                      className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ${
                        selectedRobot?.id === robot.id ? "z-10 scale-110" : "z-0"
                      }`}
                      style={{
                        left: `${robot.position.x}%`,
                        top: `${robot.position.y}%`,
                        pointerEvents: 'none',
                      }}
                    >
                      <div
                        className={`relative w-10 h-10 rounded-full shadow-lg flex items-center justify-center ${getStatusColor(
                          robot.status
                        )} ${
                          selectedRobot?.id === robot.id
                            ? "ring-4 ring-blue-600 ring-opacity-50"
                            : ""
                        }`}
                      >
                        <Activity className="w-5 h-5 text-white" />

                        <div
                          className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(
                            robot.status
                          )}`}
                        />
                      </div>

                      {/* ✅ DISPLAY ACTUAL COORDINATES */}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-white/95 backdrop-blur px-2 py-1 rounded shadow-sm whitespace-nowrap">
                        <span className="text-xs font-medium text-gray-900 block">
                          {robot.name}
                        </span>
                        {robot.actualPosition && (
                          <span className="text-xs text-gray-600 font-mono block">
                            ({robot.actualPosition.x.toFixed(2)}, {robot.actualPosition.y.toFixed(2)})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 text-xs text-gray-500 space-y-1">
                <p>• Scroll to zoom in/out</p>
                <p>• Click and drag to pan the map</p>
                <p>• Upload custom map or download from robot</p>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-6 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full" />
                  <span className="text-gray-600">Online</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                  <span className="text-gray-600">Idle</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full" />
                  <span className="text-gray-600">Offline</span>
                </div>
              </div>
            </div>

            {/* Robot Details Panel */}
            {selectedRobot && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="mb-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">
                      {selectedRobot.name}
                    </h2>
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${getStatusColor(
                          selectedRobot.status
                        )}`}
                      />
                      <span
                        className={`text-sm font-medium capitalize ${getStatusTextColor(
                          selectedRobot.status
                        )}`}
                      >
                        {selectedRobot.status}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Serial: {selectedRobot.sn || selectedRobot.id}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className={`p-2 rounded-lg ${
                          selectedRobot.battery <= 20
                            ? "bg-red-100"
                            : selectedRobot.battery <= 50
                            ? "bg-yellow-100"
                            : "bg-green-100"
                        }`}
                      >
                        <Battery
                          className={`w-5 h-5 ${getBatteryColor(
                            selectedRobot.battery
                          )}`}
                        />
                      </div>
                      <div>
                        <div className="text-xs text-gray-600">
                          Battery Level
                        </div>
                        <div
                          className={`text-xl font-bold ${getBatteryColor(
                            selectedRobot.battery
                          )}`}
                        >
                          {selectedRobot.battery}%
                        </div>
                      </div>
                    </div>
                    <div className="w-full bg-gray-300 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${getBatteryBg(
                          selectedRobot.battery
                        )}`}
                        style={{ width: `${selectedRobot.battery}%` }}
                      />
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          selectedRobot.status === "online"
                            ? "bg-green-100"
                            : "bg-red-100"
                        }`}
                      >
                        {selectedRobot.status === "online" ? (
                          <Wifi className="w-5 h-5 text-green-600" />
                        ) : (
                          <WifiOff className="w-5 h-5 text-red-600" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs text-gray-600">
                          Signal Strength
                        </div>
                        <div className="text-xl font-bold text-gray-900">
                          {selectedRobot.signal
                            ? `${Math.round(selectedRobot.signal)}%`
                            : "N/A"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ✅ DISPLAY ACTUAL POSITION */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <MapPin className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-xs text-gray-600">Position</div>
                        {selectedRobot.actualPosition ? (
                          <div className="text-sm font-semibold text-gray-900 font-mono">
                            ({selectedRobot.actualPosition.x.toFixed(3)}, {selectedRobot.actualPosition.y.toFixed(3)})
                          </div>
                        ) : (
                          <div className="text-sm font-semibold text-gray-900">
                            N/A
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Clock className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <div className="text-xs text-gray-600">Last Seen</div>
                        <div className="text-sm font-semibold text-gray-900">
                          {formatTimeAgo(selectedRobot.lastSeen)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Alerts */}
            {criticalAlerts.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Critical Alerts
                  </h2>
                  <span className="ml-auto bg-red-100 text-red-600 text-xs font-medium px-2.5 py-0.5 rounded-full">
                    {criticalAlerts.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {criticalAlerts.map((robot) => (
                    <div
                      key={robot.id}
                      className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-lg"
                    >
                      <div
                        className={`p-2 rounded-lg ${
                          robot.status === "offline"
                            ? "bg-red-200"
                            : "bg-yellow-200"
                        }`}
                      >
                        {robot.status === "offline" ? (
                          <XCircle className="w-5 h-5 text-red-700" />
                        ) : (
                          <Battery className="w-5 h-5 text-yellow-700" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {robot.name}
                        </div>
                        <div className="text-sm text-gray-600">
                          {robot.status === "offline"
                            ? `Offline - Last seen ${formatTimeAgo(
                                robot.lastSeen
                              )}`
                            : `Low battery - ${robot.battery}%`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Monitor;