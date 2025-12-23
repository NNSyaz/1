from fastapi import FastAPI, WebSocket, APIRouter, Request
from pymongo import MongoClient
from contextlib import asynccontextmanager
from typing import List, Dict
import asyncio
import time
import uvicorn
import websockets
import json
import httpx
import signal
import sys
from redis.asyncio import Redis
from database import record_position, get_robot_id_by_sn, update_task_status, start_robot_session, end_robot_session

#Robot IP
IP = "192.168.0.250"

#REST URL
BASE_URL = "https://apiglobal.autoxing.com"

#WEBSOCKET URL
WS_URL = "wss://serviceglobal.autoxing.com"

#DIRECT ROBOT URL
DIRECT_URL = f"http://{IP}:8090"

#DIRECT ROBOT WEBSOCKET URL
DIRECT_WS = f"ws://{IP}:8090"

shutdown_event = asyncio.Event()
active_sessions: Dict[int, int] = {}
robot_monitor: Dict[int, asyncio.Task] = {}

def signal_handler(signum, frame):
    """Handle SIGINT (Ctrl+C) and SIGTERM"""
    print("\n Shutdown signal received...")
    shutdown_event.set()

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"Client connected: {len(self.active_connections)} total")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        print(f"Client disconnected: {len(self.active_connections)} remaining")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

ws_manager = ConnectionManager()

async def init_redis(app: FastAPI):
    r = Redis(host="localhost", port=6379, decode_responses=True)
    app.state.redis = r
    #ts = app.state.redis.ts()

    print("REDIS SERVER INITIALIZED")

    #await start_redis_status(app.state.redis)
    asyncio.create_task(pub_robot_status_manager(app.state.redis))
    asyncio.create_task(pub_lidar_points(app.state.redis))
    asyncio.create_task(monitor_planning_state(app.state.redis))

async def pub_robot_status(redis: Redis, robot_id: int):
    compile_list = {}
    prev_pose = None
    session_id = None
    connection_lost_logged = False

    url = DIRECT_WS + "/ws/v2/topics"

    while not shutdown_event.is_set():
        try:
            async with websockets.connect(url, ping_interval=20, ping_timeout=10, close_timeout=10, open_timeout=10) as ws:
                print(f"Websocket connected to {url}")
                
                if session_id is None:
                    session_id = await start_robot_session(robot_id)
                    active_sessions[robot_id] = session_id
                    await start_redis_status(redis, True)
                    print(f"ROBOT ONLINE - Session {session_id} started (Robot ID: {robot_id})")
                    connection_lost_logged = False

                await ws.send(json.dumps({"disable_topic":["/slam/state"]}))
                await ws.send(json.dumps({"enable_topic":["/battery_state", "/tracked_pose", "/planning_state"]}))

                while not shutdown_event.is_set():
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                        data = json.loads(msg)
                        topic = data.get("topic")

                        if topic == "/battery_state":
                            percentage = data.get("percentage", 0)
                            compile_list.update({"battery": msg})
                            data_json = json.dumps(compile_list)
                            await redis.set("robot:battery", data_json)
                            await redis.publish("robot:status", data_json)

                        elif topic == "/tracked_pose" and robot_id:
                            pose_data = data.get("pos", [])
                            ori_data = data.get("ori", 0)

                            if len(pose_data) >= 2:
                                x, y = float(pose_data[0]), float(pose_data[1])

                                await record_position(
                                    robot_id=robot_id,
                                    x=x,
                                    y=y,
                                    ori=float(ori_data),
                                    prev_x=prev_pose[0] if prev_pose else None,
                                    prev_y=prev_pose[1] if prev_pose else None
                                )

                                prev_pose = (x, y)
                                compile_list.update({"pose": msg})
                                await redis.publish("robot:pose", json.dumps(compile_list))

                        elif topic == "/planning_state":
                            move_state = data.get("move_state")
                            task_id_str = await redis.get(f"robot:{robot_id}:current_task")

                            if move_state == "succeed" and task_id_str:
                                task_id = int(task_id_str)
                                await update_task_status(task_id, "completed")
                                await redis.delete(f"robot:{robot_id}:current_task")
                                print(f"Task {task_id} completed")

                            elif move_state == "failed" and task_id_str:
                                task_id = int(task_id_str)
                                await update_task_status(task_id, "failed")
                                await redis.delete(f"robot:{robot_id}:current_task")
                                print(f"Task {task_id} failed")

                    except asyncio.TimeoutError:
                        continue

        except (websockets.exceptions.ConnectionClosed,
                websockets.exceptions.WebSocketException,
                OSError,
                asyncio.TimeoutError) as e:
            
            if not connection_lost_logged:
                print(f"Robot connection lost: {type(e).__name__}: {e}")
                connection_lost_logged = True

            if session_id:
                await end_robot_session(robot_id, f"Connection_lost: {type(e).__name__}")
                await start_redis_status(redis, False)
                compile_list.update({"status": 'offline'})
                await redis.publish("robot:status", json.dumps(compile_list))
                print(f"ROBOT OFFLINE - Session {session_id} ended")
                active_sessions.pop(robot_id, None)
                session_id = None

            if not shutdown_event.is_set():
                reconnect_delay = 5
                print(f"Reconnecting in {reconnect_delay}s...")
                try:
                    await asyncio.wait_for(
                        shutdown_event.wait(),
                        timeout=reconnect_delay
                    )
                    break
                except asyncio.TimeoutError:
                    continue

        except Exception as e:
            print(f"Unexpected error in pub_robot_status: {e}")
            import traceback
            traceback.print_exc()
            
            if session_id:
                await end_robot_session(robot_id, f"unexpected_error: {type(e).__name__}")
                active_sessions.pop(robot_id, None)
                session_id = None

            await asyncio.sleep(5)

    if session_id:
        await end_robot_session(robot_id, "server_shutdown")
        await start_redis_status(redis, False)
        active_sessions.pop(robot_id, None)
        print(f"ROBOT SESSION CLOSED - Server shutdown - Session {session_id}")


