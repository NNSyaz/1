// src/components/modals/MoveToCoordinateModal.tsx
import React, { useState } from "react";
import { X, Target } from "lucide-react";
import { api } from "../../services/api";
import toast from "react-hot-toast";

interface MoveToCoordinateModalProps {
  robotSn: string;
  robotName: string;
  currentX: number;
  currentY: number;
  onClose: () => void;
  onSuccess: () => void;
}

const MoveToCoordinateModal: React.FC<MoveToCoordinateModalProps> = ({
  robotSn,
  robotName,
  currentX,
  currentY,
  onClose,
  onSuccess,
}) => {
  const [targetX, setTargetX] = useState(currentX.toFixed(2));
  const [targetY, setTargetY] = useState(currentY.toFixed(2));
  const [targetOri, setTargetOri] = useState("0");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const x = parseFloat(targetX);
    const y = parseFloat(targetY);
    const ori = parseFloat(targetOri) || 0;

    if (isNaN(x) || isNaN(y)) {
      toast.error("Please enter valid coordinates");
      return;
    }

    try {
      setLoading(true);
      const result = await api.moveToCoordinate(x, y, ori, robotSn);

      if (result.status === 200 || result.ok) {
        toast.success(`✅ ${robotName} moving to (${x.toFixed(2)}, ${y.toFixed(2)})`);
        onSuccess();
      } else {
        toast.error(result.msg || "Move command failed");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to execute move");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Target className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">Move to Coordinates</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Current Position</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-blue-700">X:</span>
                <span className="ml-2 font-mono text-blue-900">{currentX.toFixed(3)}</span>
              </div>
              <div>
                <span className="text-blue-700">Y:</span>
                <span className="ml-2 font-mono text-blue-900">{currentY.toFixed(3)}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target X Coordinate (meters) *
            </label>
            <input
              type="number"
              step="0.01"
              value={targetX}
              onChange={(e) => setTargetX(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Y Coordinate (meters) *
            </label>
            <input
              type="number"
              step="0.01"
              value={targetY}
              onChange={(e) => setTargetY(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Orientation (radians)
            </label>
            <input
              type="number"
              step="0.01"
              value={targetOri}
              onChange={(e) => setTargetOri(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              {loading ? "Moving..." : "🎯 Move"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MoveToCoordinateModal;