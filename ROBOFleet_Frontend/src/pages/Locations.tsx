// src/pages/Locations.tsx
import React, { useState, useEffect } from "react";
import { MapPin, Navigation, RefreshCw, Target } from "lucide-react";
import api from "../services/api";
import MoveToCoordinateModal from "../components/modals/MoveToCoordinateModal";

interface Location {
  name: string;
  sn: string;
  model: string;
  online: boolean;
  x: number;
  y: number;
  ori: number;
  named_location: string;
  distance: number;
}

const Locations: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const robots = await api.getRegisteredRobots();

      const locationPromises = robots.map(async (r: any) => {
        try {
          const status = await api.getRobotStatus(r.data.sn);
          const location = await api.getRobotLocation(r.data.sn);

          return {
            name: r.nickname,
            sn: r.data.sn,
            model: "AMR",
            online: status?.robotStatus?.state >= 2,
            x: location?.x || 0,
            y: location?.y || 0,
            ori: location?.ori || 0,
            named_location: status?.last_poi || "Unknown",
            distance: Math.sqrt(
              Math.pow(location?.x || 0, 2) + Math.pow(location?.y || 0, 2)
            ),
          };
        } catch {
          return {
            name: r.nickname,
            sn: r.data.sn,
            model: "AMR",
            online: false,
            x: 0,
            y: 0,
            ori: 0,
            named_location: "Unknown",
            distance: 0,
          };
        }
      });

      const locs = await Promise.all(locationPromises);
      setLocations(locs);
    } catch (error) {
      console.error("Failed to fetch locations:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
    const interval = setInterval(fetchLocations, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleMoveToCoordinate = (location: Location) => {
    setSelectedLocation(location);
    setShowMoveModal(true);
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Robot Locations</h1>
            <p className="text-sm text-gray-500 mt-1">Track robot positions and coordinates</p>
          </div>
          <button
            onClick={fetchLocations}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">
                    Robot Name
                  </th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">
                    Type
                  </th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">
                    X Position
                  </th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">
                    Y Position
                  </th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">
                    Orientation
                  </th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">
                    Named Location
                  </th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12">
                      <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
                      <p className="text-gray-500">Loading locations...</p>
                    </td>
                  </tr>
                ) : locations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-500">
                      No robots available
                    </td>
                  </tr>
                ) : (
                  locations.map((loc) => {
                    const xColor = Math.abs(loc.x) > 5 ? "text-yellow-600" : "text-blue-600";
                    const yColor = Math.abs(loc.y) > 5 ? "text-yellow-600" : "text-blue-600";

                    return (
                      <tr key={loc.sn} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-6">
                          <strong className="text-gray-900">{loc.name}</strong>
                        </td>
                        <td className="py-3 px-6">
                          <span className="text-sm font-mono text-gray-600">{loc.sn}</span>
                        </td>
                        <td className="py-3 px-6">
                          <span
                            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${
                              loc.online
                                ? "bg-green-100 text-green-700 border-green-200"
                                : "bg-red-100 text-red-700 border-red-200"
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-current" />
                            {loc.online ? "Online" : "Offline"}
                          </span>
                        </td>
                        <td className="py-3 px-6">
                          <span className={`font-mono font-semibold ${xColor}`}>
                            {loc.x.toFixed(3)} m
                          </span>
                        </td>
                        <td className="py-3 px-6">
                          <span className={`font-mono font-semibold ${yColor}`}>
                            {loc.y.toFixed(3)} m
                          </span>
                        </td>
                        <td className="py-3 px-6">
                          <span className="font-mono font-semibold text-purple-600">
                            {loc.ori.toFixed(3)} rad
                          </span>
                        </td>
                        <td className="py-3 px-6">
                          <div className="flex items-center gap-2 text-green-600">
                            <MapPin className="w-4 h-4" />
                            <span className="font-medium">{loc.named_location}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {loc.distance.toFixed(2)}m from origin
                          </div>
                        </td>
                        <td className="py-3 px-6">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleMoveToCoordinate(loc)}
                              className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                              title="Move to Coordinates"
                            >
                              <Target className="w-4 h-4" />
                            </button>
                            <button
                              className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-colors"
                              title="Show on Map"
                            >
                              <Navigation className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showMoveModal && selectedLocation && (
        <MoveToCoordinateModal
          robotSn={selectedLocation.sn}
          robotName={selectedLocation.name}
          currentX={selectedLocation.x}
          currentY={selectedLocation.y}
          onClose={() => setShowMoveModal(false)}
          onSuccess={() => {
            setShowMoveModal(false);
            fetchLocations();
          }}
        />
      )}
    </div>
  );
};

export default Locations;