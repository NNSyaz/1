// src/utils/statusUtils.ts

export type RobotStatus = "Online" | "Offline" | "Idle" | "Active" | "Charging";

export interface RobotStatusData {
  state: number; // 0=offline, 1=idle, 2=active, 3=charging
  connection?: string; // online/offline
  status?: string; // idle/active/charging/offline
  task_status?: string; // idle/active/charging/none
  power: number;
  areaName: string;
}

/**
 * Maps backend status data to frontend display status
 */
export function mapRobotStatus(statusData: RobotStatusData): RobotStatus {
  // Check connection first
  if (statusData.connection === "offline" || statusData.state === 0) {
    return "Offline";
  }

  // Check specific status
  const status = statusData.status || "";

  if (status === "charging" || statusData.state === 3) {
    return "Charging";
  }

  if (status === "active" || statusData.state === 2) {
    return "Active";
  }

  if (status === "idle" || statusData.state === 1) {
    return "Idle";
  }

  // Default to Online for backward compatibility
  return "Online";
}

/**
 * Get color class for status
 */
export function getStatusColor(status: RobotStatus): string {
  switch (status) {
    case "Active":
      return "text-blue-600";
    case "Idle":
      return "text-green-600";
    case "Charging":
      return "text-yellow-600";
    case "Offline":
      return "text-red-600";
    case "Online":
      return "text-green-600";
    default:
      return "text-gray-600";
  }
}

/**
 * Get background color for status badge
 */
export function getStatusBadgeColor(status: RobotStatus): string {
  switch (status) {
    case "Active":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "Idle":
      return "bg-green-100 text-green-700 border-green-200";
    case "Charging":
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "Offline":
      return "bg-red-100 text-red-700 border-red-200";
    case "Online":
      return "bg-green-100 text-green-700 border-green-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

/**
 * Get indicator dot color
 */
export function getStatusDotColor(status: RobotStatus): string {
  switch (status) {
    case "Active":
      return "bg-blue-500";
    case "Idle":
      return "bg-green-500";
    case "Charging":
      return "bg-yellow-500";
    case "Offline":
      return "bg-red-500";
    case "Online":
      return "bg-green-500";
    default:
      return "bg-gray-500";
  }
}

/**
 * Check if robot is operational (not offline)
 */
export function isRobotOperational(status: RobotStatus): boolean {
  return status !== "Offline";
}

/**
 * Get status description
 */
export function getStatusDescription(
  status: RobotStatus,
  location?: string
): string {
  switch (status) {
    case "Active":
      return location ? `Moving to ${location}` : "Executing task";
    case "Idle":
      return "Ready for tasks";
    case "Charging":
      return "Charging battery";
    case "Offline":
      return "Not connected";
    case "Online":
      return "Connected";
    default:
      return "Unknown status";
  }
}
