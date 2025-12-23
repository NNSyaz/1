# fastapi_edge.py
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from contextlib import asynccontextmanager
import asyncio
import time
import uvicorn     
import websockets
import json
import httpx
import robot
import database
from redis.asyncio import Redis
from database import init_postgres, close_postgres
from redis_server import init_redis, cleanup_active_sessions, shutdown_event


mongo_client = None
robot_col = None
poi_col = None
background_tasks = []

@asynccontextmanager
async def lifespan(app: FastAPI):
    global mongo_client, robot_col, poi_col, background_tasks

    print("SERVER STARTUP..")
    
    try:
    
        # ============ Initialize MongoDB ============
        mongo_client = MongoClient("mongodb://localhost:27017/")

        db = mongo_client["robotDB"]

        robot_col = db['robots']
        poi_col = db['poi']
        print("MongoDB connected")

        # ============ Initialize PostgreSQL ============
        await init_postgres()
        print("PostgreSQL connected")

        # ============ Initialize Redis ============

        redis_task = asyncio.create_task(init_redis(app))
        background_tasks.append(redis_task)
        print("Redis initializing")

        await asyncio.sleep(2)
        print("SERVER INITIALIZED")

        yield
    
    finally:

        print("SERVER SHUTTING DOWN...")

        shutdown_event.set()

        print("Cleaning up active robot sessions...")
        await cleanup_active_sessions()

        if background_tasks:
            print(f"Waiting for {len(background_tasks)} background tasks to stop...")
            for task in background_tasks:
                if not task.done():
                    task.cancel()
                    try:
                        await asyncio.wait_for(task, timeout=5.0)
                    except (asyncio.CancelledError, asyncio.TimeoutError):
                        pass

        await close_postgres()
        if mongo_client:
            mongo_client.close()

        print("************************")
        print("SERVER SHUTDOWN COMPLETE")
        print("************************")


app = FastAPI(lifespan=lifespan)
app.include_router(robot.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get('/hello')
async def main_hello():
    return "hello from main server!"

if __name__ == "__main__":
    uvicorn.run("fastapi_edge:app", host='0.0.0.0', reload=True)