async def monitor_planning_state(redis: Redis):

    url = DIRECT_WS + "/ws/v2/topics"

    async with websockets.connect(url) as ws:
        try:
            await ws.send(json.dumps({"enable_topic":["/planning_state"]}))
            print("Subcribed to /planning_state")

            while True:
                msg = await ws.recv()
                data = json.loads(msg)

                if data.get("topic") == "/planning_state":
                    await handle_planning_state(redis, data)

        except Exception as e:
            print(f"Planning state monitor error: {e}")
        finally:
            await ws.close()

async def handle_planning_state(redis: Redis, data: dict):
    """
    Process planning state updates and update task status
    
    move_state values:
    - "moving": Task in progress akmal
    - "succeeded": Task completed successfully
    - "failed": Task failed
    - "cancelled": Task was cancelled
    """

    move_state = data.get("move_state")
    action_id = data.get("action_id")
    fail_reason = data.get("fail_reason_str", "none")
    remaining_distance = data.get("remaining_distance", 0.0)

    print(f" Planning_state {move_state} | Action: {action_id} | Distance:{remaining_distance}m")

    #Store current planning state in Redis
    await redis.set("robot:planning_state", json.dumps(data))

    # Get current task ID from Redis
    current_task_id = await redis.get("robot:current_task_id")

    if not current_task_id:
        print("No active task ID found")
        return

    current_task_id = int(current_task_id)

    #Update robot status based on move_state
    if move_state == "moving":
        await redis.set("robot:status", "active")
        await redis.set("robot:state", "moving")
        print(f"Task {current_task_id} in progress ({remaining_distance:.2f})m remaining")
        
    elif move_state == "succeeded":
        await redis.set("robot:status", "idle")
        await redis.set("robot:state", "idle")

        #Update task status in PostgreSQL
        await update_task_status(current_task_id, "completed")

        print(f"Task {current_task_id} complete successfully")

        # Publish completion event
        await redis.publish("robot:task_completed", json.dumps({
            "task_id": current_task_id,
            "status": "completed",
            "timestamp": time.time()
        }))

    elif move_state == "failed":
        await redis.set("robot:status", "error")
        await redis.set("robot:state", "failed")

        #Update fail task status progress in postgresql
        await update_task_status(current_task_id, "failed", fail_reason)

        await redis.delete("robot:current_task_id")

        print(f"Task {current_task_id} failed: {fail_reason}")

        await redis.publish("robot:task_failed", json.dumps({
            "task_id": current_task_id,
            "status": "failed",
            "reason": fail_reason,
            "timestamp": time.time()
        }))

    elif move_state == "cancelled":
        await redis.set("robot:status", "idle"),
        await redis.set("robot:state", "cancelled")

        #Update task status in the postgresql
        await update_task_status(current_task_id, "cancelled")

        #Clear current task
        await redis.delete("robot:current_task_id")

        print(f"Task {current_task_id} cancelled")

        await redis.publish("robot:task_cancelled", json.dumps({
            "task_id": current_task_id,
            "status": "cancelled",
            "timestamp": time.time()
        })) 

