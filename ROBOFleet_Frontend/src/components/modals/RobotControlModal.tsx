// src/components/modals/RobotControlModal.tsx - UPDATED WITH DYNAMIC LOCATION LOADING
import React, { useState, useEffect, useRef } from "react";
import { X, MapPin, RefreshCw, Save, AlertTriangle } from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { manualControl } from "../../services/manualControl";

interface RobotControlModalProps {
  robot: {
    id: string;
    name: string;
    sn: string;
    model: string;
    status: string;
  };
  onClose: () => void;
  onSuccess?: () => void;
}

const RobotControlModal: React.FC<RobotControlModalProps> = ({
  robot,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<"navigation" | "manual" | "tts">("navigation");
  
  // ✅ NEW: Separate state for robot-fetched locations and POIs
  const [robotLocations, setRobotLocations] = useState<any[]>([]);
  const [allPOIs, setAllPOIs] = useState<any[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  
  const [selectedPoi, setSelectedPoi] = useState("");
  const [speed, setSpeed] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState<any>(null);
  const [ttsText, setTtsText] = useState("");
  
  // Manual control state
  const [manualActive, setManualActive] = useState(false);
  const [linearSpeed, setLinearSpeed] = useState(0.5);
  const [angularSpeed, setAngularSpeed] = useState(0.5);
  const [currentLinear, setCurrentLinear] = useState(0);
  const [currentAngular, setCurrentAngular] = useState(0);
  
  const keysPressed = useRef<Set<string>>(new Set());
  const isTemi = robot.model?.toUpperCase() === "TEMI";

  // ✅ Load locations from robot on mount
  useEffect(() => {
    loadRobotLocations();
    loadPosition();
    const interval = setInterval(loadPosition, 3000);
    return () => clearInterval(interval);
  }, [robot.sn, robot.model]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (manualActive) {
        stopManualControl();
      }
    };
  }, [manualActive]);

  /**
   * ✅ NEW: Load locations dynamically from robot
   * - For Temi: Fetch saved locations from Temi robot itself
   * - For Fielder: Load POIs from MongoDB
   */
  const loadRobotLocations = async () => {
    try {
      setLoadingLocations(true);
      
      if (isTemi) {
        // ✅ Get Temi's saved locations from the robot
        console.log(`📍 Loading Temi locations for ${robot.sn}...`);
        const temiLocs = await api.getTemiLocations(robot.sn);
        
        setRobotLocations(temiLocs);
        console.log(`✅ Loaded ${temiLocs.length} Temi locations:`, temiLocs);
        
        if (temiLocs.length === 0) {
          toast.error("No saved locations found on Temi robot");
        }
      } else {
        // ✅ Get Fielder/AMR POIs from database
        console.log(`📍 Loading Fielder/AMR locations...`);
        const fielderLocs = await api.getFielderLocations();
        
        setRobotLocations(fielderLocs);
        console.log(`✅ Loaded ${fielderLocs.length} Fielder locations:`, fielderLocs);
        
        if (fielderLocs.length === 0) {
          toast.error("No POIs found in database");
        }
      }
      
      // Also load all POIs for reference
      try {
        const allPOIs = await api.getPOIList();
        setAllPOIs(allPOIs);
      } catch (error) {
        console.warn("Could not load POI list:", error);
      }
      
    } catch (error: any) {
      console.error("Failed to load robot locations:", error);
      toast.error(`Failed to load locations: ${error.message}`);
      setRobotLocations([]);
    } finally {
      setLoadingLocations(false);
    }
  };

  const loadPosition = async () => {
    try {
      const status = await api.getRobotStatus(robot.sn);
      if (status?.position) {
        setPosition(status.position);
      } else if (status?.robotStatus?.position) {
        setPosition(status.robotStatus.position);
      }
    } catch (error) {
      console.error("Failed to load position:", error);
    }
  };

  const handleGoToLocation = async () => {
    if (!selectedPoi) {
      toast.error("Please select a location");
      return;
    }
    
    try {
      setLoading(true);
      const result = await api.moveToPOI(robot.sn, selectedPoi, robot.model);
      
      if (result.status === 200) {
        toast.success(`✅ Moving to ${selectedPoi}`);
        if (onSuccess) onSuccess();
      } else {
        toast.error(result.msg || "Failed to move");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to navigate");
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    try {
      if (isTemi) {
        await api.stopTemi(robot.sn);
      } else {
        await api.cancelTask();
      }
      toast.success("Robot stopped");
    } catch (error: any) {
      toast.error(error.message || "Failed to stop");
    }
  };

  const handleSpeak = async () => {
    if (!ttsText || !isTemi) {
      if (!isTemi) toast.error("TTS only for Temi");
      return;
    }
    
    try {
      setLoading(true);
      const result = await api.makeTemiSpeak(robot.sn, ttsText);
      
      if (result.status === 200) {
        toast.success("✅ Speaking...");
        setTtsText("");
      } else {
        toast.error(result.msg || "Failed");
      }
    } finally {
      setLoading(false);
    }
  };

  // Manual control functions (unchanged from previous version)
  const startManualControl = async () => {
    try {
      setLoading(true);

      if (isTemi) {
        setManualActive(true);
        toast.success("🎮 Manual control active (Temi)");
      } else {
        const started = await manualControl.start();
        
        if (started) {
          setManualActive(true);
          toast.success("🎮 Manual control active (Fielder)");
        } else {
          throw new Error("Failed to start manual control");
        }
      }

      keysPressed.current.clear();
    } catch (error: any) {
      toast.error(`Failed to start control: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const stopManualControl = async () => {
    try {
      setManualActive(false);
      keysPressed.current.clear();
      setCurrentLinear(0);
      setCurrentAngular(0);

      if (isTemi) {
        await api.controlTemiManual(robot.sn, 0, 0);
      } else {
        await manualControl.stop();
      }

      toast.success("Manual control stopped");
    } catch (error: any) {
      console.error("Stop error:", error);
    }
  };

  const handleManualMove = async (linear: number, angular: number) => {
    if (!manualActive) return;

    const finalLinear = linear * linearSpeed;
    const finalAngular = angular * angularSpeed;
    
    setCurrentLinear(finalLinear);
    setCurrentAngular(finalAngular);

    try {
      if (isTemi) {
        await api.controlTemiManual(robot.sn, finalLinear, finalAngular);
      } else {
        manualControl.setVelocities(finalLinear, finalAngular);
      }
    } catch (error) {
      console.error("Control command error:", error);
    }
  };

  const handleManualStop = async () => {
    keysPressed.current.clear();
    setCurrentLinear(0);
    setCurrentAngular(0);

    try {
      if (isTemi) {
        await api.controlTemiManual(robot.sn, 0, 0);
      } else {
        manualControl.setVelocities(0, 0);
      }
    } catch (error) {
      console.error("Stop command error:", error);
    }
  };

  const updateMovementFromKeys = () => {
    let linear = 0;
    let angular = 0;

    if (keysPressed.current.has("w") || keysPressed.current.has("arrowup")) {
      linear += 1;
    }
    if (keysPressed.current.has("s") || keysPressed.current.has("arrowdown")) {
      linear -= 1;
    }
    if (keysPressed.current.has("a") || keysPressed.current.has("arrowleft")) {
      angular += 1;
    }
    if (keysPressed.current.has("d") || keysPressed.current.has("arrowright")) {
      angular -= 1;
    }

    handleManualMove(linear, angular);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!manualActive) return;
    
    const key = e.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      e.preventDefault();
      keysPressed.current.add(key);
      updateMovementFromKeys();
    }
    if (e.key === " ") {
      e.preventDefault();
      handleManualStop();
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (!manualActive) return;
    
    const key = e.key.toLowerCase();
    keysPressed.current.delete(key);
    updateMovementFromKeys();
  };

  useEffect(() => {
    if (manualActive) {
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
      };
    }
  }, [manualActive, linearSpeed, angularSpeed]);

  const handleSaveAsPOI = async () => {
    if (!position) {
      toast.error("No position data");
      return;
    }
    
    const poiName = prompt(`Save as POI?\nX: ${position.x?.toFixed(3)}\nY: ${position.y?.toFixed(3)}\n\nEnter name:`);
    if (!poiName) return;
    
    try {
      setLoading(true);
      const result = await api.setPOI(poiName, robot.sn, position);
      
      if (result.status === 200) {
        toast.success(`✅ POI "${poiName}" saved!`);
        await loadRobotLocations(); // Reload locations
      } else {
        toast.error(result.msg || "Failed to save");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMoveToCharge = async () => {
    try {
      setLoading(true);
      const result = await api.moveToCharge(robot.sn, robot.model);
      
      if (result.status === 200) {
        toast.success(`✅ Moving to ${isTemi ? "home base" : "origin"}`);
        if (onSuccess) onSuccess();
      } else {
        toast.error(result.msg || "Charging location not found");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">🎮 Robot Control</h2>
              <p className="text-sm text-gray-500 mt-1">
                {robot.name} ({robot.model})
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Robot Info */}
        <div className="p-6 bg-gray-50 border-b border-gray-100">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-600">Robot</div>
              <div className="font-semibold text-gray-900">{robot.name}</div>
            </div>
            <div>
              <div className="text-gray-600">Serial</div>
              <div className="font-mono text-gray-900">{robot.sn}</div>
            </div>
            <div>
              <div className="text-gray-600">Type</div>
              <div className="font-semibold text-gray-900">{robot.model}</div>
            </div>
          </div>
        </div>

        {/* Position Display */}
        {position && (
          <div className="p-6 bg-blue-50 border-b border-blue-100">
            <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Current Position
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-blue-700">X Position</div>
                <div className="font-mono text-lg font-bold text-blue-900">
                  {position.x?.toFixed(3)} m
                </div>
              </div>
              <div>
                <div className="text-xs text-blue-700">Y Position</div>
                <div className="font-mono text-lg font-bold text-blue-900">
                  {position.y?.toFixed(3)} m
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Control Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab("navigation")}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "navigation"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            📍 Navigation
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "manual"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            🕹️ Manual Control
          </button>
          {isTemi && (
            <button
              onClick={() => setActiveTab("tts")}
              className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === "tts"
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              💬 Text-to-Speech
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === "navigation" && (
            <div className="space-y-4">
              {/* ✅ NEW: Location Info Banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-800 mb-2">
                  <MapPin className="w-5 h-5" />
                  <span className="font-semibold">
                    {isTemi ? "Temi Saved Locations" : "Available POIs"}
                  </span>
                </div>
                <p className="text-sm text-blue-700">
                  {isTemi
                    ? "Locations are fetched from the Temi robot's saved locations"
                    : "Locations are loaded from the database POI list"}
                </p>
                {loadingLocations && (
                  <div className="mt-2 flex items-center gap-2 text-blue-600">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Loading locations...</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Location ({robotLocations.length} available)
                  <button
                    onClick={loadRobotLocations}
                    className="ml-2 text-blue-600 hover:text-blue-700 text-xs"
                    disabled={loadingLocations}
                  >
                    <RefreshCw className={`w-3 h-3 inline ${loadingLocations ? "animate-spin" : ""}`} />
                  </button>
                </label>
                <select
                  value={selectedPoi}
                  onChange={(e) => setSelectedPoi(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loadingLocations || robotLocations.length === 0}
                >
                  <option value="">
                    {loadingLocations
                      ? "Loading..."
                      : robotLocations.length === 0
                      ? "No locations available"
                      : "Choose location..."}
                  </option>
                  {robotLocations.map((loc) => (
                    <option key={loc.value || loc.name} value={loc.value || loc.name}>
                      {loc.name}
                    </option>
                  ))}
                </select>
                {robotLocations.length === 0 && !loadingLocations && (
                  <p className="mt-2 text-sm text-orange-600">
                    ⚠️ {isTemi
                      ? "No saved locations found on Temi. Save locations using the Temi tablet."
                      : "No POIs found. Add POIs in the database first."}
                  </p>
                )}
              </div>

              {isTemi && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Speed: {speed.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.1"
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleGoToLocation}
                  disabled={loading || !selectedPoi || loadingLocations}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Moving..." : "▶️ Go"}
                </button>
                <button
                  onClick={handleStop}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  ⏹️ Stop
                </button>
              </div>

              <button
                onClick={handleMoveToCharge}
                disabled={loading}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                🔋 Move to Charge ({isTemi ? "home base" : "origin"})
              </button>
            </div>
          )}

          {activeTab === "manual" && (
            <div className="space-y-4">
              {!isTemi && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-yellow-800 mb-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-semibold">Remote Control Mode Required</span>
                  </div>
                  <p className="text-sm text-yellow-700">
                    The robot must be in <strong>remote control mode</strong> to accept manual commands. 
                    Clicking "Start Control" will automatically enable remote mode.
                  </p>
                </div>
              )}
              
              <div className={`p-4 rounded-lg border-2 ${
                manualActive 
                  ? "bg-green-50 border-green-500" 
                  : "bg-gray-50 border-gray-300"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">
                    {manualActive ? "🎮 Manual Control Active" : "⏸️ Manual Control Inactive"}
                  </span>
                  {manualActive && (
                    <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-full animate-pulse">
                      LIVE
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  {manualActive 
                    ? "Use WASD or Arrow keys to control. Press SPACE to stop."
                    : "Click 'Start Control' to begin"
                  }
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Linear Speed: {linearSpeed.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.1"
                    value={linearSpeed}
                    onChange={(e) => setLinearSpeed(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Angular Speed: {angularSpeed.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.1"
                    value={angularSpeed}
                    onChange={(e) => setAngularSpeed(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-2">Current Command:</div>
                <div className="font-mono text-sm">
                  Linear: {currentLinear.toFixed(2)} m/s<br />
                  Angular: {currentAngular.toFixed(2)} rad/s
                </div>
              </div>

              {/* Virtual D-Pad */}
              <div className="grid grid-cols-3 gap-2">
                <div></div>
                <button
                  onMouseDown={() => handleManualMove(1, 0)}
                  onMouseUp={handleManualStop}
                  onTouchStart={() => handleManualMove(1, 0)}
                  onTouchEnd={handleManualStop}
                  disabled={!manualActive}
                  className="p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 disabled:opacity-50"
                >
                  ⬆️ Forward
                </button>
                <div></div>
                
                <button
                  onMouseDown={() => handleManualMove(0, 1)}
                  onMouseUp={handleManualStop}
                  onTouchStart={() => handleManualMove(0, 1)}
                  onTouchEnd={handleManualStop}
                  disabled={!manualActive}
                  className="p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
                >
                  ⬅️ Left
                </button>
                <button
                  onClick={handleManualStop}
                  disabled={!manualActive}
                  className="p-4 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xl font-bold disabled:opacity-50"
                >
                  ⏹️ STOP
                </button>
                <button
                  onMouseDown={() => handleManualMove(0, -1)}
                  onMouseUp={handleManualStop}
                  onTouchStart={() => handleManualMove(0, -1)}
                  onTouchEnd={handleManualStop}
                  disabled={!manualActive}
                  className="p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
                >
                  ➡️ Right
                </button>
                
                <div></div>
                <button
                  onMouseDown={() => handleManualMove(-1, 0)}
                  onMouseUp={handleManualStop}
                  onTouchStart={() => handleManualMove(-1, 0)}
                  onTouchEnd={handleManualStop}
                  disabled={!manualActive}
                  className="p-4 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 active:bg-yellow-800 disabled:opacity-50"
                >
                  ⬇️ Backward
                </button>
                <div></div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>⌨️ Keyboard Controls:</strong><br />
                  W/↑ - Forward | S/↓ - Backward | A/← - Left | D/→ - Right | SPACE - Emergency Stop
                </p>
              </div>

              <div className="flex gap-2">
                {!manualActive ? (
                  <button
                    onClick={startManualControl}
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? "Starting..." : "▶️ Start Control"}
                  </button>
                ) : (
                  <button
                    onClick={stopManualControl}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    ⏹️ Stop Control
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === "tts" && isTemi && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Text to Speak
                </label>
                <textarea
                  value={ttsText}
                  onChange={(e) => setTtsText(e.target.value)}
                  placeholder="Enter text for robot to speak..."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleSpeak}
                disabled={loading || !ttsText}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Speaking..." : "🔊 Speak"}
              </button>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="p-6 border-t border-gray-100 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">⚙️ Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleSaveAsPOI}
              disabled={loading || !position}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Save as POI
            </button>
            <button
              onClick={loadPosition}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RobotControlModal;