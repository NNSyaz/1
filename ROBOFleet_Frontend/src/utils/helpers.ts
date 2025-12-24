// src/utils/helpers.ts
export const getTimeAgo = (timestamp: string | number | null): string => {
  if (!timestamp) return "Never";
  const now = Date.now();
  const diff = now - (typeof timestamp === "string" ? new Date(timestamp).getTime() : timestamp);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 10) return "Just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

export const formatDuration = (seconds: number): string => {
  if (!seconds) return "--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const getBatteryColor = (battery: number): string => {
  if (battery <= 20) return "text-red-500";
  if (battery <= 50) return "text-yellow-500";
  return "text-green-500";
};

export const getBatteryBg = (battery: number): string => {
  if (battery <= 20) return "bg-red-500";
  if (battery <= 50) return "bg-yellow-500";
  return "bg-green-500";
};

export const getRobotModel = (robot: any): string => {
  const validModels = ["TEMI", "AMR", "FIELDER"];
  let model = robot.model || robot.data?.model || robot.type?.toUpperCase() || "UNKNOWN";
  model = String(model).toUpperCase();
  return validModels.includes(model) ? model : "UNKNOWN";
};