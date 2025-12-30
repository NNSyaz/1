// src/pages/RobotManagement.tsx - TYPESCRIPT ERRORS FIXED
import React, { useState, useEffect } from "react";
import {
  X,
  Plus,
  Battery,
  Wifi,
  Activity,
  CheckCircle,
  RefreshCw,
  AlertCircle,
  MapPin,
  Trash2,
  ArrowLeft,
  Gamepad2,
} from "lucide-react";
import fielderImage from "../assets/fielderImage.png";
import temiImage from "../assets/temiImage.png"; 
import api from "../services/api";
import { robotStatusService } from "../services/robotStatusService";
import RobotControlModal from "../components/modals/RobotControlModal";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
type Robot = {
  id: string;
  name: string;
  nickname: string;
  model: string;
  location: string;
  status: string;
  battery: number;
  lastSeen?: string;
  currentTask?: string;
  healthStatus?: string;
  temperature?: number;
  cpuLoad?: number;
  motorStatus?: string;
  sensorStatus?: string;
  connectivity?: string;
  ipAddress?: string;
  macAddress?: string;
  description?: string;
  sn?: string;
  ip?: string;
};

interface RegisteredRobot {
  data: { sn: string; ip?: string; time_created?: number; model?: string };
  nickname: string;
  name?: string;
  model?: string;
}

/* ------------------------------------------------------------------ */
/* Helper Functions                                                   */
/* ------------------------------------------------------------------ */
const getRobotModel = (robot: any): string => {
  const validModels = ["TEMI", "AMR", "FIELDER"];
  let model =
    robot.model ||
    robot.data?.model ||
    robot.type?.toUpperCase() ||
    "UNKNOWN";
  model = String(model).toUpperCase();
  return validModels.includes(model) ? model : "AMR"; // Default to AMR if unknown
};

