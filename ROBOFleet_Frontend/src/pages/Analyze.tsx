// src/components/Analyze.tsx

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Circle,
  Download,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import api from "../services/api";

// Type definitions
interface Metric {
  label: string;
  value: number;
  unit: string;
  trend: number;
  description: string;
}

interface StatusItem {
  label: string;
  value: number;
  color: string;
}

interface DonutSegment extends StatusItem {
  percentage: string;
  strokeDasharray: string;
  strokeDashoffset: number;
}

interface DonutChartProps {
  segments: DonutSegment[];
  title: string;
  subtitle: string;
}

interface TrendIndicatorProps {
  value: number;
}

interface RobotData {
  uptime: string;
  downtime: string;
  availability: number;
  lastMaintenance: string;
  cycles: number;
}
interface RegisteredRobot {
  data: {
    sn: string;
    ip?: string;
    time_created?: number;
  };
  nickname: string;
  name?: string;
}

const Analyze = () => {
  const [activeTab, setActiveTab] = useState<"fleet" | "tracking">("fleet");
  const [selectedRobot, setSelectedRobot] = useState("RB-001");
  const [dateRange, setDateRange] = useState("This Week");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real data state
  const [robotIds, setRobotIds] = useState<string[]>([]);
  const [totalRobots, setTotalRobots] = useState(0);
  const [activeRobots, setActiveRobots] = useState(0);
  const [avgBattery, setAvgBattery] = useState(0);
  const [realtimeBattery, setRealtimeBattery] = useState<number>(0);
  // Fetch real robot data
  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const registered = await api.getRegisteredRobots();

      if (!registered?.length) {
        setTotalRobots(0);
        setActiveRobots(0);
        setAvgBattery(0);
        setRobotIds([]);
        return;
      }

      // Fetch status for all robots - WITH EXPLICIT TYPE
      const statuses = await Promise.all(
        registered.map(async (r: RegisteredRobot) => {
          try {
            const status = await api.getRobotStatus(r.data.sn);
            return {
              id: r.data.sn,
              name: r.nickname,
              online: status?.robotStatus?.state === 2,
              battery: status?.robotStatus?.power ?? 0,
            };
          } catch (e) {
            return {
              id: r.data.sn,
              name: r.nickname,
              online: false,
              battery: 0,
            };
          }
        })
      );

      setTotalRobots(statuses.length);
      setActiveRobots(statuses.filter((s) => s.online).length);
      setAvgBattery(
        Math.round(
          statuses.reduce((sum, s) => sum + s.battery, 0) / statuses.length
        )
      );
      setRobotIds(statuses.map((s) => s.id));
      setSelectedRobot(statuses[0]?.id || "RB-001");
    } catch (err: any) {
      console.error("Failed to fetch analytics data:", err);
      setError(err.message || "Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
    const interval = setInterval(fetchAnalyticsData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;

    try {
      // Get the first robot's serial number
      if (robotIds.length > 0) {
        ws = api.createRobotStatusWebSocket(robotIds[0]);
        
        // Set up message handler
        ws.onmessage = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            console.log("Robot status:", data.status);
            
            if (data.battery !== undefined) {
              setRealtimeBattery(data.battery);
              setAvgBattery(Math.round(data.battery));
            }
          } catch (e) {
            console.error("Failed to parse WebSocket message:", e);
          }
        };
        
        // Set up error handler
        ws.onerror = (error: Event) => {
          console.error("Robot status WebSocket error:", error);
        };
        
        // Set up close handler
        ws.onclose = () => {
          console.log("WebSocket connection closed");
        };
      }
    } catch (error) {
      console.error("Failed to create robot status WebSocket:", error);
    }

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [robotIds]);  // ✅ Added robotIds dependency

  // Metrics with real data where available
  const metrics: Metric[] = [
    {
      label: "Total Robots",
      value: totalRobots,
      unit: "",
      trend: 0,
      description: "Active fleet size",
    },
    {
      label: "Fleet Uptime",
      value:
        totalRobots > 0 ? Math.round((activeRobots / totalRobots) * 100) : 0,
      unit: "%",
      trend: 2.3,
      description: "Last 7 days",
    },
    {
      label: "Tasks Completed",
      value: 4200,
      unit: "",
      trend: 12.5,
      description: "This month",
    },
    {
      label: "Avg Task Time",
      value: 3.2,
      unit: "min",
      trend: -8.2,
      description: "Per task",
    },
    {
      label: "Battery Usage",
      value: realtimeBattery || avgBattery,
      unit: "%",
      trend: -5.1,
      description: "Average level",
    },
    {
      label: "Total Mileage",
      value: 72,
      unit: "km",
      trend: 15.3,
      description: "This week",
    },
    {
      label: "Active Robots",
      value: activeRobots,
      unit: "",
      trend: 0,
      description: "Currently online",
    },
    {
      label: "Operating Hours",
      value: 2100,
      unit: "hrs",
      trend: 8.7,
      description: "This month",
    },
  ];

  // OEE Trend Over Time data
  const oeeData = [
    { month: "Jan", oee: 75 },
    { month: "Feb", oee: 72 },
    { month: "Mar", oee: 78 },
    { month: "Apr", oee: 76 },
    { month: "May", oee: 80 },
    { month: "Jun", oee: 79 },
    { month: "Jul", oee: 82 },
  ];

  // Availability vs Downtime data
  const availabilityData = [
    { month: "Jan", availability: 85, downtime: 15 },
    { month: "Mar", availability: 80, downtime: 20 },
    { month: "Apr", availability: 82, downtime: 18 },
    { month: "May", availability: 78, downtime: 22 },
    { month: "Jun", availability: 75, downtime: 25 },
    { month: "Jul", availability: 80, downtime: 20 },
  ];

  // Robot Performance data
  const robotPerformanceData = [
    { name: "Robot 1", performance: 95 },
    { name: "Robot 2", performance: 67 },
    { name: "Robot 3", performance: 58 },
  ];

  // Data-driven status breakdown
  const connectionStatus: StatusItem[] = [
    { label: "Online", value: activeRobots, color: "#22c55e" },
    {
      label: "Idle",
      value: Math.max(0, totalRobots - activeRobots),
      color: "#eab308",
    },
    { label: "Charging", value: 0, color: "#ef4444" },
  ];

  const operationalStatus: StatusItem[] = [
    { label: "Working", value: 60, color: "#3b82f6" },
    { label: "Recharging", value: 20, color: "#a855f7" },
    { label: "Maintenance", value: 20, color: "#f97316" },
  ];

  // Robot tracking data (mock for now)
  const robotData: Record<string, RobotData> = {
    "RB-001": {
      uptime: "22h 30m",
      downtime: "1h 30m",
      availability: 94,
      lastMaintenance: "2025-10-09",
      cycles: 45,
    },
    "RB-002": {
      uptime: "18h 40m",
      downtime: "5h 20m",
      availability: 78,
      lastMaintenance: "2025-10-15",
      cycles: 38,
    },
    "RB-003": {
      uptime: "24h 00m",
      downtime: "0h 00m",
      availability: 100,
      lastMaintenance: "2025-10-20",
      cycles: 52,
    },
  };

  const statusHistory = [
    {
      time: "08:00-10:30",
      status: "Active",
      robotId: selectedRobot,
      duration: "2.5h",
      reason: "Delivering",
    },
    {
      time: "10:30-11:00",
      status: "Down",
      robotId: selectedRobot,
      duration: "0.5h",
      reason: "Low Battery",
    },
    {
      time: "11:00-14:30",
      status: "Active",
      robotId: selectedRobot,
      duration: "3.5h",
      reason: "Delivering",
    },
    {
      time: "14:30-15:00",
      status: "Down",
      robotId: selectedRobot,
      duration: "0.5h",
      reason: "Maintenance",
    },
    {
      time: "15:00-20:00",
      status: "Active",
      robotId: selectedRobot,
      duration: "5h",
      reason: "Delivering",
    },
  ];

  // Calculate donut chart segments
  const createDonutSegments = (data: StatusItem[]): DonutSegment[] => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return [];

    const circumference = 2 * Math.PI * 35;
    let offset = 0;

    return data.map((item) => {
      const percentage = (item.value / total) * 100;
      const dashLength = (percentage / 100) * circumference;
      const segment: DonutSegment = {
        ...item,
        percentage: percentage.toFixed(1),
        strokeDasharray: `${dashLength} ${circumference}`,
        strokeDashoffset: -offset,
      };
      offset += dashLength;
      return segment;
    });
  };

  const connectionSegments = createDonutSegments(connectionStatus);
  const operationalSegments = createDonutSegments(operationalStatus);

  const TrendIndicator: React.FC<TrendIndicatorProps> = ({ value }) => {
    if (value > 0) {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <TrendingUp size={14} />
          <span className="text-xs font-medium">+{value}%</span>
        </div>
      );
    } else if (value < 0) {
      return (
        <div className="flex items-center gap-1 text-red-600">
          <TrendingDown size={14} />
          <span className="text-xs font-medium">{value}%</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 text-gray-400">
        <Minus size={14} />
        <span className="text-xs font-medium">0%</span>
      </div>
    );
  };

  const DonutChart: React.FC<DonutChartProps> = ({
    segments,
    title,
    subtitle,
  }) => (
    <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative w-32 h-32 flex-shrink-0">
          <svg viewBox="0 0 100 100" className="transform -rotate-90">
            {segments.map((segment, index) => (
              <circle
                key={index}
                cx="50"
                cy="50"
                r="35"
                fill="none"
                stroke={segment.color}
                strokeWidth="14"
                strokeDasharray={segment.strokeDasharray}
                strokeDashoffset={segment.strokeDashoffset}
                className="transition-all duration-500"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-800">
                {segments.length}
              </div>
              <div className="text-xs text-gray-500">states</div>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-3">
          {segments.map((segment, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Circle
                  size={10}
                  style={{ color: segment.color }}
                  fill="currentColor"
                />
                <span className="text-sm text-gray-700">{segment.label}</span>
              </div>
              <span className="text-sm font-semibold text-gray-800">
                {segment.percentage}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const currentRobotData = robotData[selectedRobot] || robotData["RB-001"];

  if (loading) {
    return (
      <div className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
              <div className="text-lg text-gray-600">Loading analytics...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center gap-3 text-red-800 mb-3">
              <AlertCircle size={24} />
              <span className="font-semibold text-lg">
                Error loading analytics
              </span>
            </div>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={fetchAnalyticsData}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Header with Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab("fleet")}
              className={`pb-3 px-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "fleet"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              Fleet Analytics
            </button>
            <button
              onClick={() => setActiveTab("tracking")}
              className={`pb-3 px-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "tracking"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              Robot Tracking Time
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === "fleet" ? (
          // Fleet Analytics Content
          <>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                Fleet Analytics
              </h2>
              <button
                onClick={fetchAnalyticsData}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                disabled={loading}
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {metrics.map((metric, index) => (
                <div
                  key={index}
                  className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-all cursor-pointer border border-gray-100"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-sm font-medium text-gray-600">
                      {metric.label}
                    </span>
                    <TrendIndicator value={metric.trend} />
                  </div>

                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-3xl font-bold text-gray-900">
                      {metric.value.toLocaleString()}
                    </span>
                    {metric.unit && (
                      <span className="text-lg font-medium text-gray-500">
                        {metric.unit}
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-gray-500">
                    {metric.description}
                  </span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Performance Charts */}
              <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    OEE Trend Over Time
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Overall Equipment Effectiveness
                  </p>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={oeeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12 }}
                      stroke="#9ca3af"
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      stroke="#9ca3af"
                      domain={[0, 100]}
                    />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="oee"
                      stroke="#22c55e"
                      strokeWidth={3}
                      dot={{ fill: "#22c55e", r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Availability vs Downtime
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Monthly comparison
                  </p>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={availabilityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar
                      dataKey="availability"
                      fill="#22c55e"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="downtime"
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-6">
                <DonutChart
                  segments={connectionSegments}
                  title="Robot Status"
                  subtitle="Current robot connectivity"
                />
                <DonutChart
                  segments={operationalSegments}
                  title="Robot Performance"
                  subtitle="Current robot activities"
                />
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-800">
                  Robot Performance
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Individual robot efficiency
                </p>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={robotPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip />
                  <Bar
                    dataKey="performance"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          // Robot Tracking Time Content
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Robot Tracking Time
              </h2>
              <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <Download size={16} />
                <span className="text-sm font-medium">Export</span>
              </button>
            </div>

            <div className="flex gap-4 mb-6">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">
                  Robot
                </label>
                <select
                  value={selectedRobot}
                  onChange={(e) => setSelectedRobot(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {robotIds.length > 0 ? (
                    robotIds.map((id) => (
                      <option key={id} value={id}>
                        {id}
                      </option>
                    ))
                  ) : (
                    <option>RB-001</option>
                  )}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">
                  Date Range
                </label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>This Week</option>
                  <option>Last Week</option>
                  <option>This Month</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>All</option>
                  <option>Active</option>
                  <option>Down</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-4 mb-8">
              <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
                <div className="text-sm text-gray-600 mb-1">Total Uptime</div>
                <div className="text-3xl font-bold text-gray-900">
                  {currentRobotData.uptime}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
                <div className="text-sm text-gray-600 mb-1">Total Downtime</div>
                <div className="text-3xl font-bold text-gray-900">
                  {currentRobotData.downtime}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
                <div className="text-sm text-gray-600 mb-1">Availability</div>
                <div className="text-3xl font-bold text-gray-900">
                  {currentRobotData.availability}%
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
                <div className="text-sm text-gray-600 mb-1">
                  Last Maintenance
                </div>
                <div className="text-xl font-bold text-gray-900">
                  {currentRobotData.lastMaintenance}
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
                <div className="text-sm text-gray-600 mb-1">
                  Total Cycles Completed
                </div>
                <div className="text-3xl font-bold text-gray-900">
                  {currentRobotData.cycles} tasks
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                {selectedRobot}
              </h3>

              <div className="space-y-3">
                {Object.keys(robotData).map((robotId) => (
                  <div key={robotId} className="flex items-center gap-4">
                    <div className="w-20 text-sm font-medium text-gray-700">
                      {robotId}
                    </div>
                    <div className="flex-1 flex items-center gap-1 h-8 rounded-lg overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{
                          width:
                            robotId === "RB-001"
                              ? "65%"
                              : robotId === "RB-002"
                              ? "78%"
                              : "55%",
                        }}
                      ></div>
                      <div
                        className="h-full bg-red-500"
                        style={{ width: robotId === "RB-001" ? "10%" : "0%" }}
                      ></div>
                      <div
                        className="h-full bg-yellow-500"
                        style={{
                          width:
                            robotId === "RB-001"
                              ? "10%"
                              : robotId === "RB-003"
                              ? "25%"
                              : "0%",
                        }}
                      ></div>
                      <div
                        className="h-full bg-green-500"
                        style={{
                          width:
                            robotId === "RB-001"
                              ? "15%"
                              : robotId === "RB-003"
                              ? "20%"
                              : "22%",
                        }}
                      ></div>
                    </div>
                    <div className="w-16 text-sm font-semibold text-gray-900 text-right">
                      {
                        robotData[robotId as keyof typeof robotData]
                          .availability
                      }
                      %
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-center gap-8 mt-6 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span>Active</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span>Down</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                  <span>Maintenance</span>
                </div>
              </div>

              <div className="flex justify-between mt-4 text-xs text-gray-500">
                <span>12 AM</span>
                <span>4 AM</span>
                <span>8 AM</span>
                <span>12 PM</span>
                <span>4 PM</span>
                <span>8 PM</span>
                <span>12 AM</span>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Status History
              </h3>

              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Status History
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Robot ID
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Duration
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Reason
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {statusHistory.map((entry, index) => (
                    <tr
                      key={index}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {entry.time}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {entry.robotId}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {entry.status}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {entry.duration}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-700">
                        {entry.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Analyze;
