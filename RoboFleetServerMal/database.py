# database.py
import asyncpg
from typing import Optional
import math
import asyncio
import datetime

pool: Optional[asyncpg.Pool] = None

async def init_postgres():
    """Initialize connection pool on startup"""
    global pool
    pool = await asyncpg.create_pool(
        host='localhost',
        port='5433',
        user='postgres',
        password='admin',
        database='robotdb',
        min_size=5,
        max_size=20
    )
        
    print("PostgresSQL connection pool created")

async def close_postgres():
    """Close connection pool on shutdown"""
    global pool
    if pool:
        await pool.close()
        print("PostgreSQL connection pool closed")

def calculate_distance(x1: float, y1: float, x2: float, y2: float) -> float:
    """Calculate Euclidean distance"""
    return math.sqrt((x2 - x1)**2 +(y2 - y1)**2)

# =========== ROBOT OPERATIONS ============

async def insert_robot(name: str, nickname: str, sn: str, ip: str, model: str = "AMR"):
    """Insert a new robot into db"""
    async with pool.acquire() as conn:
        robot_id = await conn.fetchval('''
            INSERT INTO robots (name, nickname, sn, ip, model, status, time_created)
            VALUES ($1, $2, $3, $4, $5, 'idle', NOW())
            RETURNING id
        ''', name, nickname, sn, ip, model)
        
        return robot_id
    
async def get_robot_id_by_sn(sn: str) -> Optional[int]:
    """Get robot ID from serial number"""
    async with pool.acquire() as conn:
        robot_id = await conn.fetchval(
            'SELECT id FROM robots WHERE sn = $1', sn
        )

        return robot_id
    
async def update_robot_status(robot_id: int, status: str, last_poi: str = None):
    """Update robot status and last POI"""
    async with pool.acquire() as conn:
        if last_poi:
            await conn.execute('''
                UPDATE robot SET status = $1, last_poi = $2 WHERE id = $3
            ''', status, last_poi, robot_id)
            
        else:
            await conn.execute('''
                UPDATE robot SET status = $1, WHERE id = $2
            ''', status, robot_id)

# =========== TASK OPERATIONS ============

async def create_task(
    robot_id: int, 
    last_poi: str, 
    target_poi: str, 
    start_x: float, 
    start_y: float, 
    target_x: float, 
    target_y: float
) -> int:
    """Create new task record"""
    distance = calculate_distance(start_x, start_y, target_x, target_y)
    task_id = int(datetime.datetime.now().timestamp() * 1000)
    
    async with pool.acquire() as conn:
        await conn.execute('''
            INSERT INTO tasks_history 
            (task_id, robot_id, last_poi, target_poi, status, distance, start_time, end_time)
            VALUES ($1, $2, $3, $4, 'in_progress', $5, NOW(), NOW())
        ''', task_id, robot_id, last_poi, target_poi, distance)
        
        return task_id
    
async def update_task_status(task_id: int, status: str, fail_reason: str = None):
    """Update task status (Complete, Failed, Cancel )"""
    async with pool.acquire() as conn:
        if fail_reason:
            await conn.execute('''
                UPDATE tasks_history
                SET status = $1, end_time = NOW(), notes = $2
                WHERE task_id = $3
            ''', status, f"Failed: {fail_reason}", task_id)

        else:
            await conn.execute('''
                UPDATE tasks_history
                SET status = $1, end_time = NOW()
                WHERE task_id = $2
            ''', status, task_id)

        print(f"Task {task_id} update status to {status}")
        
async def get_active_task(robot_id: int):
    """Get currently active task for a robot"""
    async with pool.acquire as conn:
        row = await conn.fetchrow('''
            SELECT * FROM tasks_history
            WHERE robot_id = $1 AND STATUS = 'in_progress'
            ORDER BY start_time DESC
            LIMIT 
        ''', robot_id)

        return dict(row) if row else None
        
async def get_task_by_id(task_id: int):
    async with pool.acquire as conn:
        row = await conn.fetchrow('''
            SELECT * FROm tasks_history
            WHERE task_id = $1
        ''', task_id)
    
    return dict(row) if row else None

