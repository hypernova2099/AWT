"""import datetime
from pymongo import MongoClient

class DBLogger:
    def __init__(self, user_id= "Demo-user", uri="mongodb://localhost:27017/", db_name="burnoutDB"):
        self.user_id = user_id
        try:
            client = MongoClient(uri)
            self.db = client[db_name]
            self.eye_logs = self.db["eye_strain_logs"]
            print("connected to MongoDB")
        except Exception as e:
            print(f"could not connect to MongoDB: {e}")
            self.eye_logs= None
        

    def log_alert(self , alert_type ,severity , details):
        if self.eye_logs is None:
            return
        try:
            self.eye_logs.insert_one({
                "userId": self.user_id,
                "timestamp": datetime.datetime.now(),
                "type": alert_type,
                "severity": severity,
                "details": details,
                "source": "EyeStrainMonitor"
            })
            print(f"Alert saved , details : {details} , severity : {severity}")
        except Exception as e:
            print(f" Insertion Failed : {e}")

    def log_session(self , session_data , alerts):
        if self.eye_logs is None:
            return
        try:
            self.eye_logs.insert_one({
                "userId": self.user_id,
                "timestamp": datetime.datetime.now(),
                "session_data": session_data,
                "alerts": alerts
            })

        except Exception as e:
            print(f"Mongodb insert failed : {e}")
"""

from pymongo import MongoClient
from bson import ObjectId
import datetime
import os

class DBLogger:
    def __init__(self, user_id="6718b2e6f06e93b123456789"):
        """Connect to MongoDB Atlas and use the correct DB + collection."""
        self.user_id = user_id  # Use the actual ObjectId of the logged-in user
        self.uri = os.getenv("MONGO_URI", "mongodb+srv://aditya:digitalburnout@cluster0.zn1dt0m.mongodb.net/DigitalBurnout")
        self.db_name = "DigitalBurnout"

        try:
            client = MongoClient(self.uri, serverSelectionTimeoutMS=5000)
            self.db = client[self.db_name]
            self.eye_logs = self.db["eyestrainlogs"]
            self.dashboard = self.db["dashboards"]
            print("✅ Connected to MongoDB Atlas")
        except Exception as e:
            print(f"❌ Could not connect to MongoDB: {e}")
            self.eye_logs = None
            self.dashboard = None

    def log_eye_strain(self, status: str):
        """
        Write a single eye strain event to EyeStrainLog.
        status: 'None' | 'Mild' | 'Severe'
        """
        if  self.eye_logs is None:
            print("⚠️ Skipping: no Mongo connection.")
            return
        
        try:
            doc = {
                "userId": ObjectId(self.user_id),
                "timestamp": datetime.datetime.now(),
                "eyeStrainStatus": status
            }
            self.eye_logs.insert_one(doc)
            print(f"🩺 Logged Eye Strain: {status}")
        except Exception as e:
            print(f"⚠️ EyeStrain log failed: {e}")

    def update_dashboard(self, status: str):
        """
        Update the live dashboard with latest eye strain.
        Converts Mild → 1, Severe → 2, None → 0
        """
        if  self.dashboard is None:
            return
        try:
            level_map = {"None": 0, "Mild": 1, "Severe": 2}
            self.dashboard.update_one(
                {"userId": ObjectId(self.user_id)},
                {"$set": {
                    "eyeStrain": level_map.get(status, 0),
                    "updatedAt": datetime.datetime.now()
                }},
                upsert=True
            )
            print(f"📊 Dashboard updated → eyeStrain={status}")
        except Exception as e:
            print(f"⚠️ Dashboard update failed: {e}")




            