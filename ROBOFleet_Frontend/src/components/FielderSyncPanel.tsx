// src/components/FielderSyncPanel.tsx
/**
 * Fielder Waypoint Sync Panel Component
 * Add this to your Settings page or as a separate page
 */

import React, { useState, useEffect } from "react";
import { 
  RefreshCw, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  MapPin,
  Loader
} from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";

interface Waypoint {
  name: string;
  x: number;
  y: number;
  theta: number;
}

interface SyncResult {
  status: number;
  msg: string;
  map_id?: number;
  map_name?: string;
  total_waypoints?: number;
  synced?: number;
  failed?: number;
  waypoints?: Waypoint[];
}

const FielderSyncPanel: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [robotIp, setRobotIp] = useState("192.168.0.250");
  const [showPreview, setShowPreview] = useState(false);

  // Preview waypoints before syncing
  const handlePreview = async () => {
    try {
      setPreviewLoading(true);
      setShowPreview(false);
      
      console.log("🔍 Previewing Fielder waypoints...");
      const result = await api.getFielderWaypoints(robotIp);
      
      if (result.status === 200 && result.waypoints) {
        setWaypoints(result.waypoints);
        setShowPreview(true);
        toast.success(`Found ${result.waypoints.length} waypoints on robot`);
        console.log("✅ Preview result:", result);
      } else {
        toast.error(result.msg || "No waypoints found");
      }
    } catch (error: any) {
      console.error("Preview error:", error);
      toast.error(`Failed to preview: ${error.message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Sync waypoints to MongoDB
  const handleSync = async () => {
    try {
      setLoading(true);
      setSyncResult(null);
      
      console.log("🔄 Starting Fielder waypoint sync...");
      const result = await api.syncFielderWaypoints(robotIp);
      
      setSyncResult(result);
      
      if (result.status === 200) {
        toast.success(
          `✅ Synced ${result.synced} waypoints successfully!`,
          { duration: 4000 }
        );
        console.log("✅ Sync result:", result);
        
        // Reload preview to show updated data
        if (showPreview) {
          await handlePreview();
        }
      } else if (result.status === 404) {
        toast.error("No waypoints found on Fielder map");
      } else {
        toast.error(result.msg || "Sync failed");
      }
    } catch (error: any) {
      console.error("Sync error:", error);
      toast.error(`Sync failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          🗺️ Fielder Waypoint Sync
        </h2>
        <p className="text-sm text-gray-600">
          Sync saved waypoints from Fielder robot map to MongoDB database
        </p>
      </div>

      {/* Robot IP Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Fielder Robot IP Address
        </label>
        <input
          type="text"
          value={robotIp}
          onChange={(e) => setRobotIp(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="192.168.0.250"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={handlePreview}
          disabled={previewLoading || loading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {previewLoading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              <span>Loading...</span>
            </>
          ) : (
            <>
              <MapPin className="w-4 h-4" />
              <span>Preview Waypoints</span>
            </>
          )}
        </button>

        <button
          onClick={handleSync}
          disabled={loading || previewLoading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              <span>Syncing...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Sync to Database</span>
            </>
          )}
        </button>
      </div>

      {/* Sync Result */}
      {syncResult && (
        <div
          className={`mb-6 p-4 rounded-lg border ${
            syncResult.status === 200
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {syncResult.status === 200 ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <span
              className={`font-semibold ${
                syncResult.status === 200 ? "text-green-900" : "text-red-900"
              }`}
            >
              {syncResult.msg}
            </span>
          </div>

          {syncResult.status === 200 && (
            <div className="text-sm space-y-1 text-green-800">
              <div>Map: {syncResult.map_name} (ID: {syncResult.map_id})</div>
              <div>Total waypoints: {syncResult.total_waypoints}</div>
              <div>✅ Synced: {syncResult.synced}</div>
              {(syncResult.failed ?? 0) > 0 && (
                <div>❌ Failed: {syncResult.failed}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Waypoint Preview */}
      {showPreview && waypoints.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900">
              Waypoints on Robot ({waypoints.length} found)
            </h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-700">
                    Name
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-gray-700">
                    X (m)
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-gray-700">
                    Y (m)
                  </th>
                  <th className="text-right px-4 py-2 font-medium text-gray-700">
                    Θ (rad)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {waypoints.map((wp, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        {wp.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">
                      {wp.x?.toFixed(3) || "0.000"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">
                      {wp.y?.toFixed(3) || "0.000"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">
                      {wp.theta?.toFixed(3) || "0.000"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {showPreview && waypoints.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="font-medium">No waypoints found</p>
          <p className="text-sm mt-1">
            Make sure the Fielder robot has saved waypoints on its map
          </p>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">
          📚 How to use:
        </h4>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>
            Ensure Fielder robot is on and has a map with saved waypoints
          </li>
          <li>Click "Preview Waypoints" to see what will be synced</li>
          <li>
            Click "Sync to Database" to copy waypoints to MongoDB POI
            collection
          </li>
          <li>Waypoints will be available in the navigation dropdown</li>
        </ol>
      </div>

      {/* Technical Info */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-600">
          <strong>Technical:</strong> This fetches waypoint overlays from the
          Fielder robot's active map via <code>/maps/:id/overlays</code>{" "}
          endpoint and stores them in MongoDB's <code>poi</code> collection.
        </p>
      </div>
    </div>
  );
};

export default FielderSyncPanel;