async def get_task_history(robot_id: int = None, limit: int = 100):
    """Get task history"""
    async with pool.acquire() as conn:
        if robot_id:
            rows = await conn.fetch('''
                SELECT * FROM tasks_history
                WHERE robot_id = $1
                ORDER BY start_time DESC
                LIMIT $2
            ''', robot_id, limit)
        
        else:
            rows = await conn.fetch('''
                SELECT * FROM tasks_history
                ORDER BY start_time DESC
                LIMIT $1    
            ''', limit)

        return[dict(row) for row in rows]
    
async def get_task_statistics(robot_id: int = None):
    """Get comprehensive task statistics"""
    async with pool.acquire() as conn:
        if robot_id:
            stats = await conn.fetchrow('''
                SELECT
                    COUNT(*) as total_tasks,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
                    SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                    AVG(CASE WHEN status = 'completed'
                        THEN EXTRACT(EPOCH FROM(end_time - start_time))
                        ELSE NULL END) as avg_completion_time,
                    SUM(distance) as total_distance
                FROM tasks_history
                WHERE robot_id = $1
            ''', robot_id)

        else:
            stats = await conn.fetchrow('''
                SELECT
                    COUNT(*) as total_tasks,
                    SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                    SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
                    SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                    AVG(CASE WHEN status = 'completed'
                        THEN EXTRACT(EPOCH FROM (end_time - start_time))
                        ELSE NULL END) as avg_completion_time,
                    SUM(distance) as total_distance
                FROM tasks_history
            ''')

        return dict(stats) if stats else None

# ============ MOVEMENT TRACKING ============

async def record_position(robot_id: int, x: float, y: float, ori: float, prev_x: float = None, prev_y: float = None):
    """Record robot position with distance calculation"""

    distance = 0.0
    if prev_x is not None and prev_y is not None:
        distance = calculate_distance(prev_x, prev_y, x, y)
    
    async with pool.acquire() as conn:
        await conn.execute('''
            INSERT INTO robot_movement (time, robot_id, x, y, ori, distance)
            VALUES (NOW(), $1, $2, $3, $4, $5)
        ''', robot_id, x, y, ori, distance)

async def get_movement_history(robot_id: int, limit: int = 1000):
    """Get movement history"""
    async with pool.acquire() as conn:
        rows = await conn.fetch('''
            SELECT * FROM robot_movement
            WHERE robot_id = $1
            ORDER BY time DESC
            ''', robot_id, limit)
        
        return [dict(row) for row in rows]

async def get_total_distance(robot_id: int, start_date:datetime.datetime = None ):
    """Calculate total distance traveled"""
    async with pool.acquire() as conn:
        if start_date:
            total = await conn.fetchval('''
                SELECT COALESCE(SUM(distance), 0)
                FROM robot_movement
                WHERE robot_id = $1 AND time >= $2
            ''', robot_id, start_date)

        else:
            total = await conn.fetchval('''
                SELECT COALESCE(SUM(distance), 0)
                FROM robot_movement
                WHERE robot_id = $1     
            ''', robot_id)

        return float(total)
    
# ============ ANALYTICS ============

async def get_robot_stats(robot_id: int):
    """Get comprehensive robot statistics"""
    async with pool.acquire() as conn:

        task_stats = await conn.fetchrow('''
            SELECT
                COUNT(*) as total_tasks,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_tasks,
                AVG(distance) as avg_distance,
                SUM(distance) as total_task_distance
            FROM tasks_history
            WHERE robot_id = $1
        ''', robot_id)

        movement_distance = await conn.fetchval('''
            SELECT COALESCE(SUM(distance), 0)
            FROM robot_movement
            WHERE robot_id = $1
        ''', robot_id)

        return{
            "robot_id": robot_id,
            "total_tasks": task_stats['total_tasks'],
            "completed_tasks": task_stats['completed_tasks'],
            "failed_tasks": task_stats['failed_tasks'],
            "avg_task_distance": float(task_stats['avg_distance'] or 0),
            "total_distance_traveled": float(movement_distance)
        }
    
# ============ ROBOT SESSION TRACKING ============

