// dashboard.js
const token = localStorage.getItem("token");
if (!token) {
  alert("Please login first");
  window.location.href = "login.html";
}

// Helper for fetching data with auth token
async function fetchData(url) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

// --- 1️⃣ Current Dashboard Status ---
async function loadDashboard() {
  const data = await fetchData("http://localhost:8080/dashboard-data");

  document.getElementById("burnoutScore").innerText = data.burnoutScore ?? 0;
  document.getElementById("burnoutLevel").innerText = data.burnoutLevel ?? "Low";
  document.getElementById("workHours").innerText = data.workHours ?? 0;
  document.getElementById("sessionTime").innerText = data.sessionTime ?? 0;
  document.getElementById("eyeStrainStatus").innerText = data.eyeStrain ?? 0;
}

// --- 2️⃣ Burnout Trend Chart ---
let burnoutChart;
async function loadBurnoutChart(days = 7) {
  const data = await fetchData(`http://localhost:8080/api/stats/burnout/${days}`);

  const labels = data.map(d => new Date(d.timestamp).toLocaleDateString());
  const scores = data.map(d => d.burnoutScore);

  const ctx = document.getElementById("burnoutChart").getContext("2d");

  if (burnoutChart) burnoutChart.destroy();

  burnoutChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Burnout Score",
        data: scores,
        borderColor: "red",
        backgroundColor: "rgba(255,0,0,0.2)",
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      scales: { y: { beginAtZero: true, max: 100 } }
    }
  });
}

// --- 3️⃣ App Usage Chart ---
let appUsageChart;
async function loadAppUsageChart(days = 7) {
  const data = await fetchData(`http://localhost:8080/api/stats/appUsage/${days}`);

  const appMap = {};
  data.forEach(d => {
    if (!appMap[d.appName]) appMap[d.appName] = 0;
    appMap[d.appName] += d.usageMinutes;
  });

  const labels = Object.keys(appMap);
  const minutes = Object.values(appMap);

  const ctx = document.getElementById("appUsageChart").getContext("2d");

  if (appUsageChart) appUsageChart.destroy();

  appUsageChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Minutes Used",
        data: minutes,
        backgroundColor: "rgba(0,123,255,0.5)",
        borderColor: "blue",
        borderWidth: 1
      }]
    },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
  });
}

// --- 4️⃣ Activity Logs ---
async function loadActivityLogs() {
  const logs = await fetchData("http://localhost:8080/api/activity");
  let ul = document.getElementById("activityLogs");

  // If container doesn't exist, create it dynamically
  if (!ul) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="card-header"><h3>Activity Logs</h3></div>
      <div class="card-content"><ul id="activityLogs"></ul></div>
    `;
    document.querySelector(".container").appendChild(card);
    ul = document.getElementById("activityLogs");
  }

  ul.innerHTML = "";
  logs.forEach(log => {
    const li = document.createElement("li");
    li.innerText = `${new Date(log.timestamp).toLocaleString()} - ${log.activityType} (${log.durationMinutes} min)`;
    ul.appendChild(li);
  });
}

// --- 5️⃣ Recommendations ---
async function loadRecommendations() {
  const recs = await fetchData("http://localhost:8080/api/recommendations");
  const container = document.getElementById("recommendationsList");
  container.innerHTML = "";

  recs.forEach(r => {
    const div = document.createElement("div");
    div.className = "recommendation-item";
    div.innerText = r.recommendationText;
    container.appendChild(div);
  });
}

// --- Event Listeners for Period Selectors ---
document.getElementById("burnoutPeriod").addEventListener("change", e => {
  loadBurnoutChart(e.target.value);
});

document.getElementById("appUsagePeriod").addEventListener("change", e => {
  loadAppUsageChart(e.target.value);
});

// Refresh Recommendations
document.getElementById("refreshRecommendations").addEventListener("click", loadRecommendations);

// --- Initialize Dashboard ---
async function initDashboard() {
  await loadDashboard();
  await loadBurnoutChart();
  await loadAppUsageChart();
  await loadActivityLogs();
  await loadRecommendations();
}

initDashboard();
