#!/usr/bin/env python3
"""
Eye Strain Monitoring System - Cross Platform Version (Fixed Blink Detection)
with alert logging (simpler than v3)

Requirements:
- opencv-python
- numpy

Optional:
- dlib (better accuracy)
- pygame (better audio)

pip install opencv-python numpy
pip install dlib pygame  # Optional
"""

import cv2
import numpy as np
import time
import datetime
import threading
from collections import deque
import json
import os
import platform
import sys

# Optional imports with fallbacks
try:
    import dlib
    DLIB_AVAILABLE = True
except Exception:
    DLIB_AVAILABLE = False
    print("Warning: dlib not available, falling back to Haar cascades")

try:
    import pygame
    PYGAME_AVAILABLE = True
except Exception:
    PYGAME_AVAILABLE = False
    print("Warning: pygame not available, using system beep for alerts")


class AlertLogger:
    """Simple alert logger that saves to session file."""
    
    def __init__(self, session_id):
        os.makedirs('alert_logs', exist_ok=True)
        self.session_id = session_id
        self.alert_file = f"alert_logs/alerts_{session_id}.json"
        self.alerts = []
    
    def calculate_blink_severity(self, blink_rate):
        """Calculate severity based on blink frequency."""
        if blink_rate >= 15:
            return "Low"
        elif blink_rate >= 10:
            return "Medium"
        elif blink_rate >= 5:
            return "High"
        else:
            return "Critical"
    
    def calculate_exposure_severity(self, duration_minutes):
        """Calculate severity based on screen exposure time."""
        if duration_minutes <= 30:
            return "Low"
        elif duration_minutes <= 60:
            return "Medium"
        elif duration_minutes <= 120:
            return "High"
        else:
            return "Critical"
    
    def is_late_night_work(self):
        """Check if current time is between 10 PM and 6 AM."""
        current_hour = datetime.datetime.now().hour
        return current_hour >= 22 or current_hour < 6
    
    def adjust_severity_for_time(self, base_severity):
        """Increase severity for late night work."""
        if not self.is_late_night_work():
            return base_severity
        
        severity_levels = ["Low", "Medium", "High", "Critical"]
        current_index = severity_levels.index(base_severity)
        return severity_levels[min(current_index + 1, len(severity_levels) - 1)]
    
    def log_alert(self, alert_type, severity, details):
        """Log alert in specified format."""
        final_severity = self.adjust_severity_for_time(severity)
        
        alert_record = {
            "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "type": alert_type,
            "severity": final_severity,
            "details": details
        }
        
        self.alerts.append(alert_record)
        
        # Save to file immediately
        try:
            with open(self.alert_file, 'w') as f:
                json.dump(self.alerts, f, indent=2)
        except Exception as e:
            print(f"Warning: Could not save alert: {e}")