async def start_robot_session(robot_id: int):
    """Record when robot comes online & Called when robot connects to system"""

    async with pool.acquire() as conn:

        unclosed = await conn.fetchval('''
            SELECT id FROM robot_sessions
            WHERE robot_id = $1 AND status = 'online'
            ORDER BY timestamp DESC
            LIMIT 1
        ''', robot_id)

        if unclosed:
            duration = await conn.fetchval('''SELECT NOW() - timestamp FROM robot_sessions WHERE id = $1''', unclosed)

            await conn.execute('''
                INSERT INTO robot_sessions (robot_id, status, timestamp, session_duration, notes)
                VALUES ($1, 'offline', NOW(), $2, 'Auto-closed: New session started')
        ''', robot_id, duration)
            
        print(f"Auto-closed previous session {unclosed} for robot {robot_id}")

        session_id = await conn.fetchval('''
            INSERT INTO robot_sessions (robot_id, status, timestamp)
            VALUES ($1, 'online', NOW())
            RETURNING id
        ''', robot_id)

        print(f"Robot {robot_id} session started - ID: {session_id}")
        return session_id
    
async def end_robot_session(robot_id: int, reason: str = "normal"):
    """Record when robot offline & Calculate how long the session lasted"""
    async with pool.acquire() as conn:
        last_online = await conn.fetchrow('''
            SELECT id, timestamp
            FROM robot_sessions
            WHERE robot_id = $1
            AND status = 'online'
            ORDER BY timestamp DESC
            LIMIT 1
        ''', robot_id)

        if not last_online:
            print(f"No active session found for robot {robot_id}")
            return None
        
        #calculate duration
        duration = await conn.fetchval('''SELECT NOW() - $1''', last_online['timestamp'])

        #Insert offline record
        session_id = await conn.fetchval('''
            INSERT INTO robot_sessions (robot_id, status, timestamp, session_duration, notes)
            VALUES ($1, 'offline', NOW(), $2, $3)
            RETURNING id    
        ''', robot_id, duration, f"Disconnected: {reason}")

        print(f"Robot {robot_id} session ended - Duration: {duration} - Reason: {reason}")
        return session_id

async def get_robot_operating_hours(robot_id: int = None, time_range: str = "24h"):
    """Calculate total operating hours = Sum of all (offline_time - online_time) for completed sessions"""
    async with pool.acquire() as conn:

        if time_range == "1h":
            interval = "1 hour"
        elif time_range == "24h":
            interval = "24 hours"
        elif time_range == "7d":
            interval = "7 days"
        else:
            interval = "8 days"

        if robot_id:
            query = '''
                SELECT COALESCE(
                    SUM(EXTRACT(EPOCH FROM session_duration)) / 3600,
                    0
                ) as operating_hours
                FROM robot_sessions
                WHERE robot_id = $1
                AND status = 'offline'
                AND timestamp >= NOW() - INTERVAL $2
            '''
            hours = await conn.fetchval(query, robot_id, interval)
        else:
            query = '''
                SELECT COALESCE(
                    SUM(EXTRACT(EPOCH FROM session_duration)) / 3600,
                    0
                ) as operating_hours
                FROM robot_sessions
                WHERE status = 'offline'
                AND timestamp >= NOW() - INTERVAL $1
            '''
            hours = await conn.fetchval(query, interval)

        return round(float(hours), 2)
    
async def get_fleet_uptime_percentange(time_range: str = "24h"):
    """Fleet Uptime = (Total time spent on tasks) / (Total operating hours)
    Your insight: Compare task time vs robot online time
    """
    async with pool.acquire() as conn:
        if time_range == "1h":
            interval = "1 hour"
        elif time_range == "24h":
            interval = "24 hours"
        elif time_range == "7d":
            interval = "7 days"
        elif time_range == "30d":
            interval = "30 days"
        else:
            interval = "24 hours"

        total_operating_hours = await conn.fetchval('''
            SELECT COALESCE(
                SUM(EXTRACT(EPOCH FROM session_duration)) / 3600, 
                0
            )
            FROM robot_sessions
            WHERE status = 'offline'
            AND timestamp >= NOW() - INTERVAL $1
        ''', interval)

        total_task_hours = await conn.fetchval('''
            SELECT COALESCE(
                SUM(EXTRACT(EPOCH FROM (end_time - start_time))) / 3600,
                0
            )
            FROM task_history
            WHERE status = 'completed'
            AND start_time >= NOW() - INTERVAL $1
        ''', interval)

        if total_operating_hours > 0:
            uptime_percentage = (total_task_hours / total_operating_hours) * 100
        else:
            uptime_percentage = 0

        return round(uptime_percentage, 1)
    
