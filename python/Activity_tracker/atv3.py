import time
import platform
import psutil
import pyautogui
import os
from datetime import datetime, timedelta
from pynput import keyboard
from pymongo import MongoClient
from collections import defaultdict

# ================== CONFIGURATION ==================
USER_ID = os.getenv("TRACKER_USER_ID", "default_user")
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME = "burnoutDB"

CODING_APPS = ["Visual Studio Code", "VS Code", "Code", "PyCharm", "Terminal", 
               "Sublime Text", "Xcode", "IntelliJ", "Atom", "Vim", "Emacs"]
IDLE_THRESHOLD = 60      # seconds
BREAK_THRESHOLD = 300    # 5 minutes (break must be this long to count)
CHECK_INTERVAL = 5       # seconds between checks

# ================== PLATFORM DETECTION ==================
system = platform.system()

try:
    if system == "Darwin":  # macOS
        from AppKit import NSWorkspace
    elif system == "Windows":
        import win32gui
    elif system == "Linux":
        import subprocess
    else:
        print(f"⚠️ Unsupported operating system: {system}")
        exit(1)
except ImportError as e:
    print(f"❌ Failed to import platform-specific modules: {e}")
    print("Install required packages:")
    if system == "Darwin":
        print("  pip install pyobjc-framework-Cocoa")
    elif system == "Windows":
        print("  pip install pywin32")
    exit(1)

# ================== DATABASE SETUP ==================
try:
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    client.server_info()
    db = client[DB_NAME]
    
    # Create indexes for better performance
    db.appusages.create_index([("userId", 1), ("date", 1)])
    db.activitylogs.create_index([("userId", 1), ("date", 1)], unique=True)
    
    print("✅ Connected to MongoDB")
except Exception as e:
    print(f"❌ Failed to connect to MongoDB: {e}")
    exit(1)

