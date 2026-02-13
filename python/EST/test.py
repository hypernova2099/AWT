from db_logger import DBLogger

db = DBLogger(user_id="6718b2e6f06e93b123456789")  # replace with a real ObjectId
db.log_eye_strain("Mild")
db.update_dashboard("Mild")