async def get_robot_current_session_duration(robot_id: int):
    """If robot is currently online, how long has it been online"""

    async with pool.acquire() as conn:
        last_session = await conn.fetchrow('''
            SELECT status, timestamp
            FROM robot_sessions
            WHERE robot_id = $1
            ORDER BY timestamp DESC
            LIMIT 1
        ''', robot_id)

        if not last_session or last_session['status'] != 'online':
            return 0
        
        duration = await conn.fetchval('''
            SELECT EXTRACT(EPOCH FROM (NOW() - $1)) /3600
        ''', last_session['timestamp'])

        return round(float(duration), 2)
    
async def get_session_history(robot_id: int = None, limit: int = 100):
    """Get history of robot online/offline events"""

    async with pool.acquire() as conn:
        if robot_id:
            rows = await conn.fetch('''
                SELECT * FROM robot_sessions
                WHERE robot_id = $1
                ORDER BY timestamp DESC
                LIMIT $2
            ''', robot_id, limit)
        else:
            rows = await conn.fetch('''
                SELECT rs.*, r.nickname
                FROM robot_sessions rs
                JOIN robots r ON rs.robot_id = r.id
                ORDER BY timestamp DESC
                LIMIT $1
            ''', limit)
        
        return [dict(row) for row in rows]
    
async def get_fleet_analytics(time_range: str = "24h"):
    """UPDATED: Uses your session tracking concept"""

    async with pool.acquire() as conn:
        if time_range == "1h":
            interval = "1 hour"
        elif time_range == "24h":
            interval = "24 hours"
        elif time_range == "7d":
            interval = "7 days"
        elif time_range == "30d":
            interval = "30 days"
        else:
            interval = "24 hours"

        total_robots = await conn.fetchval('SELECT COUNT(*) FROM robots')

        tasks_completed = await conn.fetchval('''
            SELECT COUNT(*) FROM tasks_history
            WHERE status = 'completed
            AND start_time >= NOW() - INTERVAL $1
        ''', interval)

        task_in_progress = await conn.fetchval('''
            SELECT COUNT(*) FROM tasks_history
            WHERE status = 'in_progress'
        ''')

        total_distance = await conn.fetchval('''
            SELECT COALESCE(SUM(distance), 0) FROM robot_movement
            WHERE time >= NOW() - INTERVAL $1
        ''', interval)
        total_milage_km = float(total_distance) / 1000.0

        operating_hours = await conn.fetchval('''
            SELECT COALESCE(
                SUM(EXTRACT(EPOCH FROM session_duration)) / 3600, 0
            )
            FROM robot_sessions
            WHERE status = 'offline'
            AND timestamp >= NOW() - INTERVAL $1        
        ''', interval)

        total_task_hours = await conn.fetchval('''
            SELECT COALESCE(
                SUM(EXTRACT(EPOCH FROM (end_time - start_time))) / 3600,
                0
            )
            FROM tasks_history
            WHERE status = 'completed'
            AND start_time >= NOW() - INTERVAL $1
        ''', interval)

        if operating_hours > 0:
            fleet_uptime_pct = (total_task_hours / operating_hours) * 100
        else:
            fleet_uptime_pct = 0

        avg_task_time = await conn.fetchval('''
            SELECT COALESCE(
                AVG(EXTRACT(EPOCH FROM (end_time - start_time)) / 60),
                0
            )
            FROM tasks_history
            WHERE status = 'completed'
            AND start_time >= NOW() - INTERVAL $1
        ''', interval)

        return {
            "total_robots": total_robots,
            "task_completed": tasks_completed,
            "tasks_in_progress": task_in_progress,
            "total_mileage_km": round(total_milage_km, 2),
            "operating_hours": round(float(operating_hours), 1),
            "avg_task_time_min": round(float(avg_task_time), 1),
            "fleet_uptime_pct": round(fleet_uptime_pct, 1)
        }