# ================== TRACKERS ==================
class ActivityTracker:
    def __init__(self):
        self.current_app = None
        self.app_start_time = time.time()
        self.coding_time = 0
        self.idle_time = 0
        self.total_session_time = 0
        self.last_activity_time = time.time()
        self.breaks_taken = 0
        self.typing_activity_count = 0
        self.typing_start = None
        self.current_typing_duration = 0
        self.typing_sessions = []
        self.late_night_sessions = []  # Track late night time periods
        self.last_mouse_pos = None
        self.last_key_time = None
        self.app_durations = defaultdict(float)  # Aggregate app usage
        self.keyboard_listener = None
        self.session_start = datetime.now()
        
    def is_late_night(self):
        """Check if current time is late night (10 PM - 6 AM)"""
        hour = datetime.now().hour
        return hour >= 22 or hour < 6
    
    def get_active_window(self):
        """Cross-platform method to get active window title."""
        try:
            if system == "Darwin":
                return NSWorkspace.sharedWorkspace().frontmostApplication().localizedName()
            elif system == "Windows":
                return win32gui.GetWindowText(win32gui.GetForegroundWindow())
            elif system == "Linux":
                result = subprocess.run(
                    ["xdotool", "getactivewindow", "getwindowname"],
                    stdout=subprocess.PIPE, 
                    stderr=subprocess.DEVNULL, 
                    text=True,
                    timeout=1
                )
                return result.stdout.strip()
        except Exception:
            return None
    
    def is_coding_app(self, app_name):
        """Check if app is a coding-related application"""
        if not app_name:
            return False
        return any(coding_app.lower() in app_name.lower() for coding_app in CODING_APPS)
    
    def on_key_press(self, key):
        """Handle keyboard activity"""
        self.last_key_time = time.time()
        self.typing_activity_count += 1
        
        if self.typing_start is None:
            self.typing_start = time.time()
    
    def on_key_release(self, key):
        """Handle key release - finalize typing sessions"""
        pass  # We'll calculate typing sessions based on activity gaps
    
    def check_typing_session(self):
        """Check if typing session should be finalized"""
        if self.typing_start and self.last_key_time:
            gap = time.time() - self.last_key_time
            # If no typing for 10 seconds, end the session
            if gap > 10:
                duration = self.last_key_time - self.typing_start
                if duration >= 30:  # Only count sessions >= 30 seconds
                    self.typing_sessions.append(duration / 60)  # Store in minutes
                self.typing_start = None
                self.typing_activity_count = 0
    
    def is_active(self):
        """Check if user is currently active (mouse or keyboard)"""
        current_pos = pyautogui.position()
        mouse_moved = current_pos != self.last_mouse_pos
        
        keyboard_active = False
        if self.last_key_time:
            keyboard_active = (time.time() - self.last_key_time) < 5
        
        self.last_mouse_pos = current_pos
        return mouse_moved or keyboard_active
    
    def log_app_usage(self, app_name, duration):
        """Aggregate app usage for batch insertion"""
        if duration > 0:
            self.app_durations[app_name] += duration
    
    def save_app_usage_batch(self):
        """Save all aggregated app usage to database"""
        try:
            # FIX: Use local time consistently, not UTC
            date_str = datetime.now().strftime("%Y-%m-%d")
            
            # FIX: Include current app's duration before saving
            if self.current_app:
                current_duration = time.time() - self.app_start_time
                self.app_durations[self.current_app] += current_duration
                self.app_start_time = time.time()  # Reset start time
            
            for app_name, total_duration in self.app_durations.items():
                category = "Coding" if self.is_coding_app(app_name) else "Other"
                
                # Upsert: update if exists, insert if not
                db.appusages.update_one(
                    {
                        "userId": USER_ID,
                        "appName": app_name,
                        "date": date_str
                    },
                    {
                        "$inc": {"usageMinutes": round(total_duration / 60, 2)},
                        "$set": {
                            "category": category,
                            "timestamp": datetime.now()  # FIX: Use local time
                        }
                    },
                    upsert=True
                )
            print(f"✅ Saved usage data for {len(self.app_durations)} apps")
            self.app_durations.clear()  # Clear after successful save
            
        except Exception as e:
            print(f"⚠️ Failed to save app usage (will retry next interval): {e}")
            # Don't clear app_durations so it accumulates and retries
    
    def log_activity_summary(self):
        """Save activity summary to database"""
        try:
            total_coding_hours = round(self.coding_time / 3600, 2)
            idle_ratio = round(self.idle_time / self.total_session_time, 2) if self.total_session_time > 0 else 0
            typing_avg = round(sum(self.typing_sessions) / len(self.typing_sessions), 2) if self.typing_sessions else 0
            
            # Calculate expected breaks (1 per hour)
            expected_breaks = max(1, int(self.total_session_time / 3600))
            break_compliance = round(min(1.0, self.breaks_taken / expected_breaks), 2) if expected_breaks > 0 else 0
            
            # Calculate late night work duration
            late_night_duration = sum(self.late_night_sessions)
            late_night_work = late_night_duration > 0
            
            # FIX: Use local time consistently
            date_str = datetime.now().strftime("%Y-%m-%d")
            
            # Upsert activity log
            db.activitylogs.update_one(
                {
                    "userId": USER_ID,
                    "date": date_str
                },
                {
                    "$set": {
                        "totalCodingHours": total_coding_hours,
                        "idleRatio": idle_ratio,
                        "lateNightWork": late_night_work,
                        "lateNightMinutes": round(late_night_duration / 60, 2),
                        "typingSessionAvg": typing_avg,
                        "typingSessionCount": len(self.typing_sessions),
                        "breakCompliance": break_compliance,
                        "breaksTaken": self.breaks_taken,
                        "totalSessionMinutes": round(self.total_session_time / 60, 2),
                        "timestamp": datetime.now()  # FIX: Use local time
                    }
                },
                upsert=True
            )
            
            print("\n" + "="*50)
            print("📊 SESSION SUMMARY")
            print("="*50)
            print(f"Total Coding Time: {total_coding_hours} hours")
            print(f"Total Session Time: {round(self.total_session_time / 60, 2)} minutes")
            print(f"Idle Ratio: {idle_ratio * 100}%")
            print(f"Breaks Taken: {self.breaks_taken} (expected: {expected_breaks})")
            print(f"Break Compliance: {break_compliance * 100}%")
            print(f"Typing Sessions: {len(self.typing_sessions)} (avg: {typing_avg} min)")
            print(f"Late Night Work: {late_night_work} ({round(late_night_duration / 60, 2)} min)")
            print("="*50)
            
        except Exception as e:
            print(f"❌ Failed to log activity summary: {e}")
    
    def run(self):
        """Main tracking loop"""
        try:
            # Start keyboard listener
            self.keyboard_listener = keyboard.Listener(
                on_press=self.on_key_press,
                on_release=self.on_key_release
            )
            self.keyboard_listener.start()
            
            print(f"🚀 Activity Tracker running on {system}...")
            print(f"👤 User ID: {USER_ID}")
            print(f"⏱️  Check interval: {CHECK_INTERVAL} seconds")
            print("Press Ctrl+C to stop and save.\n")
            
            self.last_mouse_pos = pyautogui.position()
            last_save_time = time.time()
            SAVE_INTERVAL = 300  # Save to DB every 5 minutes
            
            while True:
                loop_start = time.time()
                active_window = self.get_active_window()
                
                # Check for activity
                is_active = self.is_active()
                
                if is_active:
                    # FIX: Check if we just returned from a break BEFORE resetting idle_time
                    if self.idle_time >= BREAK_THRESHOLD:
                        self.breaks_taken += 1
                        print(f"✅ Break detected: {round(self.idle_time / 60, 1)} minutes")
                    
                    self.last_activity_time = time.time()
                    self.idle_time = 0
                    
                    # FIX: Only track late night work when actively working on coding apps
                    if self.is_late_night() and self.is_coding_app(active_window):
                        self.late_night_sessions.append(CHECK_INTERVAL)
                else:
                    self.idle_time += CHECK_INTERVAL
                
                # Check typing session status
                self.check_typing_session()
                
                # App tracking
                if active_window and active_window != self.current_app:
                    if self.current_app:
                        duration = time.time() - self.app_start_time
                        self.log_app_usage(self.current_app, duration)
                        
                        if self.is_coding_app(self.current_app):
                            self.coding_time += duration
                        
                        print(f"📱 Switched: {self.current_app} ({round(duration/60, 1)} min) → {active_window}")
                    
                    self.current_app = active_window
                    self.app_start_time = time.time()
                
                self.total_session_time += CHECK_INTERVAL
                
                # Periodic save to database
                if time.time() - last_save_time >= SAVE_INTERVAL:
                    self.save_app_usage_batch()
                    last_save_time = time.time()
                
                # Sleep for remaining time to maintain interval
                elapsed = time.time() - loop_start
                sleep_time = max(0, CHECK_INTERVAL - elapsed)
                time.sleep(sleep_time)
                
        except KeyboardInterrupt:
            print("\n⏸️  Stopping tracker...")
            self.cleanup()
        except Exception as e:
            print(f"\n❌ Error in main loop: {e}")
            import traceback
            traceback.print_exc()
            self.cleanup()
    
    def cleanup(self):
        """Clean up resources and save final data"""
        # Stop keyboard listener
        if self.keyboard_listener:
            self.keyboard_listener.stop()
        
        # FIX: Finalize active typing session before saving
        if self.typing_start and self.last_key_time:
            duration = self.last_key_time - self.typing_start
            if duration >= 30:
                self.typing_sessions.append(duration / 60)
        
        # Log final app usage
        if self.current_app:
            duration = time.time() - self.app_start_time
            self.log_app_usage(self.current_app, duration)
            if self.is_coding_app(self.current_app):
                self.coding_time += duration
        
        # Save all data
        self.save_app_usage_batch()
        self.log_activity_summary()
        
        # Close database connection
        try:
            client.close()
            print("🔒 Database connection closed.")
        except:
            pass
        
        print("🛑 Tracker stopped. All data saved.")

# ================== MAIN ==================
if __name__ == "__main__":
    tracker = ActivityTracker()
    tracker.run()