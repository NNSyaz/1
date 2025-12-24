// src/pages/Tasks.tsx
import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Plus,
  RefreshCw,
  Filter,
} from "lucide-react";
import { api } from "../services/api";
import CreateTaskModal from "../components/modals/CreateTaskModal";

interface Task {
  task_id: string;
  robot_id: string;
  last_poi: string;
  target_poi: string;
  status: string;
  distance?: number;
  start_time: string;
  end_time?: string;
}

const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const data = await api.getTaskHistory();
      setTasks(data);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredTasks = tasks.filter((task) => {
    if (filter === "all") return true;
    return task.status === filter;
  });

  const getStatusBadge = (status: string) => {
    const styles = {
      completed: "bg-green-100 text-green-700 border-green-200",
      in_progress: "bg-blue-100 text-blue-700 border-blue-200",
      pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
      failed: "bg-red-100 text-red-700 border-red-200",
      cancelled: "bg-gray-100 text-gray-700 border-gray-200",
    };
    return styles[status as keyof typeof styles] || styles.pending;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4" />;
      case "failed":
        return <XCircle className="w-4 h-4" />;
      case "in_progress":
        return <Clock className="w-4 h-4 animate-spin" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const pending = tasks.filter((t) => t.status === "pending").length;
  const running = tasks.filter((t) => t.status === "in_progress").length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const failed = tasks.filter((t) => t.status === "failed").length;

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Task Management</h1>
            <p className="text-sm text-gray-500 mt-1">Monitor and manage robot tasks</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchTasks}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Create Task
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <span className="text-2xl font-bold text-gray-900">{pending}</span>
            </div>
            <div className="text-sm font-medium text-gray-600">Pending Tasks</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <RefreshCw className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-2xl font-bold text-gray-900">{running}</span>
            </div>
            <div className="text-sm font-medium text-gray-600">Running Tasks</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-2xl font-bold text-gray-900">{completed}</span>
            </div>
            <div className="text-sm font-medium text-gray-600">Completed Today</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <span className="text-2xl font-bold text-gray-900">{failed}</span>
            </div>
            <div className="text-sm font-medium text-gray-600">Failed Tasks</div>
          </div>
        </div>

        {/* Tasks Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Task History</h2>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-400" />
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="in_progress">Running</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">
                    Task ID
                  </th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">
                    Robot
                  </th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">
                    Route
                  </th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">
                    Distance
                  </th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">
                    Start Time
                  </th>
                  <th className="text-left py-3 px-6 text-sm font-semibold text-gray-700">
                    Duration
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-500">
                      No tasks yet. Create your first task!
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => {
                    const duration = task.end_time
                      ? Math.round(
                          (new Date(task.end_time).getTime() -
                            new Date(task.start_time).getTime()) /
                            1000
                        )
                      : Math.round(
                          (Date.now() - new Date(task.start_time).getTime()) / 1000
                        );

                    const minutes = Math.floor(duration / 60);
                    const seconds = duration % 60;

                    return (
                      <tr
                        key={task.task_id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-3 px-6 text-sm font-mono text-gray-700">
                          #{task.task_id.slice(-6)}
                        </td>
                        <td className="py-3 px-6 text-sm text-gray-900 font-medium">
                          Robot {task.robot_id}
                        </td>
                        <td className="py-3 px-6 text-sm text-gray-700">
                          {task.last_poi} → {task.target_poi}
                        </td>
                        <td className="py-3 px-6">
                          <span
                            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadge(
                              task.status
                            )}`}
                          >
                            {getStatusIcon(task.status)}
                            {task.status}
                          </span>
                        </td>
                        <td className="py-3 px-6 text-sm text-gray-700">
                          {task.distance ? `${task.distance.toFixed(1)}m` : "-"}
                        </td>
                        <td className="py-3 px-6 text-sm text-gray-600">
                          {new Date(task.start_time).toLocaleString()}
                        </td>
                        <td className="py-3 px-6 text-sm text-gray-700">
                          {minutes}:{seconds.toString().padStart(2, "0")}
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

      {showCreateModal && (
        <CreateTaskModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchTasks();
          }}
        />
      )}
    </div>
  );
};

export default Tasks;