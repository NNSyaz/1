// src/components/Dashboard.tsx - FIXED VERSION
import React, { useState, useEffect } from "react";
import {
  Activity,
  Bot,
  Circle,
  Layers2,
  AlertCircle,
  Wrench,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Clock,
  Battery,
  MapPin,
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  BarChart3,
  Calendar,
  Filter,
} from "lucide-react";
import { api } from "../services/api";
import { robotStatusService } from "../services/robotStatusService";

interface RobotData {
  id: string;
  name: string;
  status: "Online" | "Offline" | "Idle" | "Charging";
  battery: number;
  location: string;
  statusColor: string;
  tasksCompleted?: number;
  uptime?: number;
  lastActive?: string;
}

interface DashboardStats {
  totalRobots: number;
  activeRobots: number;
  idleRobots: number;
  offlineRobots: number;
  tasksInProgress: number;
  tasksCompleted: number;
  performance: string;
  avgBattery: number;
  efficiency: string;
  activeAlerts: number;
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

const Dashboard = () => {
  const [robots, setRobots] = useState<RobotData[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalRobots: 0,
    activeRobots: 0,
    idleRobots: 0,
    offlineRobots: 0,
    tasksInProgress: 0,
    tasksCompleted: 0,
    performance: "0%",
    avgBattery: 0,
    efficiency: "94%",
    activeAlerts: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState("24h");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "online" | "idle" | "offline"
  >("all");

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const registered = await api.getRegisteredRobots();
      if (!registered?.length) {
        setRobots([]);
        setStats({
          totalRobots: 0,
          activeRobots: 0,
          idleRobots: 0,
          offlineRobots: 0,
          tasksInProgress: 0,
          tasksCompleted: 0,
          performance: "0%",
          avgBattery: 0,
          efficiency: "-%",
          activeAlerts: 0,
        });
        setIsLoading(false);
        return;
      }

      const enriched: RobotData[] = await Promise.all(
        registered.map(async (r: RegisteredRobot): Promise<RobotData> => {
          try {
            const statusRes = await api.getRobotStatus(r.data.sn);
            const st = statusRes?.robotStatus;

            // Check WebSocket data first
            const wsData = robotStatusService.getLastData();

            const status: "Online" | "Offline" | "Idle" | "Charging" =
              wsData?.status === "charging"
                ? "Charging"
                : wsData?.status === "online" || wsData?.status === "active"
                ? "Online"
                : "Offline";

            const statusColor =
              status === "Charging"
                ? "text-blue-600"
                : status === "Online"
                ? "text-green-600"
                : "text-red-600";

            return {
              id: r.data.sn,
              name: r.nickname || `Robot ${r.data.sn}`,
              status,
              battery: wsData?.battery || st?.power || 0,
              location: wsData?.last_poi || st?.areaName || "Unknown",
              statusColor,
            };
          } catch (e) {
            console.warn(`Status fetch failed for ${r.data.sn}:`, e);
            return {
              id: r.data.sn,
              name: r.nickname || `Robot ${r.data.sn}`,
              status: "Offline",
              battery: 0,
              location: "Unknown",
              statusColor: "text-gray-600",
            };
          }
        })
      );

      setRobots(enriched);

      const total = enriched.length;
      const active = enriched.filter((r) => r.status === "Online").length;
      const charging = enriched.filter((r) => r.status === "Charging").length;
      const idle = enriched.filter((r) => r.status === "Idle").length;
      const offline = total - active - idle;
      const avgBattery = Math.round(
        enriched.reduce((acc, r) => acc + r.battery, 0) / (total || 1)
      );

      setStats({
        totalRobots: total,
        activeRobots: active,
        idleRobots: idle,
        offlineRobots: offline,
        tasksInProgress: 0,
        tasksCompleted: 0,
        performance:
          total > 0 ? `${Math.round((active / total) * 100)}%` : "0%",
        avgBattery,
        efficiency: "-- %",
        activeAlerts: 0,
      });
    } catch (err: any) {
      console.error("Dashboard fetch failed:", err);
      setError(err.message ?? "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const id = setInterval(fetchDashboardData, 30_000); // Increased to 30s
    return () => clearInterval(id);
  }, []);

  // Subscribe to robot status updates via singleton service
  // Subscribe to robot status updates via singleton service
  // Subscribe to robot status updates via singleton service
  useEffect(() => {
    const unsubscribe = robotStatusService.subscribe((data) => {
      console.log("Dashboard received WebSocket data:", data);

      // Update robots with real-time data
      setRobots((prevRobots) => {
        if (prevRobots.length === 0) return prevRobots;

        const updatedRobots = prevRobots.map((robot) => {
          const status: "Online" | "Offline" | "Idle" | "Charging" =
            data.status === "charging"
              ? "Charging"
              : data.status === "idle"
              ? "Idle"
              : data.status === "active" || data.status === "online"
              ? "Online"
              : "Offline";

          const statusColor =
            status === "Charging"
              ? "text-blue-600"
              : status === "Online"
              ? "text-green-600"
              : "text-red-600";

          return {
            ...robot,
            battery: data.battery,
            location: data.last_poi || robot.location,
            status,
            statusColor,
          };
        });

        // Recalculate stats
        const total = updatedRobots.length;
        const active = updatedRobots.filter(
          (r) => r.status === "Online"
        ).length;
        const charging = updatedRobots.filter(
          (r) => r.status === "Charging"
        ).length;
        const idle = updatedRobots.filter((r) => r.status === "Idle").length;
        const offline = total - active - charging - idle;
        const avgBattery = Math.round(
          updatedRobots.reduce((acc, r) => acc + r.battery, 0) / (total || 1)
        );

        setStats((prevStats) => ({
          ...prevStats,
          totalRobots: total,
          activeRobots: active,
          idleRobots: idle,
          offlineRobots: offline,
          avgBattery,
          performance:
            total > 0 ? `${Math.round((active / total) * 100)}%` : "0%",
        }));

        return updatedRobots;
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleRefresh = () => fetchDashboardData();

  const getBatteryColor = (n: number) => {
    if (n <= 20) return "bg-red-500";
    if (n <= 40) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getBatteryIcon = (n: number) => {
    if (n <= 20) return "text-red-500";
    if (n <= 40) return "text-yellow-500";
    return "text-green-500";
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      Online: "bg-green-100 text-green-700 border-green-200",
      Offline: "bg-red-100 text-red-700 border-red-200",
      Idle: "bg-yellow-100 text-yellow-700 border-yellow-200",
      Charging: "bg-blue-100 text-blue-700 border-blue-200",
    };
    return styles[status as keyof typeof styles] || styles.Offline;
  };

  const filteredRobots =
    filterStatus === "all"
      ? robots
      : robots.filter((r) => r.status.toLowerCase() === filterStatus);

  if (isLoading && robots.length === 0)
    return (
      <div className="flex-1 overflow-auto bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
            <div className="text-lg text-gray-600">
              Loading dashboard data...
            </div>
          </div>
        </div>
      </div>
    );

  if (error && robots.length === 0)
    return (
      <div className="flex-1 overflow-auto bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle size={20} />
              <span className="font-medium">Error loading dashboard</span>
            </div>
            <p className="text-red-600 mt-2">{error}</p>
            <button
              onClick={fetchDashboardData}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );

  const statsConfig = [
    {
      label: "Total Fleet",
      value: stats.totalRobots,
      change: "+2",
      trend: "up",
      icon: Bot,
      bgColor: "bg-gradient-to-br from-purple-500 to-purple-600",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
    },
    {
      label: "Active Now",
      value: stats.activeRobots,
      change: "+3",
      trend: "up",
      icon: Zap,
      bgColor: "bg-gradient-to-br from-green-500 to-green-600",
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
    },
    {
      label: "Fleet Efficiency",
      value: stats.efficiency,
      change: "+2%",
      trend: "up",
      icon: TrendingUp,
      bgColor: "bg-gradient-to-br from-blue-500 to-blue-600",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
    },
    {
      label: "Tasks Today",
      value: stats.tasksCompleted,
      change: "+12",
      trend: "up",
      icon: CheckCircle2,
      bgColor: "bg-gradient-to-br from-indigo-500 to-indigo-600",
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600",
    },
    {
      label: "Avg Battery",
      value: `${stats.avgBattery}%`,
      change: "-5%",
      trend: "down",
      icon: Battery,
      bgColor: "bg-gradient-to-br from-orange-500 to-orange-600",
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
    },
    {
      label: "Active Alerts",
      value: stats.activeAlerts,
      change: "+1",
      trend: "down",
      icon: AlertTriangle,
      bgColor: "bg-gradient-to-br from-red-500 to-red-600",
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
    },
  ];

  return (
    <div className="flex-1 overflow-auto bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">
                Fleet Command Center
              </h1>
              <p className="text-gray-600 flex items-center gap-2">
                <Clock size={14} />
                Last updated: {new Date().toLocaleTimeString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="1h">Last Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          {statsConfig.map((stat, index) => (
            <div
              key={index}
              className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border border-gray-100"
            >
              <div className={`${stat.bgColor} h-1`}></div>
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`${stat.iconBg} p-2.5 rounded-lg`}>
                    <stat.icon size={20} className={stat.iconColor} />
                  </div>
                  <div
                    className={`flex items-center gap-1 text-xs font-medium ${
                      stat.trend === "up" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {stat.trend === "up" ? (
                      <TrendingUp size={12} />
                    ) : (
                      <TrendingDown size={12} />
                    )}
                    {stat.change}
                  </div>
                </div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {stat.value}
                </div>
                <div className="text-xs font-medium text-gray-600">
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Two-column section: Fleet + Alerts/Activity */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          {/* Fleet Overview */}
          <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">
                  Active Fleet Overview
                </h3>
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-gray-400" />
                  <select
                    value={filterStatus}
                    onChange={(e) =>
                      setFilterStatus(e.target.value as typeof filterStatus)
                    }
                    className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="online">Online Only</option>
                    <option value="idle">Idle Only</option>
                    <option value="offline">Offline Only</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="p-6">
              {filteredRobots.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Bot className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No robots match filter</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredRobots.slice(0, 6).map((robot) => (
                    <div
                      key={robot.id}
                      className="group bg-gradient-to-br from-gray-50 to-white rounded-xl p-4 border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all duration-200 cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="font-semibold text-gray-900 mb-1">
                            {robot.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {robot.id}
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusBadge(
                            robot.status
                          )}`}
                        >
                          {robot.status}
                        </span>
                      </div>

                      <div className="flex justify-center mb-4">
                        <div className="relative">
                          <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Bot size={40} className="text-gray-600" />
                          </div>
                          <div
                            className={`absolute -bottom-1 -right-1 w-6 h-6 ${
                              robot.status === "Online"
                                ? "bg-green-500"
                                : robot.status === "Idle"
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            } rounded-full border-2 border-white flex items-center justify-center`}
                          >
                            <Circle
                              size={8}
                              fill="white"
                              className="text-white"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-gray-600 flex items-center gap-1">
                            <Battery
                              size={12}
                              className={getBatteryIcon(robot.battery)}
                            />
                            Battery
                          </span>
                          <span className="text-sm">{robot.battery}%</span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <MapPin size={12} />
                          <span className="truncate">{robot.location}</span>
                        </div>

                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                          <span className="text-gray-500">
                            Tasks: {robot.tasksCompleted ?? 0}
                          </span>
                          <span className="text-gray-500">
                            Uptime: {robot.uptime ?? 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {filteredRobots.length > 6 && (
                <div className="mt-4 text-center">
                  <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                    View All {filteredRobots.length} Robots →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right column – Alerts & Activity */}
          <div className="space-y-6">
            {/* Critical Alerts */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">
                    Critical Alerts
                  </h3>
                  <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
                    0 Active
                  </span>
                </div>
              </div>
              <div className="p-4 text-sm text-gray-500">
                No alerts at the moment.
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900">
                  Recent Activity
                </h3>
              </div>
              <div className="p-4 text-sm text-gray-500">
                No recent activity.
              </div>
            </div>
          </div>
        </div>

        {/* Bottom section – Performance & Utilisation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance Metrics */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                Performance Metrics
              </h3>
            </div>
            <div className="p-6 text-sm text-gray-500">
              Performance charts will appear here when historical data is
              available.
            </div>
          </div>

          {/* Fleet Utilization */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                Fleet Utilization
              </h3>
            </div>
            <div className="p-6">
              <div className="flex justify-center mb-6">
                <div className="relative w-48 h-48">
                  <svg viewBox="0 0 100 100" className="transform -rotate-90">
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="12"
                    />
                    {stats.activeRobots > 0 && (
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="#22c55e"
                        strokeWidth="12"
                        strokeDasharray={`${
                          (stats.activeRobots / (stats.totalRobots || 1)) *
                          251.2
                        } 251.2`}
                        strokeDashoffset="0"
                        className="transition-all duration-500"
                      />
                    )}
                    {stats.idleRobots > 0 && (
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="#eab308"
                        strokeWidth="12"
                        strokeDasharray={`${
                          (stats.idleRobots / (stats.totalRobots || 1)) * 251.2
                        } 251.2`}
                        strokeDashoffset={`${
                          -(stats.activeRobots / (stats.totalRobots || 1)) *
                          251.2
                        }`}
                        className="transition-all duration-500"
                      />
                    )}
                    {stats.offlineRobots > 0 && (
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="12"
                        strokeDasharray={`${
                          (stats.offlineRobots / (stats.totalRobots || 1)) *
                          251.2
                        } 251.2`}
                        strokeDashoffset={`${-(
                          ((stats.activeRobots + stats.idleRobots) /
                            (stats.totalRobots || 1)) *
                          251.2
                        )}`}
                        className="transition-all duration-500"
                      />
                    )}
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-gray-900">
                        {stats.totalRobots}
                      </div>
                      <div className="text-xs text-gray-500">Total Robots</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-100">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-sm font-medium text-gray-700">
                      Active
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      {stats.activeRobots}
                    </div>
                    <div className="text-xs text-gray-600">
                      {stats.totalRobots > 0
                        ? Math.round(
                            (stats.activeRobots / stats.totalRobots) * 100
                          )
                        : 0}
                      %
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <span className="text-sm font-medium text-gray-700">
                      Idle
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      {stats.idleRobots}
                    </div>
                    <div className="text-xs text-gray-600">
                      {stats.totalRobots > 0
                        ? Math.round(
                            (stats.idleRobots / stats.totalRobots) * 100
                          )
                        : 0}
                      %
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="text-sm font-medium text-gray-700">
                      Offline
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      {stats.offlineRobots}
                    </div>
                    <div className="text-xs text-gray-600">
                      {stats.totalRobots > 0
                        ? Math.round(
                            (stats.offlineRobots / stats.totalRobots) * 100
                          )
                        : 0}
                      %
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
