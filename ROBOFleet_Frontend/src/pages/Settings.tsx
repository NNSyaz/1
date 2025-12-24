// src/pages/Settings.tsx
import React, { useState, useEffect } from "react";
import { Save, CheckCircle, AlertTriangle, Settings as SettingsIcon } from "lucide-react";
import api from "../services/api";
import toast from "react-hot-toast";

const Settings: React.FC = () => {
  const [apiUrl, setApiUrl] = useState(
    localStorage.getItem("api_base_url") || "http://192.168.0.183:8000"
  );
  const [batteryWarning, setBatteryWarning] = useState(
    parseInt(localStorage.getItem("battery_warning") || "30")
  );
  const [batteryCritical, setBatteryCritical] = useState(
    parseInt(localStorage.getItem("battery_critical") || "15")
  );
  const [offlineTimeout, setOfflineTimeout] = useState(
    parseInt(localStorage.getItem("offline_timeout") || "30")
  );
  const [browserNotifications, setBrowserNotifications] = useState(
    localStorage.getItem("browser_notifications") !== "false"
  );
  const [soundAlerts, setSoundAlerts] = useState(
    localStorage.getItem("sound_alerts") === "true"
  );
  const [apiStatus, setApiStatus] = useState<{
    connected: boolean;
    message: string;
  }>({ connected: false, message: "Checking..." });
  const [totalRobots, setTotalRobots] = useState(0);

  useEffect(() => {
    checkApiStatus();
    fetchRobotCount();
  }, []);

  const checkApiStatus = async () => {
    try {
      const isHealthy = await api.checkHealth();
      setApiStatus({
        connected: isHealthy,
        message: isHealthy ? "Connected" : "Disconnected",
      });
    } catch {
      setApiStatus({ connected: false, message: "Disconnected" });
    }
  };

  const fetchRobotCount = async () => {
    try {
      const robots = await api.getRegisteredRobots();
      setTotalRobots(robots.length);
    } catch {
      setTotalRobots(0);
    }
  };

  const saveApiUrl = () => {
    localStorage.setItem("api_base_url", apiUrl);
    toast.success("API URL updated. Please refresh to apply changes.");
  };

  const saveThresholds = () => {
    localStorage.setItem("battery_warning", batteryWarning.toString());
    localStorage.setItem("battery_critical", batteryCritical.toString());
    localStorage.setItem("offline_timeout", offlineTimeout.toString());
    toast.success("Alert thresholds saved successfully");
  };

  const saveNotifications = () => {
    localStorage.setItem("browser_notifications", browserNotifications.toString());
    localStorage.setItem("sound_alerts", soundAlerts.toString());

    if (browserNotifications && Notification.permission === "default") {
      Notification.requestPermission();
    }

    toast.success("Notification settings saved");
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Configure system preferences and thresholds</p>
        </div>

        <div className="space-y-6">
          {/* API Configuration */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-3 mb-4">
              <SettingsIcon className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">API Configuration</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Backend API URL
                </label>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="http://192.168.0.183:8000"
                />
              </div>
              <button
                onClick={saveApiUrl}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Save className="w-4 h-4" />
                Save Configuration
                </button>
                </div>
                </div>
                {/* Alert Thresholds */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-yellow-600" />
          <h2 className="text-lg font-semibold text-gray-900">Alert Thresholds</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Low Battery Warning (%)
            </label>
            <input
              type="number"
              value={batteryWarning}
              onChange={(e) => setBatteryWarning(parseInt(e.target.value))}
              min="0"
              max="100"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Critical Battery Alert (%)
            </label>
            <input
              type="number"
              value={batteryCritical}
              onChange={(e) => setBatteryCritical(parseInt(e.target.value))}
              min="0"
              max="100"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Offline Timeout (seconds)
            </label>
            <input
              type="number"
              value={offlineTimeout}
              onChange={(e) => setOfflineTimeout(parseInt(e.target.value))}
              min="10"
              max="300"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={saveThresholds}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Save className="w-4 h-4" />
            Save Thresholds
          </button>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
        </div>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={browserNotifications}
              onChange={(e) => setBrowserNotifications(e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Browser Notifications</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={soundAlerts}
              onChange={(e) => setSoundAlerts(e.target.checked)}
              className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">Sound Alerts</span>
          </label>
          <button
            onClick={saveNotifications}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Save className="w-4 h-4" />
            Save Settings
          </button>
        </div>
      </div>

      {/* System Information */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">System Information</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-3 border-b border-gray-100">
            <span className="text-sm text-gray-600">Version</span>
            <span className="text-sm font-medium text-gray-900">2.0.0</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-100">
            <span className="text-sm text-gray-600">API Status</span>
            <span
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${
                apiStatus.connected
                  ? "bg-green-100 text-green-700 border-green-200"
                  : "bg-red-100 text-red-700 border-red-200"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-current" />
              {apiStatus.message}
            </span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-gray-100">
            <span className="text-sm text-gray-600">Total Robots</span>
            <span className="text-sm font-medium text-gray-900">{totalRobots}</span>
          </div>
          <div className="flex justify-between items-center py-3">
            <span className="text-sm text-gray-600">Active Sessions</span>
            <span className="text-sm font-medium text-gray-900">1</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
);
};

export default Settings;