const getRobotImage = (model: string) => {
  switch (model.toUpperCase()) {
    case "TEMI":
      return temiImage;
    case "FIELDER":
    case "AMR":
    default:
      return fielderImage;
  }
};

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */
const RobotManagement: React.FC = () => {
  /* ------------ State --------------------------------------------- */
  const [detailView, setDetailView] = useState<
    "summary" | "details" | "health"
  >("summary");
  const [robots, setRobots] = useState<Robot[]>([]);
  const [selectedRobot, setSelectedRobot] = useState<Robot | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showAddRobot, setShowAddRobot] = useState(false);
  const [showControlModal, setShowControlModal] = useState(false);
  const [robotFilter, setRobotFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pois, setPois] = useState<any[]>([]);

  const [newRobotForm, setNewRobotForm] = useState({
    name: "",
    nickname: "",
    sn: "",
    ip: "",
    model: "AMR",
  });

  /* ------------ Data Fetching ------------------------------------- */
  const fetchRobots = async () => {
    try {
      setLoading(true);
      setError(null);
      const registeredRobots: RegisteredRobot[] =
        await api.getRegisteredRobots();
      
      if (!registeredRobots.length) {
        setRobots([]);
        return;
      }

      // ✅ FIX: Fetch status for each robot individually
      const transformed: Robot[] = await Promise.all(
        registeredRobots.map(async (r) => {
          const model = getRobotModel(r);
          const ws = robotStatusService.getLastData();

          // ✅ FIX: Get status from API, not just WebSocket
          let status = "Offline";
          let battery = 0;
          let location = "Unknown";
          let task = "Offline";

          try {
            // Fetch real-time status from API
            const statusRes = await api.getRobotStatus(r.data.sn);

            if (statusRes && statusRes.robotStatus) {
              const apiState = statusRes.robotStatus.state;

              // ✅ CRITICAL FIX: Proper status detection
              if (apiState >= 2) {
                status = "Online";
              } else if (apiState === 1) {
                status = "Idle";
              } else {
                status = "Offline";
              }

              battery = statusRes.robotStatus.power || 0;
              location = statusRes.robotStatus.areaName || "Unknown";

              // Check if charging
              if (ws?.status === "charging") {
                status = "Charging";
                task = "Charging";
              } else if (apiState >= 2) {
                task = location !== "center" ? `At ${location}` : "Idle";
              } else {
                task = "Offline";
              }
            }
          } catch (e) {
            console.warn(`Failed to fetch status for ${r.data.sn}:`, e);
          }

          return {
            id: r.data?.sn || r.nickname || `robot-${Math.random()}`,
            name: r.nickname || r.name || "Unknown Robot",
            nickname: r.nickname,
            model: model,
            location,
            status,
            battery,
            lastSeen: new Date().toLocaleString(),
            currentTask: task,
            healthStatus: status === "Online" ? "Healthy" : "Unknown",
            temperature: 35,
            cpuLoad: 40,
            motorStatus: "OK",
            sensorStatus: "All active",
            connectivity: status === "Online" ? "Good" : "Poor",
            ipAddress: r.data?.ip || "Unknown",
            macAddress: "00:1A:C2:9B:00:5F",
            description: `Robot ${r.nickname}`,
            sn: r.data?.sn,
            ip: r.data?.ip,
          };
        })
      );

      setRobots(transformed);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to fetch robots");
    } finally {
      setLoading(false);
    }
  };

  const fetchPOIs = async () => {
    try {
      setPois(await api.getPOIList());
    } catch {}
  };

  useEffect(() => {
    fetchRobots();
    fetchPOIs();
    const id = setInterval(fetchRobots, 30_000);
    return () => clearInterval(id);
  }, []);

  // ✅ FIX: WebSocket updates
  useEffect(() => {
    const unsub = robotStatusService.subscribe((data) => {
      let status: string;

      if (data.status === "charging") {
        status = "Charging";
      } else if (data.status === "active" || data.status === "online") {
        status = "Online";
      } else if (data.status === "idle") {
        status = "Idle";
      } else {
        status = "Offline";
      }

      const task =
        data.status === "charging"
          ? "Charging"
          : data.status === "idle"
          ? "Idle"
          : data.last_poi !== "center"
          ? `At ${data.last_poi}`
          : "Idle";

      setRobots((prev) =>
        prev.map((r) => ({
          ...r,
          battery: data.battery,
          status,
          location: data.last_poi,
          currentTask: task,
        }))
      );

      if (selectedRobot)
        setSelectedRobot((s) =>
          s
            ? {
                ...s,
                battery: data.battery,
                status,
                location: data.last_poi,
                currentTask: task,
              }
            : null
        );
    });
    return unsub;
  }, [selectedRobot]);

  /* ------------ Handlers ------------------------------------------ */
  const handleRobotClick = (robot: Robot) => setSelectedRobot(robot);
  
  const handleAddRobot = async () => {
    try {
      setLoading(true);
      const res = await api.registerRobot(newRobotForm);
      if (res.status === 200) {
        await fetchRobots();
        setShowAddRobot(false);
        setNewRobotForm({
          name: "",
          nickname: "",
          sn: "",
          ip: "",
          model: "AMR",
        });
      } else alert(res.msg || "Failed to register");
    } catch (err: any) {
      alert(err.message || "Failed to register");
    } finally {
      setLoading(false);
    }
  };

  const handleMoveToPOI = async (poiName: string) => {
    if (!selectedRobot || !selectedRobot.sn) return; // ✅ FIX: Check for undefined sn
    
    try {
      setLoading(true);
      const result = await api.moveToPOI(selectedRobot.sn, poiName, selectedRobot.model);
      
      if (result.status && result.status !== 200) {
        alert(`Error: ${result.msg || "Failed to move to POI"}`);
        return;
      }

      alert(`Moving to ${poiName}`);
      setTimeout(() => fetchRobots(), 2000);
    } catch (err: any) {
      console.error("Failed to move to POI:", err);
      alert(err.message || "Failed to move to POI");
    } finally {
      setLoading(false);
    }
  };

  const handleMoveToCharge = async () => {
    if (!selectedRobot || !selectedRobot.sn) return; // ✅ FIX: Check for undefined sn
    
    try {
      setLoading(true);
      const result = await api.moveToCharge(selectedRobot.sn, selectedRobot.model);

      if (result.status && result.status !== 200) {
        alert(`Error: ${result.msg || "Failed to move to charging station"}`);
        return;
      }

      alert("Moving to charging station");
      setTimeout(() => fetchRobots(), 2000);
    } catch (err: any) {
      console.error("Failed to move to charge:", err);
      alert(err.message || "Failed to move to charging station");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRobot = async () => {
    if (!selectedRobot) return;
    const id =
      selectedRobot.nickname || selectedRobot.name || selectedRobot.sn;
    if (!id) return alert("No identifier");
    try {
      await api.deleteRobot(id);
      await fetchRobots();
      setSelectedRobot(null);
      setShowRemoveConfirm(false);
    } catch (err: any) {
      alert(err.message || "Failed to delete");
    }
  };

  /* ------------ Helpers ------------------------------------------- */
  const filteredRobots = robots.filter((r) =>
    `${r.name} ${r.id} ${r.location}`
      .toLowerCase()
      .includes(robotFilter.toLowerCase())
  );

  const getStatusBadge = (s: string) => {
    if (s === "Online" || s === "Charging")
      return "bg-green-100 text-green-700 border-green-200";
    if (s === "Idle") return "bg-yellow-100 text-yellow-700 border-yellow-200";
    return "bg-red-100 text-red-700 border-red-200";
  };

  /* ------------ Loading / Error ----------------------------------- */
  if (loading && !robots.length)
    return (
      <div className="flex-1 overflow-auto bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <span className="ml-3 text-gray-600">Loading robots…</span>
      </div>
    );
  
  if (error && !robots.length)
    return (
      <div className="flex-1 overflow-auto bg-gray-50 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center gap-3 text-red-800 mb-3">
            <AlertCircle size={24} />
            <span className="font-semibold">Error loading robots</span>
          </div>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchRobots}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );

  /* ------------ UI ------------------------------------------------ */
  return (
    <div className="flex-1 overflow-auto bg-gray-50 flex flex-col md:flex-row">
      {/* LEFT: Robot Grid */}
      <div className="flex-1 p-4 lg:p-6">
        {/* Search + filters */}
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <input
              value={robotFilter}
              onChange={(e) => setRobotFilter(e.target.value)}
              placeholder="Search robots…"
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchRobots}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 text-sm"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
            <button
              onClick={() => setShowAddRobot(true)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Robot
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {filteredRobots.map((robot) => (
            <div
              key={robot.id}
              onClick={() => handleRobotClick(robot)}
              className={`bg-white rounded-lg border ${
                selectedRobot?.id === robot.id ? "ring-2 ring-blue-500" : ""
              } p-3 hover:shadow-lg transition-shadow cursor-pointer flex flex-col`}
            >
              <div className="bg-gray-100 rounded-lg mb-3 flex items-center justify-center h-32">
                <img
                  src={getRobotImage(robot.model)}
                  alt={robot.model}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <h3 className="font-bold text-center">{robot.name}</h3>
              <p className="text-xs text-gray-600 text-center mb-2">
                {robot.model} · {robot.location}
              </p>
              <div className="flex items-center justify-center gap-3 text-xs">
                <span
                  className={`px-2 py-0.5 rounded-full border ${getStatusBadge(
                    robot.status
                  )}`}
                >
                  {robot.status}
                </span>
                <span className="flex items-center gap-1">
                  <Battery className="w-3 h-3 text-green-500" />
                  {robot.battery}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT: Detail Panel */}
      {selectedRobot && (
        <div className="w-full md:w-96 bg-white border-l border-gray-200 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                className="md:hidden"
                onClick={() => setSelectedRobot(null)}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <span className="font-semibold">{selectedRobot.name}</span>
            </div>
            <button
              onClick={() => setSelectedRobot(null)}
              className="md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {detailView === "summary" && (
              <>
                <div>
                  <label className="text-xs text-gray-500">Model</label>
                  <p className="font-medium">{selectedRobot.model}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Serial</label>
                  <p className="font-medium">{selectedRobot.sn || "—"}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">IP</label>
                  <p className="font-medium">{selectedRobot.ipAddress}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Status</label>
                  <p
                    className={`inline-block px-2 py-0.5 rounded-full border text-xs ${getStatusBadge(
                      selectedRobot.status
                    )}`}
                  >
                    {selectedRobot.status}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Battery</label>
                  <p className="font-medium">{selectedRobot.battery}%</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Location</label>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {selectedRobot.location}
                  </p>
                </div>

                <div className="pt-3 border-t border-gray-100 space-y-2">
                  {/* Robot Control Button */}
                  <button
                    onClick={() => setShowControlModal(true)}
                    className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 flex items-center justify-center gap-2"
                  >
                    <Gamepad2 className="w-4 h-4" />
                    Robot Control
                  </button>

                  <button
                    onClick={handleMoveToCharge}
                    className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                  >
                    Move to Charge
                  </button>
                  {pois.length > 0 && (
                    <select
                      className="w-full border rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onChange={(e) =>
                        e.target.value && handleMoveToPOI(e.target.value)
                      }
                      defaultValue=""
                    >
                      <option value="">Move to POI…</option>
                      {pois.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setDetailView("details")}
                    className="flex-1 border py-2 rounded hover:bg-gray-50"
                  >
                    Details
                  </button>
                  <button
                    onClick={() => setDetailView("health")}
                    className="flex-1 border py-2 rounded hover:bg-gray-50"
                  >
                    Health
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowRemoveConfirm(true)}
                    className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700 inline-flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </button>
                </div>
              </>
            )}

            {detailView === "details" && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setDetailView("summary")}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    ← Back
                  </button>
                </div>
                <h3 className="font-semibold mb-2">Details</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">Model</span>
                    <p>{selectedRobot.model}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Description</span>
                    <p>{selectedRobot.description || "—"}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">MAC</span>
                    <p>{selectedRobot.macAddress}</p>
                  </div>
                </div>
              </>
            )}

            {detailView === "health" && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setDetailView("summary")}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    ← Back
                  </button>
                </div>
                <h3 className="font-semibold mb-2">Health</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-3 p-2 bg-green-50 rounded">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium">Heartbeat</p>
                      <p className="text-xs text-gray-600">
                        {selectedRobot.status}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-2 bg-green-50 rounded">
                    <Battery className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium">Battery</p>
                      <p className="text-xs text-gray-600">
                        {selectedRobot.battery}% healthy
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-2 bg-green-50 rounded">
                    <Wifi className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium">Connectivity</p>
                      <p className="text-xs text-gray-600">
                        {selectedRobot.connectivity}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-2 bg-green-50 rounded">
                    <Activity className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="font-medium">Sensors</p>
                      <p className="text-xs text-gray-600">All active</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Modals */}
      {/* ------------------------------------------------------------------ */}
      
      {/* Add Robot Modal */}
      {showAddRobot && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Add Robot</h2>
              <button onClick={() => setShowAddRobot(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                value={newRobotForm.name}
                onChange={(e) =>
                  setNewRobotForm({ ...newRobotForm, name: e.target.value })
                }
                placeholder="Name"
                className="w-full border rounded px-3 py-2"
              />
              <input
                value={newRobotForm.nickname}
                onChange={(e) =>
                  setNewRobotForm({
                    ...newRobotForm,
                    nickname: e.target.value,
                  })
                }
                placeholder="Nickname"
                className="w-full border rounded px-3 py-2"
              />
              <input
                value={newRobotForm.sn}
                onChange={(e) =>
                  setNewRobotForm({ ...newRobotForm, sn: e.target.value })
                }
                placeholder="Serial Number"
                className="w-full border rounded px-3 py-2"
              />
              <input
                value={newRobotForm.ip}
                onChange={(e) =>
                  setNewRobotForm({ ...newRobotForm, ip: e.target.value })
                }
                placeholder="IP Address"
                className="w-full border rounded px-3 py-2"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Robot Model
                </label>
                <select
                  value={newRobotForm.model}
                  onChange={(e) =>
                    setNewRobotForm({ ...newRobotForm, model: e.target.value })
                  }
                  className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="AMR">AMR</option>
                  <option value="FIELDER">Fielder</option>
                  <option value="TEMI">Temi</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowAddRobot(false)}
                className="flex-1 border py-2 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRobot}
                disabled={
                  loading ||
                  !newRobotForm.name ||
                  !newRobotForm.nickname ||
                  !newRobotForm.sn ||
                  !newRobotForm.ip
                }
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirm Modal */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h2 className="text-lg font-bold mb-2">Confirm Removal</h2>
            <p className="text-sm text-gray-600 mb-4">
              Remove {selectedRobot?.name}?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowRemoveConfirm(false)}
                className="flex-1 border py-2 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRobot}
                className="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Robot Control Modal */}
      {showControlModal && selectedRobot && selectedRobot.sn && (
        <RobotControlModal
          robot={{
            id: selectedRobot.id,
            name: selectedRobot.name,
            sn: selectedRobot.sn,
            model: selectedRobot.model,
            status: selectedRobot.status,
          }}
          onClose={() => setShowControlModal(false)}
          onSuccess={fetchRobots}
        />
      )}
    </div>
  );
};

export default RobotManagement;