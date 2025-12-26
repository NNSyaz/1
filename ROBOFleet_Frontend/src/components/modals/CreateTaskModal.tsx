// src/components/modals/CreateTaskModal.tsx
import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import api from "../../services/api";
import toast from "react-hot-toast";

interface CreateTaskModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ onClose, onSuccess }) => {
  const [robots, setRobots] = useState<any[]>([]);
  const [pois, setPois] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    robot: "",
    taskType: "goto",
    location: "",
    priority: "medium",
    notes: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [robotsData, poisData] = await Promise.all([
        api.getRegisteredRobots(),
        api.getPOIList(),
      ]);
      setRobots(robotsData);
      setPois(poisData);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.location) {
      toast.error("Please select a location");
      return;
    }

    try {
      setLoading(true);
      const result = await api.dispatchTask(
        formData.taskType,
        formData.robot,
        { location: formData.location }
      );

      if (result.status === 200) {
        toast.success(`Task created successfully! Task ID: ${result.task_id}`);
        onSuccess();
      } else {
        toast.error(result.msg || "Task creation failed");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create task");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Create New Task</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Robot (Optional)
            </label>
            <select
              value={formData.robot}
              onChange={(e) => setFormData({ ...formData, robot: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Auto-assign</option>
              {robots.map((robot) => (
                <option key={robot.data.sn} value={robot.data.sn}>
                  {robot.nickname} ({robot.data.sn})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Task Type</label>
            <select
              value={formData.taskType}
              onChange={(e) => setFormData({ ...formData, taskType: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="goto">GOTO - Navigate to location</option>
              <option value="speak">SPEAK - Text-to-speech (Temi only)</option>
              <option value="escort">ESCORT - Multiple waypoints</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Location *
            </label>
            <select
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Choose location...</option>
              {pois.map((poi) => (
                <option key={poi.name} value={poi.name}>
                  {poi.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (Optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Add any additional notes..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Creating..." : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;