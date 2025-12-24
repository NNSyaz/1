import React, { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Button,
} from "@mui/material";
import { Refresh as RefreshIcon } from "@mui/icons-material";
import api from "../services/api";

interface Task {
  task_id: string;
  robot_sn: string;
  robot_name?: string;
  task_type: string;
  status: string;
  target?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
}

const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Fetch task history from API
  const fetchTasks = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);

      const response = await api.getTaskHistory();
      
      if (!response) {
        throw new Error("No response from server");
      }

      // Handle different response formats
      let taskList: Task[] = [];
      
      if (Array.isArray(response)) {
        taskList = response;
      } else if (response.tasks && Array.isArray(response.tasks)) {
        taskList = response.tasks;
      } else if (response.data && Array.isArray(response.data)) {
        taskList = response.data;
      }

      // Sort tasks by creation date (newest first)
      taskList.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });

      setTasks(taskList);
      setLoading(false);
      setRetryCount(0);
    } catch (err) {
      console.error("Error fetching tasks:", err);
      
      // Only retry if this is not a manual retry
      if (retryCount < 3 && showLoading) {
        console.log(`Retrying... Attempt ${retryCount + 1}/3`);
        setTimeout(() => {
          setRetryCount((prev) => prev + 1);
        }, 2000);
      } else {
        setError(
          err instanceof Error 
            ? `Failed to load tasks: ${err.message}` 
            : "Failed to load tasks. Please check your connection and try again."
        );
        setLoading(false);
      }
    }
  };

  // Auto-retry on error
  useEffect(() => {
    if (retryCount > 0 && retryCount <= 3) {
      fetchTasks();
    }
  }, [retryCount]);

  // Initial load
  useEffect(() => {
    fetchTasks();

    // Set up auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchTasks(false);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Manual refresh handler
  const handleRefresh = () => {
    setRetryCount(0);
    fetchTasks(true);
  };

  // Get status color
  const getStatusColor = (
    status: string
  ): "default" | "primary" | "secondary" | "error" | "warning" | "info" | "success" => {
    switch (status?.toLowerCase()) {
      case "completed":
      case "success":
        return "success";
      case "running":
      case "in_progress":
        return "primary";
      case "pending":
      case "queued":
        return "info";
      case "failed":
      case "error":
        return "error";
      case "cancelled":
      case "canceled":
        return "warning";
      default:
        return "default";
    }
  };

  // Format date
  const formatDate = (dateString: string): string => {
    if (!dateString) return "N/A";
    
    try {
      const date = new Date(dateString);
      return date.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  // Calculate duration
  const calculateDuration = (startedAt?: string, completedAt?: string): string => {
    if (!startedAt) return "N/A";
    
    try {
      const start = new Date(startedAt).getTime();
      const end = completedAt ? new Date(completedAt).getTime() : Date.now();
      const durationMs = end - start;
      
      if (durationMs < 0) return "N/A";
      
      const seconds = Math.floor(durationMs / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      
      if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
      } else {
        return `${seconds}s`;
      }
    } catch {
      return "N/A";
    }
  };

  if (loading && tasks.length === 0) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Card>
        <CardContent>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Box>
              <Typography variant="h5" component="h2" gutterBottom>
                Task History
              </Typography>
              <Typography variant="body2" color="text.secondary">
                View all robot tasks and their status
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
              disabled={loading}
            >
              Refresh
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
              <Button size="small" onClick={handleRefresh} sx={{ ml: 2 }}>
                Retry
              </Button>
            </Alert>
          )}

          {retryCount > 0 && retryCount <= 3 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Retrying... Attempt {retryCount}/3
            </Alert>
          )}

          {!loading && !error && tasks.length === 0 && (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No tasks found. Tasks will appear here when robots execute commands.
              </Typography>
            </Box>
          )}

          {tasks.length > 0 && (
            <TableContainer component={Paper} sx={{ mt: 2, maxHeight: 600 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Task ID</strong></TableCell>
                    <TableCell><strong>Robot</strong></TableCell>
                    <TableCell><strong>Type</strong></TableCell>
                    <TableCell><strong>Target/Destination</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell><strong>Created</strong></TableCell>
                    <TableCell><strong>Duration</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.task_id} hover>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace" fontSize="0.85em">
                          {task.task_id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {task.robot_name || task.robot_sn}
                        </Typography>
                        {task.robot_name && (
                          <Typography variant="caption" color="text.secondary">
                            {task.robot_sn}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ textTransform: "capitalize" }}>
                          {task.task_type?.replace(/_/g, " ") || "Unknown"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {task.target || "N/A"}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={task.status?.toUpperCase() || "UNKNOWN"}
                          size="small"
                          color={getStatusColor(task.status)}
                        />
                        {task.error_message && (
                          <Typography 
                            variant="caption" 
                            color="error" 
                            display="block" 
                            sx={{ mt: 0.5, maxWidth: 200 }}
                          >
                            {task.error_message}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(task.created_at)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {calculateDuration(task.started_at, task.completed_at)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {tasks.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
              Showing {tasks.length} task{tasks.length !== 1 ? "s" : ""} • Auto-refreshes every 30 seconds
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default Tasks;