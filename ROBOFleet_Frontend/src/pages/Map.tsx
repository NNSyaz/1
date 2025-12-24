// src/pages/Map.tsx
import React, { useState, useEffect, useRef } from "react";
import { RefreshCw, MapPin, Navigation } from "lucide-react";
import api from "../services/api";

interface Robot {
  id: string;
  name: string;
  position: { x: number; y: number; yaw: number };
  online: boolean;
  location: string;
}

interface POI {
  name: string;
  data: {
    target_x: number;
    target_y: number;
  };
}

const Map: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [robots, setRobots] = useState<Robot[]>([]);
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [robotsData, poisData] = await Promise.all([
        api.getRegisteredRobots(),
        api.getPOIList(),
      ]);

      const enrichedRobots = await Promise.all(
        robotsData.map(async (r: any) => {
          try {
            const status = await api.getRobotStatus(r.data.sn);
            const location = await api.getRobotLocation(r.data.sn);

            return {
              id: r.data.sn,
              name: r.nickname,
              position: {
                x: location?.x || 0,
                y: location?.y || 0,
                yaw: location?.ori || 0,
              },
              online: status?.robotStatus?.state >= 2,
              location: status?.last_poi || "Unknown",
            };
          } catch {
            return {
              id: r.data.sn,
              name: r.nickname,
              position: { x: 0, y: 0, yaw: 0 },
              online: false,
              location: "Unknown",
            };
          }
        })
      );

      setRobots(enrichedRobots.filter((r) => r.position.x !== 0 || r.position.y !== 0));
      setPois(poisData);
    } catch (error) {
      console.error("Failed to fetch map data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!canvasRef.current || loading) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Clear canvas
    ctx.fillStyle = "#0A0E1A";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = "rgba(0, 229, 255, 0.1)";
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw coordinate axes
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(canvas.width, centerY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, canvas.height);
    ctx.stroke();

    // Draw origin
    ctx.fillStyle = "#FF3D00";
    ctx.beginPath();
    ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("(0, 0)", centerX + 10, centerY - 10);

    const scale = 30; // pixels per meter
    const offsetX = canvas.width / 2;
    const offsetY = canvas.height / 2;

    // Draw POIs
    pois.forEach((poi) => {
      if (poi.data) {
        const x = offsetX + poi.data.target_x * scale;
        const y = offsetY - poi.data.target_y * scale;

        ctx.fillStyle = "#00E5FF";
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        const textWidth = ctx.measureText(poi.name).width;
        ctx.fillRect(x + 10, y - 18, textWidth + 8, 20);

        ctx.fillStyle = "#00E5FF";
        ctx.font = "12px sans-serif";
        ctx.fillText(poi.name, x + 14, y - 5);
      }
    });

    // Draw robots
    robots.forEach((robot) => {
      const x = offsetX + robot.position.x * scale;
      const y = offsetY - robot.position.y * scale;

      ctx.fillStyle = robot.online ? "#00FF88" : "#FF3D5C";
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Direction indicator
      ctx.strokeStyle = robot.online ? "#00FF88" : "#FF3D5C";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(
        x + Math.cos(robot.position.yaw) * 20,
        y - Math.sin(robot.position.yaw) * 20
      );
      ctx.stroke();

      // Robot label
      ctx.font = "bold 14px sans-serif";
      const nameWidth = ctx.measureText(robot.name).width;

      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.fillRect(x + 14, y - 28, nameWidth + 8, 22);

      ctx.fillStyle = robot.online ? "#00FF88" : "#FF3D5C";
      ctx.fillText(robot.name, x + 18, y - 12);
    });

    // Scale reference
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "12px sans-serif";
    ctx.fillText(`Scale: ${scale}px = 1m`, 20, canvas.height - 20);
  }, [robots, pois, loading]);

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fleet Map</h1>
            <p className="text-sm text-gray-500 mt-1">Real-time robot positions and POIs</p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <canvas ref={canvasRef} className="w-full h-[600px] rounded-lg" />
        </div>

        {/* Legend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Legend</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-green-500" />
              <span className="text-sm text-gray-700">Online Robots</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-red-500" />
              <span className="text-sm text-gray-700">Offline Robots</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-cyan-500" />
              <span className="text-sm text-gray-700">POI Locations</span>
            </div>
          </div>

          {robots.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Active Robots</h4>
              <div className="space-y-2">
                {robots.map((robot) => (
                  <div
                    key={robot.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          robot.online ? "bg-green-500" : "bg-red-500"
                        }`}
                      />
                      <span className="font-medium text-gray-900">{robot.name}</span>
                    </div>
                    <div className="text-sm text-gray-600 font-mono">
                      ({robot.position.x.toFixed(2)}, {robot.position.y.toFixed(2)})
                    </div>
                    <span className="text-sm text-gray-500">{robot.location}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Map;