class EyeStrainMonitor:
    def __init__(self):
        """Initialize the Eye Strain Monitor with default parameters."""
        # EAR thresholds
        
        self.EAR_CONSEC_FRAMES = 3  # reduced from 20 → better blink detection
        self.DROWSY_CONSEC_FRAMES = 48

        # Calibration based on your measurements
        open_ear = 0.350
        closed_ear = 0.305
        self.EAR_THRESHOLD = (open_ear + closed_ear) / 2   # ≈ 0.327
        self.DROWSY_THRESHOLD = closed_ear - 0.01          # ≈ 0.295

        

        # Timing thresholds (seconds)
        self.BLINK_ALERT_TIME = 20    # alert if no blink for this many seconds
        self.BREAK_REMINDER_TIME = 1200  # 20 minutes
        self.LONG_SESSION_TIME = 3600    # 1 hour

        # counters / trackers
        self.blink_counter = 0
        self.frame_counter = 0
        self.eye_closed_counter = 0
        self.drowsy_counter = 0
        self.last_blink_time = time.time()
        self.session_start_time = time.time()
        self.last_break_reminder = time.time()

        # data stores
        self.blink_history = deque(maxlen=300)  # timestamps
        self.ear_history = deque(maxlen=100)
        self.session_data = {
            'start_time': datetime.datetime.now().isoformat(),
            'total_blinks': 0,
            'drowsy_episodes': 0,
            'break_reminders': 0,
            'avg_ear': 0.0,
            'session_duration': 0.0
        }

        # detection and audio init
        self.detection_method = self._initialize_detection()
        self._initialize_audio()

        # logs directory
        os.makedirs('eye_strain_logs', exist_ok=True)

        # current alert display object
        self.current_alert = None
        self.alert_playing = False
        
        # NEW: Add alert logger
        session_timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        self.alert_logger = AlertLogger(session_timestamp)

    def _initialize_detection(self):
        """Pick dlib (if available) or Haar cascades as fallback."""
        if DLIB_AVAILABLE:
            try:
                self.detector = dlib.get_frontal_face_detector()
                predictor_path = 'shape_predictor_68_face_landmarks.dat'
                if not os.path.exists(predictor_path):
                    print(f"Warning: {predictor_path} not found. Attempting download...")
                    if not self._download_predictor():
                        print("Download failed — falling back to Haar cascades.")
                        return self._initialize_haar_cascades()
                self.predictor = dlib.shape_predictor(predictor_path)
                self.LEFT_EYE_POINTS = list(range(42, 48))
                self.RIGHT_EYE_POINTS = list(range(36, 42))
                print("Using dlib facial landmarks for eye detection.")
                return "dlib"
            except Exception as e:
                print(f"Dlib init failed: {e}\nFalling back to Haar cascades.")
                return self._initialize_haar_cascades()
        else:
            return self._initialize_haar_cascades()

    def _initialize_haar_cascades(self):
        """Initialize Haar cascade classifiers."""
        try:
            self.face_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            self.eye_cascade = cv2.CascadeClassifier(
                cv2.data.haarcascades + 'haarcascade_eye.xml')
            if self.face_cascade.empty() or self.eye_cascade.empty():
                raise RuntimeError("Could not load Haar cascade XML files.")
            print("Using OpenCV Haar cascades for detection.")
            return "haar"
        except Exception as e:
            print(f"Error initializing Haar cascades: {e}")
            raise RuntimeError("No face detection available.")

    def _download_predictor(self):
        """Attempt to download dlib predictor (compressed .bz2) and extract it."""
        try:
            import urllib.request
            import bz2
            url = "http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2"
            bz2_filename = "shape_predictor_68_face_landmarks.dat.bz2"
            print("Downloading facial landmark predictor (this may take a while)...")
            urllib.request.urlretrieve(url, bz2_filename)
            with bz2.BZ2File(bz2_filename, 'rb') as f_in:
                with open("shape_predictor_68_face_landmarks.dat", 'wb') as f_out:
                    f_out.write(f_in.read())
            os.remove(bz2_filename)
            print("Downloaded and extracted predictor successfully.")
            return True
        except Exception as e:
            print(f"Predictor download failed: {e}")
            return False

    def _initialize_audio(self):
        """Set up audio method."""
        self.audio_method = "none"
        if PYGAME_AVAILABLE:
            try:
                pygame.mixer.pre_init(44100, -16, 2, 512)
                pygame.mixer.init()
                self.audio_method = "pygame"
                print("Using pygame for audio alerts.")
            except Exception as e:
                print(f"Pygame init failed: {e}")
                self._fallback_audio_init()
        else:
            self._fallback_audio_init()

    def _fallback_audio_init(self):
        system = platform.system().lower()
        if system == "darwin":
            self.audio_method = "afplay"
            print("Using macOS 'afplay' for audio alerts (if available).")
        elif system == "linux":
            self.audio_method = "beep"
            print("Using system 'beep' for alerts (if available).")
        elif system == "windows":
            try:
                import winsound  # noqa: F401
                self.audio_method = "winsound"
                print("Using winsound for alerts on Windows.")
            except Exception:
                self.audio_method = "print"
                print("winsound unavailable; using text alerts.")
        else:
            self.audio_method = "print"
            print("Unknown system: using text alerts.")

    def calculate_ear(self, eye_landmarks):
        """Compute Eye Aspect Ratio (EAR)."""
        eye = np.asarray(eye_landmarks, dtype=np.float32)
        if eye.shape[0] < 6:
            return 0.3
        A = np.linalg.norm(eye[1] - eye[5])
        B = np.linalg.norm(eye[2] - eye[4])
        C = np.linalg.norm(eye[0] - eye[3])
        if C <= 1e-6:
            return 0.3
        return float((A + B) / (2.0 * C))

    def calculate_ear_from_bbox(self, eye_bbox):
        """Approximate EAR from bounding box (Haar fallback)."""
        x, y, w, h = eye_bbox
        if w <= 0:
            return 0.3
        aspect_ratio = h / float(w)
        return max(0.15, min(0.35, aspect_ratio * 0.5))  # scaled for realism

    def extract_eye_landmarks(self, landmarks, eye_points):
        coords = []
        for i in eye_points:
            part = landmarks.part(i)
            coords.append([int(part.x), int(part.y)])
        return np.array(coords, dtype=np.int32)

    def play_alert_sound(self, alert_type="blink"):
        """Play an alert sound without blocking main loop."""
        if self.alert_playing:
            return
        def _play():
            self.alert_playing = True
            try:
                if self.audio_method == "pygame":
                    self._play_pygame_sound(alert_type)
                elif self.audio_method == "afplay":
                    self._play_system_beep_macos(alert_type)
                elif self.audio_method == "winsound":
                    self._play_system_beep_windows(alert_type)
                elif self.audio_method == "beep":
                    self._play_system_beep_linux(alert_type)
                else:
                    print(f"🔊 ALERT ({alert_type}): please respond.")
            except Exception as e:
                print(f"Audio play failed: {e}")
            finally:
                self.alert_playing = False
        threading.Thread(target=_play, daemon=True).start()

    def _play_pygame_sound(self, alert_type):
        """Generate a short tone with pygame."""
        mapping = {"blink": (800, 0.25), "drowsy": (600, 0.45), "break": (1000, 0.6)}
        freq, dur = mapping.get(alert_type, (700, 0.3))
        sample_rate = 44100
        t = np.linspace(0, dur, int(sample_rate * dur), False)
        tone = np.sin(freq * 2 * np.pi * t)
        audio = (tone * (2**15 - 1)).astype(np.int16)
        stereo = np.column_stack([audio, audio])
        sound = pygame.sndarray.make_sound(stereo)
        sound.play()
        time.sleep(dur)
        sound.stop()

    def _play_system_beep_macos(self, alert_type):
        import subprocess
        sound_map = {"blink": "/System/Library/Sounds/Ping.aiff",
                     "drowsy": "/System/Library/Sounds/Sosumi.aiff",
                     "break": "/System/Library/Sounds/Glass.aiff"}
        path = sound_map.get(alert_type)
        if path and os.path.exists(path):
            subprocess.run(["afplay", path], capture_output=True)
        else:
            print(f"macOS sound file not found for alert {alert_type}.")

    def _play_system_beep_windows(self, alert_type):
        import winsound
        freq_map = {"blink": 800, "drowsy": 600, "break": 1000}
        dur_map = {"blink": 300, "drowsy": 500, "break": 700}
        winsound.Beep(freq_map.get(alert_type, 750), dur_map.get(alert_type, 300))

    def _play_system_beep_linux(self, alert_type):
        import subprocess
        freq_map = {"blink": "800", "drowsy": "600", "break": "1000"}
        dur_map = {"blink": "300", "drowsy": "500", "break": "700"}
        try:
            subprocess.run(["beep", "-f", freq_map.get(alert_type, "800"),
                            "-l", dur_map.get(alert_type, "300")],
                           check=True, capture_output=True)
        except Exception:
            print(f"Linux sound fallback: {alert_type} (no system sound available).")

    def show_alert_popup(self, message, alert_type="info"):
        colors = {"blink": (0, 255, 255), "drowsy": (0, 0, 255),
                  "break": (255, 0, 0), "info": (255, 255, 255)}
        self.current_alert = {'message': message,
                              'color': colors.get(alert_type, colors['info']),
                              'timestamp': time.time()}

    def detect_eyes_and_calculate_ear(self, frame, gray):
        if self.detection_method == "dlib":
            return self._detect_with_dlib(frame, gray)
        return self._detect_with_haar(frame, gray)

    def _detect_with_dlib(self, frame, gray):
        faces = self.detector(gray, 0)
        total_ear, face_count = 0.0, 0
        for face in faces:
            landmarks = self.predictor(gray, face)
            left_eye = self.extract_eye_landmarks(landmarks, self.LEFT_EYE_POINTS)
            right_eye = self.extract_eye_landmarks(landmarks, self.RIGHT_EYE_POINTS)
            left_ear = self.calculate_ear(left_eye)
            right_ear = self.calculate_ear(right_eye)
            avg_ear = (left_ear + right_ear) / 2.0
            total_ear += avg_ear
            face_count += 1
            self.draw_eye_landmarks(frame, left_eye)
            self.draw_eye_landmarks(frame, right_eye)
            cv2.rectangle(frame, (face.left(), face.top()),
                          (face.right(), face.bottom()), (255, 0, 0), 2)
        return (total_ear / face_count if face_count > 0 else 0.3, face_count > 0)

    def _detect_with_haar(self, frame, gray):
        faces = self.face_cascade.detectMultiScale(gray, scaleFactor=1.3, minNeighbors=5)
        total_ear, eye_count = 0.0, 0
        for (x, y, w, h) in faces:
            cv2.rectangle(frame, (x, y), (x+w, y+h), (255, 0, 0), 2)
            roi_gray = gray[y:y + h//2, x:x + w]
            roi_color = frame[y:y + h//2, x:x + w]
            eyes = self.eye_cascade.detectMultiScale(roi_gray, scaleFactor=1.1, minNeighbors=3)
            for (ex, ey, ew, eh) in eyes:
                cv2.rectangle(roi_color, (ex, ey), (ex+ew, ey+eh), (0, 255, 0), 2)
                ear = self.calculate_ear_from_bbox((ex, ey, ew, eh))
                total_ear += ear
                eye_count += 1
        avg_ear = total_ear / eye_count if eye_count > 0 else 0.3
        return (avg_ear, len(faces) > 0)

    def draw_eye_landmarks(self, frame, eye_coords):
        if eye_coords is None or len(eye_coords) == 0:
            return
        pts = np.asarray(eye_coords, dtype=np.int32)
        if pts.ndim != 2 or pts.shape[1] != 2:
            return
        cv2.polylines(frame, [pts.reshape((-1, 1, 2))],
                      isClosed=True, color=(0, 255, 0), thickness=1)
        for (x, y) in pts:
            cv2.circle(frame, (int(x), int(y)), 2, (0, 255, 0), -1)

    def draw_statistics(self, frame):
        session_duration = time.time() - self.session_start_time
        time_since_blink = time.time() - self.last_blink_time
        avg_ear = float(np.mean(self.ear_history)) if self.ear_history else 0.0
        denom = max(min(session_duration, 300.0), 1.0)
        blink_rate = len(self.blink_history) * 60.0 / denom
        stats = [
            f"Session: {session_duration/60:.1f} min",
            f"Blinks: {self.blink_counter}",
            f"Blink Rate: {blink_rate:.1f}/min",
            f"Last Blink: {time_since_blink:.1f}s ago",
            f"EAR: {avg_ear:.3f}",  # live EAR debug
            f"Drowsy Episodes: {self.session_data.get('drowsy_episodes', 0)}"
        ]
        y_offset = 30
        for i, stat in enumerate(stats):
            cv2.putText(frame, stat, (10, y_offset + i*25),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        if self.current_alert:
            alert_age = time.time() - self.current_alert['timestamp']
            if alert_age < 3.0:
                cv2.rectangle(frame, (50, 200), (550, 260), (0, 0, 0), -1)
                cv2.rectangle(frame, (50, 200), (550, 260),
                              self.current_alert['color'], 3)
                cv2.putText(frame, self.current_alert['message'], (60, 235),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8,
                            self.current_alert['color'], 2)

    def run(self):
        print("Starting Eye Strain Monitor...")
        print("Press 'q' to quit, 's' to save statistics.")
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("Error: Could not access webcam. Check permissions or device.")
            return
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        try:
            cap.set(cv2.CAP_PROP_FPS, 30)
        except Exception:
            pass
        try:
            while True:
                ret, frame = cap.read()
                if not ret or frame is None:
                    print("Warning: failed to read frame from webcam.")
                    break
                frame = cv2.flip(frame, 1)
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                avg_ear, faces_detected = self.detect_eyes_and_calculate_ear(frame, gray)
                
                # Calculate current blink rate for logging
                session_duration = time.time() - self.session_start_time
                denom = max(min(session_duration, 300.0), 1.0)
                current_blink_rate = len(self.blink_history) * 60.0 / denom
                
                if faces_detected:
                    self.ear_history.append(avg_ear)
                    if avg_ear < self.EAR_THRESHOLD:
                        self.eye_closed_counter += 1
                    else:
                        if self.eye_closed_counter >= self.EAR_CONSEC_FRAMES:
                            if time.time() - self.last_blink_time > 0.25:  # 250ms cooldown
                                self.blink_counter += 1
                                self.last_blink_time = time.time()
                                self.blink_history.append(time.time())
                        self.eye_closed_counter = 0
                    if avg_ear < self.DROWSY_THRESHOLD:
                        self.drowsy_counter += 1
                        if self.drowsy_counter >= self.DROWSY_CONSEC_FRAMES:
                            self.show_alert_popup("DROWSINESS DETECTED: Take a break!", "drowsy")
                            self.play_alert_sound("drowsy")
                            self.session_data['drowsy_episodes'] += 1
                            
                            # NEW: Log fatigue alert
                            self.alert_logger.log_alert(
                                alert_type="Fatigue Detected",
                                severity="High",
                                details=f"Eye openness = {avg_ear:.3f} (very tired)"
                            )
                            
                            self.drowsy_counter = 0
                    else:
                        self.drowsy_counter = 0

                    # Blink alert if too long without blinking
                    if time.time() - self.last_blink_time > self.BLINK_ALERT_TIME:
                        self.show_alert_popup("Blink Reminder: Please blink!", "blink")
                        self.play_alert_sound("blink")
                        
                        # NEW: Log blink frequency alert
                        blink_severity = self.alert_logger.calculate_blink_severity(current_blink_rate)
                        self.alert_logger.log_alert(
                            alert_type="Blink Frequency",
                            severity=blink_severity,
                            details=f"Blink rate = {current_blink_rate:.1f} blinks/min"
                        )
                        
                        self.last_blink_time = time.time()

                    # Break reminder
                    if time.time() - self.last_break_reminder > self.BREAK_REMINDER_TIME:
                        self.show_alert_popup("20 min passed: Look away for 20 sec", "break")
                        self.play_alert_sound("break")
                        
                        # NEW: Log screen exposure alert
                        exposure_severity = self.alert_logger.calculate_exposure_severity(session_duration / 60)
                        self.alert_logger.log_alert(
                            alert_type="Screen Exposure",
                            severity=exposure_severity,
                            details=f"Continuous screen time = {session_duration/60:.1f} minutes"
                        )
                        
                        self.last_break_reminder = time.time()
                        self.session_data['break_reminders'] += 1

                    # Long session warning
                    if time.time() - self.session_start_time > self.LONG_SESSION_TIME:
                        self.show_alert_popup("1 hour session: Take a proper break!", "break")
                        self.play_alert_sound("break")
                        
                        # NEW: Log extended session alert
                        self.alert_logger.log_alert(
                            alert_type="Screen Exposure",
                            severity="Critical",
                            details=f"Extended session = {session_duration/3600:.1f} hours continuous"
                        )
                        
                        self.session_start_time = time.time()

                # Overlay stats + alerts
                self.draw_statistics(frame)
                cv2.imshow("Eye Strain Monitor", frame)

                # Handle keypress
                key = cv2.waitKey(1) & 0xFF
                if key == ord("q"):
                    break
                elif key == ord("s"):
                    self.save_session_data()

        finally:
            cap.release()
            cv2.destroyAllWindows()
            self.save_session_data(final=True)

    def save_session_data(self, final=False):
        """Save session stats to a JSON log file."""
        self.session_data['end_time'] = datetime.datetime.now().isoformat()
        self.session_data['total_blinks'] = self.blink_counter
        self.session_data['session_duration'] = time.time() - self.session_start_time
        self.session_data['avg_ear'] = float(np.mean(self.ear_history)) if self.ear_history else 0.0

        fname = datetime.datetime.now().strftime("eye_strain_logs/session_%Y%m%d_%H%M%S.json")
        with open(fname, "w") as f:
            json.dump(self.session_data, f, indent=2)

        if final:
            print(f"Final session data saved → {fname}")
        else:
            print(f"Session checkpoint saved → {fname}")


if __name__ == "__main__":
    monitor = EyeStrainMonitor()
    monitor.run()