async def pub_lidar_points(redis: Redis):
    """Publishes lidar point cloud data"""
    url = DIRECT_WS + "/ws/v2/topics"

    async with websockets.connect(url) as ws:
        try:
            await ws.send(json.dumps({"disable_topic": ["/slam/state"]}))
            await ws.send(json.dumps({"enable":["/scan_matched_points2"]}))

            while True:
                msg = await ws.recv()
                await redis.publish("robot:lidar", msg)

        except Exception as e:
            print(e)

async def sub_robot_status(request: Request):
    pubsub = request.app.state.redis.pubsub()
    await pubsub.subscribe("robot:pose")
    print("Subscribed to robot:pose")

    try:
        async for message in pubsub.listen():
            print("REDIS SUB DATA: ",message)
            if message["type"] == "message":
                data = message["data"]
                print("Received robot pose:", data)
                return message
    except Exception as e:
        print("Subscriber error:", e)
    finally:
        await websockets.close()
        await pubsub.close()
        print("Subscriber closed")
 

async def start_redis_status(redis: Redis, stat: bool):
    print("ROBOT REDIS BOOL STATUS: ",stat)
    if stat:
        status = {
            "status": "online",
            "poi": "origin"
        }
    else:
        status = {
            "status": "offline",
            "poi": "origin"
        }

    await redis.set("robot:status", status["status"])
    await redis.set("robot:last_poi", status["poi"])



async def pub_robot_status_manager (redis: Redis):
    """
    Manager that restart pub_robot_status if it crashes
    This ensures the robot always monitord
    """
    robot_id = await get_robot_id_by_sn("2682406203417T7")

    if not robot_id:
        print("ERROR: Robot not found in database. cannot start monitor.")
        return
    
    restart_count = 0

    while not shutdown_event.is_set():
        try:
            print(f"Starting robot status publisher (restart #{restart_count})")
            await pub_robot_status(redis, robot_id)

            if shutdown_event.is_set():
                print(f"Robot status publisher (restart #{restart_count})")
                break

        except asyncio.CancelledError:
            print("Robot status publisher cancelled")
            if robot_id in active_sessions:
                session_id = active_sessions[robot_id]
                await end_robot_session(robot_id, "task_cancelled")
                active_sessions.pop(robot_id, None)
                print(f"Session {session_id} ended on cancellation")
            break

        except Exception as e:
            print(f"Robot status publisher crahsed: {e}")
            import traceback
            traceback.print_exc()

        if not shutdown_event.is_set():
            restart_count += 1
            wait_time = min(5 * restart_count, 60)
            print(f"Restarting robot monitor in {wait_time}s...")

            try:
                await asyncio.wait_for(
                    shutdown_event.wait(),
                    timeout=wait_time
                )
                break
            except asyncio.TimeoutError:
                continue

    print("Robot status manager stopped")

async def cleanup_active_sessions():
    """End all active robot sessions during shutdown"""
    if not active_sessions:
        print("No active sessions to clean up")
        return
    
    print(f"Cleaning up {len(active_sessions)} active sessions...")
    for robot_id, session_id, in list(active_sessions.items()):
        try:
            await end_robot_session(robot_id, "server_shutdown")
            print(f"Ended session {session_id} for robot {robot_id}")
        except Exception as e:
            print(f"Error ending session {session_id}: {e}")

    active_sessions.clear()
    print("All session cleaned up")




