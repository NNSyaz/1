// src/components/modals/RobotControlModal.tsx - FIXED VERSION
import React, { useState, useEffect, useRef } from "react";
import { X, MapPin, RefreshCw, Save } from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";

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
  const [allPOIs, setAllPOIs] = useState<any[]>([]);
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
  
  // Keyboard control refs
  const keysPressed = useRef<Set<string>>(new Set());
  const lastCommandTime = useRef<number>(0);
  
  const isTemi = robot.model?.toUpperCase() === "TEMI";
  
  // Keyboard control implementation
  const sendControlCommand = async (linear: number, angular: number) => {
    const now = Date.now();
    if (now - lastCommandTime.current < 100) {
      return;
    }
    lastCommandTime.current = now;
    
    try {
      if (isTemi) {
        await api.controlTemiManual(robot.sn, linear, angular);
      } else {
        // ✅ FIX: Use correct endpoint for AMR/Fielder
        await fetch('http://192.168.0.183:8000/api/v1/robot/control/manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            linear_velocity: linear, 
            angular_velocity: angular 
          })
        });
      }
    } catch (error) {
      console.error("Control command error:", error);
    }
  };
  
  const updateMovement = () => {
    let linear = 0;
    let angular = 0;
    
    if (keysPressed.current.has("w") || keysPressed.current.has("arrowup")) {
      linear += linearSpeed;
    }
    if (keysPressed.current.has("s") || keysPressed.current.has("arrowdown")) {
      linear -= linearSpeed;
    }
    if (keysPressed.current.has("a") || keysPressed.current.has("arrowleft")) {
      angular += angularSpeed;
    }
    if (keysPressed.current.has("d") || keysPressed.current.has("arrowright")) {
      angular -= angularSpeed;
    }
    
    setCurrentLinear(linear);
    setCurrentAngular(angular);
    
    if (manualActive) {
      sendControlCommand(linear, angular);
    }
  };
  
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!manualActive) return;
    
    const key = e.key.toLowerCase();
    if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      e.preventDefault();
      keysPressed.current.add(key);
      updateMovement();
    }
    
    if (e.key === " ") {
      e.preventDefault();
      handleManualStop();
    }
  };
  
  const handleKeyUp = (e: KeyboardEvent) => {
    if (!manualActive) return;
    
    const key = e.key.toLowerCase();
    if (keysPressed.current.has(key)) {
      keysPressed.current.delete(key);
      updateMovement();
    }
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
  
  useEffect(() => {
    loadAllPOIs();
    loadPosition();
    const interval = setInterval(loadPosition, 3000);
    return () => clearInterval(interval);
  }, [robot.sn]);
  
  // Load all POIs from database
  const loadAllPOIs = async () => {
    try {
      const poisData = await api.getPOIList();
      setAllPOIs(poisData);
      console.log("✅ Loaded POIs:", poisData);
    } catch (error) {
      console.error("❌ Failed to load POIs:", error);
      toast.error("Failed to load locations");
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
  
  // ✅ FIX: Handle navigation with proper routing
  const handleGoToLocation = async () => {
    if (!selectedPoi) {
      toast.error("Please select a location");
      return;
    }
    
    try {
      setLoading(true);
      
      if (isTemi) {
        // ✅ Temi: Use Temi goto endpoint
        const response = await fetch('http://192.168.0.183:8000/api/v1/robot/temi/command/goto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sn: robot.sn,
            location: selectedPoi,
            speed: speed
          })
        });
        
        const result = await response.json();
        
        if (result.status === 200) {
          toast.success(`✅ Temi moving to ${selectedPoi}`);
        } else {
          toast.error(result.msg || "Failed to move");
        }
      } else {
        // ✅ Fielder/AMR: Use task dispatcher
        const response = await fetch('http://192.168.0.183:8000/api/v1/task/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task_type: 'goto',
            robot_sn: robot.sn,
            location: selectedPoi
          })
        });
        
        const result = await response.json();
        
        if (result.status === 200) {
          toast.success(`✅ Fielder moving to ${selectedPoi}`);
        } else {
          toast.error(result.msg || "Failed to move");
        }
      }
      
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error("❌ Navigation error:", error);
      toast.error(error.message || "Failed to navigate");
    } finally {
      setLoading(false);
    }
  };
  
  const handleStop = async () => {
    try {
      if (isTemi) {
        // ✅ Temi stop
        await fetch('http://192.168.0.183:8000/api/v1/robot/temi/command/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sn: robot.sn })
        });
      } else {
        // ✅ AMR/Fielder stop
        await fetch('http://192.168.0.183:8000/api/v1/robot/cancel/task', {
          method: 'GET'
        });
      }
      toast.success("Robot stopped");
    } catch (error: any) {
      toast.error(error.message || "Failed to stop");
    }
  };
  
  // ✅ FIX: TTS function with proper endpoint
  const handleSpeak = async () => {
    if (!ttsText || !isTemi) {
      if (!isTemi) {
        toast.error("TTS is only available for Temi robots");
      }
      return;
    }
    
    try {
      setLoading(true);
      
      // ✅ Use correct Temi TTS endpoint
      const response = await fetch('http://192.168.0.183:8000/api/v1/robot/temi/command/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sn: robot.sn,
          text: ttsText,
          show_text: true
        })
      });
      
      const result = await response.json();
      
      if (result.status === 200) {
        toast.success("✅ Speaking...");
        setTtsText("");
      } else {
        toast.error(result.msg || "Failed to speak");
      }
    } catch (error: any) {
      console.error("❌ TTS error:", error);
      toast.error(error.message || "Failed to speak");
    } finally {
      setLoading(false);
    }
  };
  
  const startManualControl = () => {
    setManualActive(true);
    keysPressed.current.clear();
    toast.success("🎮 Manual control active - Use WASD or Arrow keys");
  };
  
  const stopManualControl = async () => {
    setManualActive(false);
    keysPressed.current.clear();
    setCurrentLinear(0);
    setCurrentAngular(0);
    await sendControlCommand(0, 0);
    toast("Manual control stopped");
  };
  
  const handleManualMove = (linear: number, angular: number) => {
    const finalLinear = linear * linearSpeed;
    const finalAngular = angular * angularSpeed;
    setCurrentLinear(finalLinear);
    setCurrentAngular(finalAngular);
    sendControlCommand(finalLinear, finalAngular);
  };
  
  const handleManualStop = () => {
    keysPressed.current.clear();
    setCurrentLinear(0);
    setCurrentAngular(0);
    sendControlCommand(0, 0);
  };
  
  // Save current position as POI
  const handleSaveAsPOI = async () => {
    if (!position) {
      toast.error("No position data available");
      return;
    }
    
    const poiName = prompt(
      `Save current position as POI?\n\nX: ${position.x?.toFixed(3)}\nY: ${position.y?.toFixed(3)}\nYaw: ${(position.yaw || position.ori || 0).toFixed(3)}\n\nEnter location name:`
    );
    
    if (!poiName) return;
    
    try {
      setLoading(true);
      
      // ✅ Use correct POI save endpoint
      const response = await fetch('http://192.168.0.183:8000/api/v1/robot/set/poi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: poiName,
          x: position.x || 0,
          y: position.y || 0,
          ori: position.yaw || position.ori || 0
        })
      });
      
      const result = await response.json();
      
      if (result.status === 200) {
        toast.success(`✅ POI "${poiName}" saved! Available for all robots.`);
        await loadAllPOIs();
      } else {
        toast.error(result.msg || "Failed to save POI");
      }
    } catch (error: any) {
      console.error("❌ Save POI error:", error);
      toast.error(error.message || "Failed to save POI");
    } finally {
      setLoading(false);
    }
  };
  
  // ✅ FIX: Move to charge with correct locations
  const handleMoveToCharge = async () => {
    try {
      setLoading(true);
      
      if (isTemi) {
        // ✅ Temi: Go to "home base"
        const response = await fetch('http://192.168.0.183:8000/api/v1/robot/temi/command/goto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sn: robot.sn,
            location: "home base"
          })
        });
        
        const result = await response.json();
        
        if (result.status === 200) {
          toast.success("✅ Moving to home base");
        } else {
          toast.error("Home base location not found. Please save it first.");
        }
      } else {
        // ✅ Fielder: Go to "origin"
        const response = await fetch('http://192.168.0.183:8000/api/v1/task/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task_type: 'goto',
            robot_sn: robot.sn,
            location: 'origin'
          })
        });
        
        const result = await response.json();
        
        if (result.status === 200) {
          toast.success("✅ Moving to origin");
        } else {
          toast.error("Origin location not found. Please save it first.");
        }
      }
      
      if (onSuccess) onSuccess();
    } catch (error: any) {
      console.error("❌ Move to charge error:", error);
      toast.error(error.message || "Failed to move to charging station");
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
              <div>
                <div className="text-xs text-blue-700">Orientation</div>
                <div className="font-mono text-lg font-bold text-blue-900">
                  {(position.yaw || position.ori || 0)?.toFixed(3)} rad
                </div>
              </div>
              <div>
                <div className="text-xs text-blue-700">Distance from Origin</div>
                <div className="font-mono text-lg font-bold text-blue-900">
                  {Math.sqrt((position.x || 0) ** 2 + (position.y || 0) ** 2).toFixed(2)} m
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target Location ({allPOIs.length} available)
                </label>
                <select
                  value={selectedPoi}
                  onChange={(e) => setSelectedPoi(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose location...</option>
                  {allPOIs.map((poi) => (
                    <option key={poi.name} value={poi.name}>
                      {poi.name} {poi.category ? `(${poi.category})` : ""}
                    </option>
                  ))}
                </select>
                {allPOIs.length === 0 && (
                  <p className="text-xs text-orange-600 mt-1">
                    No saved locations. Save current position to create one.
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
                  disabled={loading || !selectedPoi}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
              
              {/* Charge Button */}
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
              {/* Status Indicator */}
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
              
              {!isTemi && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    ⚠️ <strong>Fielder/AMR:</strong> Enable remote control mode before manual operation
                  </p>
                  <button
                    onClick={async () => {
                      try {
                        await fetch('http://192.168.0.183:8000/api/v1/robot/control/enable_remote', {
                          method: 'POST'
                        });
                        toast.success("Remote control enabled");
                      } catch (err) {
                        toast.error("Failed to enable remote control");
                      }
                    }}
                    className="mt-2 w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                  >
                    Enable Remote Control
                  </button>
                </div>
              )}
              
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
                  onMouseDown={() => handleManualMove(0.5, 0)}
                  onMouseUp={handleManualStop}
                  onTouchStart={() => handleManualMove(0.5, 0)}
                  onTouchEnd={handleManualStop}
                  disabled={!manualActive}
                  className="p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ⬆️ Forward
                </button>
                <div></div>
                
                <button
                  onMouseDown={() => handleManualMove(0, 0.5)}
                  onMouseUp={handleManualStop}
                  onTouchStart={() => handleManualMove(0, 0.5)}
                  onTouchEnd={handleManualStop}
                  disabled={!manualActive}
                  className="p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ⬅️ Left
                </button>
                <button
                  onClick={handleManualStop}
                  disabled={!manualActive}
                  className="p-4 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ⏹️ STOP
                </button>
                <button
                  onMouseDown={() => handleManualMove(0, -0.5)}
                  onMouseUp={handleManualStop}
                  onTouchStart={() => handleManualMove(0, -0.5)}
                  onTouchEnd={handleManualStop}
                  disabled={!manualActive}
                  className="p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ➡️ Right
                </button>
                
                <div></div>
                <button
                  onMouseDown={() => handleManualMove(-0.5, 0)}
                  onMouseUp={handleManualStop}
                  onTouchStart={() => handleManualMove(-0.5, 0)}
                  onTouchEnd={handleManualStop}
                  disabled={!manualActive}
                  className="p-4 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 active:bg-yellow-800 disabled:opacity-50 disabled:cursor-not-allowed"
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
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    ▶️ Start Control
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
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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