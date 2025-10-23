import { app , BrowserWindow } from 'electron';
import { spawn } from 'child_process';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


let estProcess;
let activityProcess;

function startPythonTrackers(){
  const pythonPath = "python3";
  const estScript = path.join(__dirname, "python/EST/ESTV4.py");
  const activityScript = path.join(__dirname, "python/Activity_tracker/atv3.py");

  estProcess = spawn(pythonPath, [estScript , "--headless" , "--silent"], { stdio: "inherit" });
  console.log("👁️ Eye Strain Tracker started");

  estProcess.on("exit", (code) => {
    console.log(`Eye Strain Tracker exited with code ${code}`);
    // Restart automatically
    setTimeout(startPythonTrackers, 5000);
  });

  activityProcess = spawn(pythonPath, [activityScript], { stdio: "inherit" });
  console.log("⌨️ Activity Tracker started");

  activityProcess.on("exit", (code) => {
    console.log(`Activity Tracker exited with code ${code}`);
    setTimeout(startPythonTrackers, 5000);
  });
}

function stopPythonTrackers() {
  console.log("🛑 Stopping Python trackers...");
  if (estProcess && !estProcess.killed) {
    estProcess.kill("SIGTERM");
  }
  if (activityProcess && !activityProcess.killed) {
    activityProcess.kill("SIGTERM");
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
  });

  win.loadFile(path.join(__dirname, 'loginform', 'LoginForm.html'));
}

app.whenReady().then(()=>{
  startPythonTrackers();
  createWindow();
  app.on("before-quit", () => {
    stopPythonTrackers();
  });

});

app.on("window-all-closed", () => {
  stopPythonTrackers();
  if (process.platform !== "darwin") {
    app.quit();
  }
});