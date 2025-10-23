const token = localStorage.getItem("token");
if (!token) {
  alert("Please login first");
  window.location.href = "login.html";
}

// --- Fetch helper ---
async function fetchData(url) {
  const token = localStorage.getItem("token");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

// --- Dashboard Status ---
async function loadDashboard() {
  const data = await fetchData("http://localhost:8080/dashboard-data");
  document.getElementById("burnoutScore").innerText = data.burnoutScore ?? 0;
  document.getElementById("burnoutLevel").innerText = data.burnoutLevel ?? "Low";
  document.getElementById("workHours").innerText = data.workHours ?? 0;
  document.getElementById("sessionTime").innerText = data.sessionTime ?? 0;
  document.getElementById("eyeStrainStatus").innerText = data.eyeStrain ?? 0;
}

// --- Burnout Chart ---
let burnoutChart;
async function loadBurnoutChart(days = 7) {
  const data = await fetchData(`http://localhost:8080/api/stats/burnout/${days}`);
  const labels = data.map(d => new Date(d.timestamp).toLocaleDateString());
  const scores = data.map(d => d.burnoutScore);

  const ctx = document.getElementById("burnoutChart").getContext("2d");
  if (burnoutChart) burnoutChart.destroy();

  burnoutChart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{ label: "Burnout Score", data: scores, borderColor: "red", backgroundColor: "rgba(255,0,0,0.2)", tension: 0.3 }] },
    options: { responsive: true, scales: { y: { beginAtZero: true, max: 100 } } }
  });
}

// --- Eye Strain Chart ---
let eyeStrainChart;
async function loadEyeStrainChart(days = 7) {
  const data = await fetchData(`http://localhost:8080/api/stats/eyestrain/${days}`);
  const labels = data.map(d => new Date(d.timestamp).toLocaleDateString());
  const values = data.map(d => (d.eyeStrainStatus === "High" ? 1 : 0));

  const ctx = document.getElementById("eyeStrainChart").getContext("2d");
  if (eyeStrainChart) eyeStrainChart.destroy();

  eyeStrainChart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: "High Strain (1=Yes, 0=No)", data: values, backgroundColor: "rgba(255,165,0,0.5)", borderColor: "orange", borderWidth: 1 }] },
    options: { scales: { y: { beginAtZero: true, max: 1 } }, responsive: true }
  });
}

// --- App Usage Chart ---
let appUsageChart;
async function loadAppUsageChart(days = 7) {
  const data = await fetchData(`http://localhost:8080/api/stats/appUsage/${days}`);
  const appMap = {};
  data.forEach(d => appMap[d.appName] = (appMap[d.appName] || 0) + d.usageMinutes);

  const ctx = document.getElementById("appUsageChart").getContext("2d");
  if (appUsageChart) appUsageChart.destroy();

  appUsageChart = new Chart(ctx, {
    type: "bar",
    data: { labels: Object.keys(appMap), datasets: [{ label: "Minutes Used", data: Object.values(appMap), backgroundColor: "rgba(0,123,255,0.5)", borderColor: "blue", borderWidth: 1 }] },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
  });
}

// --- Activity Distribution ---
let activityChart;
async function loadActivityDistribution(days = 7) {
  const data = await fetchData(`http://localhost:8080/api/activity/${days}`);
  const typeMap = {};
  data.forEach(d => typeMap[d.activityType] = (typeMap[d.activityType] || 0) + d.durationMinutes);

  const ctx = document.getElementById("activityDistributionChart").getContext("2d");
  if (activityChart) activityChart.destroy();

  activityChart = new Chart(ctx, {
    type: "doughnut",
    data: { labels: Object.keys(typeMap), datasets: [{ data: Object.values(typeMap), backgroundColor: ["#007bff", "#28a745", "#ffc107", "#dc3545"] }] },
    options: { responsive: true }
  });
}

// --- Recommendations ---
async function loadRecommendations() {
  const recs = await fetchData("http://localhost:8080/api/recommendations");
  const container = document.getElementById("recommendationsList");
  container.innerHTML = "";
  recs.forEach(r => container.appendChild(Object.assign(document.createElement("div"), { className: "recommendation-item", innerText: r.recommendationText })));
}

// --- Event Listeners ---
document.getElementById("burnoutPeriod")?.addEventListener("change", e => loadBurnoutChart(e.target.value));
document.getElementById("appUsagePeriod")?.addEventListener("change", e => loadAppUsageChart(e.target.value));

// --- Initialize Dashboard ---
async function initDashboard() {
  await loadDashboard();
  await loadBurnoutChart();
  await loadEyeStrainChart();
  await loadAppUsageChart();
  await loadActivityDistribution();
  await loadRecommendations();
}
initDashboard();
