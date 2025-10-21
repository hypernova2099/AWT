import datetime
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