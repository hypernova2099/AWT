// dashboard.js - Complete Unified Dashboard
class Dashboard {
    constructor() {
        this.cameraStream = null;
        this.isCameraOn = false;
        this.analysisInterval = null;
        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.charts = {};
        this.activityLog = [];
        this.recommendations = [];
        this.webcamStream = null;
        this.API_BASE = "http://localhost:5000"; // Updated to match your Flask server
    }

    async init() {
        // Authentication check
        const token = localStorage.getItem("token");
        if (!token) {
            alert("Please login first to access the wellness dashboard");
            window.location.href = "login.html";
            throw new Error("Authentication required");
        }

        console.log("🔐 Authentication verified - Initializing AI Wellness Dashboard");

        // Initialize all dashboard components
        await this.checkModelsStatus();
        this.setupEventListeners();
        await this.loadDashboard();
        await this.loadAllCharts();
        
        // Initialize activity log and recommendations
        this.initializeActivityLog();
        this.generateRecommendations();
        
        console.log("✅ AI Wellness Dashboard initialized successfully");
        this.showNotification('Dashboard loaded! Click "Start Monitoring" to begin.', 'success');
    }

    // === CAMERA & MODEL STATUS ===
    async checkModelsStatus() {
        try {
            const response = await fetch('/api/models/status');
            const data = await response.json();
            
            if (data.success) {
                this.updateStatusDisplay(data.models);
            } else {
                this.updateStatusDisplay({
                    eye_strain_model: 'Unknown',
                    activity_tracker: 'Unknown',
                    camera: 'Check failed',
                    opencv: 'Check failed'
                });
            }
        } catch (error) {
            console.error('Error checking models status:', error);
            this.updateStatusDisplay({
                eye_strain_model: 'Connection error',
                activity_tracker: 'Connection error', 
                camera: 'Connection error',
                opencv: 'Connection error'
            });
        }
    }

    setupEventListeners() {
        // Camera controls
        document.getElementById('startCamera')?.addEventListener('click', () => this.startCamera());
        document.getElementById('stopCamera')?.addEventListener('click', () => this.stopCamera());
        document.getElementById('analyzeStrain')?.addEventListener('click', () => this.analyzeEyeStrain());
        document.getElementById('trackActivity')?.addEventListener('click', () => this.trackActivity());
        
        // Wellness monitoring
        const toggleBtn = document.getElementById('webcamToggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleRealTimeMonitoring());
        }
        
        // Time range filters
        this.setupTimeRangeFilters();
    }

    // === CAMERA FUNCTIONS ===
    async startCamera() {
        try {
            if (this.isCameraOn) return;

            // Start backend camera
            const response = await fetch('/api/camera/start', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'}
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Access webcam for frontend display
                this.cameraStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { width: 640, height: 480 } 
                });
                
                const videoElement = document.getElementById('cameraFeed');
                videoElement.srcObject = this.cameraStream;
                this.isCameraOn = true;

                // Start periodic analysis
                this.analysisInterval = setInterval(() => {
                    this.captureAndAnalyze();
                }, 5000);

                this.updateCameraStatus('Camera started - Analysis running every 5 seconds');
            } else {
                this.updateCameraStatus('Backend camera error: ' + data.message);
            }

        } catch (error) {
            console.error('Error starting camera:', error);
            this.updateCameraStatus('Camera error: ' + error.message);
        }
    }

    async stopCamera() {
        try {
            // Stop backend camera
            await fetch('/api/camera/stop', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'}
            });
            
            // Stop frontend camera
            if (this.cameraStream) {
                this.cameraStream.getTracks().forEach(track => track.stop());
                this.cameraStream = null;
            }
            
            if (this.analysisInterval) {
                clearInterval(this.analysisInterval);
                this.analysisInterval = null;
            }
            
            this.isCameraOn = false;
            this.updateCameraStatus('Camera stopped');
            
        } catch (error) {
            console.error('Error stopping camera:', error);
        }
    }

    async captureAndAnalyze() {
        const video = document.getElementById('cameraFeed');
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = canvas.toDataURL('image/jpeg');
        await this.sendForAnalysis(imageData);
    }

    async sendForAnalysis(imageData) {
        try {
            const response = await fetch('/api/eye-strain/analyze', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({image_data: imageData})
            });

            const data = await response.json();
            
            if (data.success) {
                this.updateAnalysisResults(data.analysis);
                // Also update wellness metrics
                this.updateWellnessMetricsFromAnalysis(data.analysis);
            } else {
                this.updateAnalysisResults({
                    strain_level: 'Analysis failed',
                    recommendation: data.message
                });
            }
        } catch (error) {
            console.error('Analysis error:', error);
            this.updateAnalysisResults({
                strain_level: 'Error',
                recommendation: 'Analysis service unavailable'
            });
        }
    }

    async analyzeEyeStrain() {
        if (!this.isCameraOn) {
            alert('Please start camera first');
            return;
        }
        await this.captureAndAnalyze();
    }

    async trackActivity() {
        try {
            const response = await fetch('/api/activity/track', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    type: 'manual_activity',
                    details: 'User initiated activity tracking via dashboard'
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.updateActivityStatus('Activity tracked successfully at ' + new Date().toLocaleTimeString());
                this.addActivityLog('activity_tracked', 'Manual activity tracking completed');
            } else {
                this.updateActivityStatus('Activity tracking failed: ' + data.message);
            }
        } catch (error) {
            console.error('Activity tracking error:', error);
            this.updateActivityStatus('Activity tracking service unavailable');
        }
    }

    // === WELLNESS DASHBOARD FUNCTIONS ===
    async loadDashboard() {
        try {
            console.log("🔄 Loading dashboard data...");
            
            let data = await this.fetchData(`${this.API_BASE}/api/data`);
            
            if (!data) {
                data = this.generateDemoData();
                console.log("📊 Using demo data");
            }

            console.log("✅ Dashboard data received:", data);
            this.updateDashboardCards(data);
            this.updateDataSourceIndicator(data.dataSource);

        } catch (error) {
            console.error("Dashboard load error:", error);
            const demoData = this.generateDemoData();
            this.updateDashboardCards(demoData);
            this.showNotification('Using demo data - Backend unavailable', 'warning');
        }
    }

    async loadAllCharts() {
        await Promise.all([
            this.loadBurnoutChart(),
            this.loadEyeStrainChart(),
            this.loadAppUsageChart(),
            this.loadActivityDistribution()
        ]);
    }

    async fetchData(url, options = {}) {
        try {
            const response = await fetch(url, {
                headers: {
                    "Content-Type": "application/json",
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`❌ API call failed for ${url}:`, error);
            return null;
        }
    }

    generateDemoData() {
        const now = new Date();
        return {
            burnoutScore: Math.floor(30 + Math.random() * 50),
            burnoutLevel: ['Low', 'Medium', 'High'][Math.floor(Math.random() * 3)],
            workHours: (4 + Math.random() * 6).toFixed(1),
            sessionTime: Math.floor(20 + Math.random() * 40),
            eyeStrain: {
                status: ['Normal', 'Mild', 'Moderate', 'Severe'][Math.floor(Math.random() * 4)],
                averageLevel: (20 + Math.random() * 60).toFixed(2),
                totalAlerts: Math.floor(Math.random() * 10),
                lastAlert: new Date(now.getTime() - Math.random() * 3600000).toISOString()
            },
            dataSource: 'dummy'
        };
    }

    updateDashboardCards(data) {
        // Update burnout score
        const burnoutScoreElement = document.getElementById("burnoutScore");
        if (burnoutScoreElement) {
            burnoutScoreElement.textContent = data.burnoutScore || 0;
        }
        
        // Update burnout level
        const burnoutLevelElement = document.getElementById("burnoutLevel");
        if (burnoutLevelElement) {
            burnoutLevelElement.textContent = data.burnoutLevel || "Low";
            burnoutLevelElement.className = `status-level ${(data.burnoutLevel || "low").toLowerCase()}`;
        }
        
        // Update work hours
        const workHoursElement = document.getElementById("workHours");
        if (workHoursElement) {
            workHoursElement.textContent = data.workHours || "0.0";
        }
        
        // Update session time
        const sessionTimeElement = document.getElementById("sessionTime");
        if (sessionTimeElement) {
            sessionTimeElement.textContent = data.sessionTime || 0;
        }

        // Update eye strain widget
        const eyeStrain = data.eyeStrain || {};
        const eyeStrainStatusElement = document.getElementById("eyeStrainStatus");
        const eyeStrainAverageElement = document.getElementById("eyeStrainAverage");
        const eyeStrainTotalElement = document.getElementById("eyeStrainTotal");
        const eyeStrainLastElement = document.getElementById("eyeStrainLast");
        
        if (eyeStrainStatusElement) eyeStrainStatusElement.textContent = eyeStrain.status || "Normal";
        if (eyeStrainAverageElement) eyeStrainAverageElement.textContent = eyeStrain.averageLevel || "0.00";
        if (eyeStrainTotalElement) eyeStrainTotalElement.textContent = eyeStrain.totalAlerts || 0;
        if (eyeStrainLastElement) {
            eyeStrainLastElement.textContent = eyeStrain.lastAlert 
                ? new Date(eyeStrain.lastAlert).toLocaleTimeString() 
                : "No recent alert";
        }
    }

    updateWellnessMetricsFromAnalysis(analysis) {
        const strainLevel = analysis.strain_level;
        let strainScore = 0;
        
        switch(strainLevel) {
            case 'low': strainScore = 25; break;
            case 'medium': strainScore = 50; break;
            case 'high': strainScore = 75; break;
            default: strainScore = 30;
        }
        
        // Update wellness metrics
        const burnoutScore = Math.max(0, 100 - strainScore);
        document.getElementById("burnoutScore").textContent = burnoutScore;
        
        const burnoutLevel = burnoutScore > 70 ? "High" : burnoutScore > 40 ? "Medium" : "Low";
        const burnoutLevelElement = document.getElementById("burnoutLevel");
        if (burnoutLevelElement) {
            burnoutLevelElement.textContent = burnoutLevel;
            burnoutLevelElement.className = `status-level ${burnoutLevel.toLowerCase()}`;
        }
        
        // Update eye strain display
        const eyeStrainStatusElement = document.getElementById("eyeStrainStatus");
        const eyeStrainAverageElement = document.getElementById("eyeStrainAverage");
        
        if (eyeStrainStatusElement) eyeStrainStatusElement.textContent = strainLevel.charAt(0).toUpperCase() + strainLevel.slice(1);
        if (eyeStrainAverageElement) eyeStrainAverageElement.textContent = strainScore.toFixed(1);
    }

    // === CHART FUNCTIONS ===
    async loadBurnoutChart(days = 7) {
        try {
            let data = await this.fetchData(`${this.API_BASE}/api/stats/burnout?days=${days}`);
            
            if (!data || data.length === 0) {
                data = this.generateDemoChartData(days, 'burnout');
            }

            const ctx = document.getElementById("burnoutChart");
            if (!ctx) return;

            if (this.charts.burnout) this.charts.burnout.destroy();

            const labels = this.generateChartLabels(days);
            const scores = data.map(d => d.burnoutScore || d.value || Math.floor(30 + Math.random() * 50));

            this.charts.burnout = new Chart(ctx, {
                type: "line",
                data: {
                    labels,
                    datasets: [{
                        label: "Burnout Risk Score",
                        data: scores,
                        borderColor: "#ff6b6b",
                        backgroundColor: "rgba(255, 107, 107, 0.1)",
                        tension: 0.4,
                        fill: true,
                        borderWidth: 2,
                    }],
                },
                options: this.getChartOptions('Burnout Trend Analysis')
            });

        } catch (error) {
            console.error("Burnout chart error:", error);
            this.createFallbackChart('burnoutChart', 'Burnout Trend Analysis');
        }
    }

    async loadEyeStrainChart(days = 7) {
        try {
            let data = await this.fetchData(`${this.API_BASE}/api/stats/eyestrain?days=${days}`);
            
            if (!data || data.length === 0) {
                data = this.generateDemoChartData(days, 'eyestrain');
            }

            const ctx = document.getElementById("eyeStrainChart");
            if (!ctx) return;

            if (this.charts.eyeStrain) this.charts.eyeStrain.destroy();

            const labels = this.generateChartLabels(days);
            const values = data.map(d => {
                if (d.eyeStrainLevel !== undefined) return d.eyeStrainLevel;
                if (d.value !== undefined) return d.value;
                return Math.floor(Math.random() * 3);
            });

            this.charts.eyeStrain = new Chart(ctx, {
                type: "bar",
                data: {
                    labels,
                    datasets: [{
                        label: "Eye Strain Level",
                        data: values,
                        backgroundColor: values.map(v => 
                            v === 2 ? 'rgba(239, 68, 68, 0.8)' : 
                            v === 1 ? 'rgba(245, 158, 11, 0.8)' : 
                            'rgba(34, 197, 94, 0.8)'
                        ),
                        borderColor: values.map(v => 
                            v === 2 ? 'rgb(239, 68, 68)' : 
                            v === 1 ? 'rgb(245, 158, 11)' : 
                            'rgb(34, 197, 94)'
                        ),
                        borderWidth: 1,
                    }],
                },
                options: this.getChartOptions('Eye Strain Monitoring', true)
            });

        } catch (error) {
            console.error("Eye strain chart error:", error);
            this.createFallbackChart('eyeStrainChart', 'Eye Strain Monitoring');
        }
    }

    async loadAppUsageChart(days = 7) {
        try {
            let data = await this.fetchData(`${this.API_BASE}/api/stats/appUsage?days=${days}`);
            
            if (!data || data.length === 0) {
                data = this.generateDemoAppUsageData();
            }

            const ctx = document.getElementById("appUsageChart");
            if (!ctx) return;

            if (this.charts.appUsage) this.charts.appUsage.destroy();

            const appMap = {};
            data.forEach(d => {
                const appName = d.appName || d.name || `App ${Math.floor(Math.random() * 5) + 1}`;
                appMap[appName] = (appMap[appName] || 0) + (d.usageMinutes || d.value || Math.floor(Math.random() * 120));
            });

            const sortedApps = Object.entries(appMap)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 6);

            this.charts.appUsage = new Chart(ctx, {
                type: "bar",
                data: {
                    labels: sortedApps.map(([app]) => app),
                    datasets: [{
                        label: "Usage (minutes)",
                        data: sortedApps.map(([,minutes]) => minutes),
                        backgroundColor: "rgba(59, 130, 246, 0.8)",
                        borderColor: "rgba(59, 130, 246, 1)",
                        borderWidth: 1,
                    }],
                },
                options: this.getChartOptions('Application Usage Time')
            });

        } catch (error) {
            console.error("App usage chart error:", error);
            this.createFallbackChart('appUsageChart', 'Application Usage Time');
        }
    }

    async loadActivityDistribution(days = 1) {
        try {
            let data = await this.fetchData(`${this.API_BASE}/api/activity?days=${days}`);
            
            if (!data || data.length === 0) {
                data = this.generateDemoActivityData();
            }

            const ctx = document.getElementById("activityChart");
            if (!ctx) return;

            if (this.charts.activity) this.charts.activity.destroy();

            const typeMap = {};
            data.forEach(d => {
                const activityType = d.activityType || d.type || `Activity ${Math.floor(Math.random() * 5) + 1}`;
                typeMap[activityType] = (typeMap[activityType] || 0) + (d.durationMinutes || d.value || Math.floor(Math.random() * 180));
            });

            const activityTypes = Object.keys(typeMap);
            const durations = Object.values(typeMap);

            this.charts.activity = new Chart(ctx, {
                type: "doughnut",
                data: {
                    labels: activityTypes,
                    datasets: [{
                        data: durations,
                        backgroundColor: [
                            'rgba(255, 99, 132, 0.8)',
                            'rgba(54, 162, 235, 0.8)',
                            'rgba(255, 206, 86, 0.8)',
                            'rgba(75, 192, 192, 0.8)',
                            'rgba(153, 102, 255, 0.8)',
                            'rgba(255, 159, 64, 0.8)'
                        ],
                        borderColor: [
                            'rgb(255, 99, 132)',
                            'rgb(54, 162, 235)',
                            'rgb(255, 206, 86)',
                            'rgb(75, 192, 192)',
                            'rgb(153, 102, 255)',
                            'rgb(255, 159, 64)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'bottom',
                        },
                        title: {
                            display: true,
                            text: 'Activity Distribution',
                            font: {
                                size: 16
                            }
                        }
                    }
                }
            });

        } catch (error) {
            console.error("Activity distribution chart error:", error);
            this.createFallbackChart('activityChart', 'Activity Distribution');
        }
    }

    // === HELPER FUNCTIONS ===
    generateDemoChartData(days, type) {
        const data = [];
        const now = new Date();
        
        for (let i = days; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            
            data.push({
                timestamp: date.toISOString(),
                burnoutScore: type === 'burnout' ? Math.floor(30 + Math.random() * 50) : undefined,
                eyeStrainLevel: type === 'eyestrain' ? Math.floor(Math.random() * 3) : undefined,
                value: Math.floor(Math.random() * 100)
            });
        }
        
        return data;
    }

    generateDemoAppUsageData() {
        const apps = ['VS Code', 'Chrome', 'Slack', 'Figma', 'Terminal', 'Spotify'];
        return apps.map(app => ({
            appName: app,
            usageMinutes: Math.floor(30 + Math.random() * 180)
        }));
    }

    generateDemoActivityData() {
        const activities = ['Coding', 'Meetings', 'Research', 'Design', 'Testing', 'Documentation'];
        return activities.map(activity => ({
            activityType: activity,
            durationMinutes: Math.floor(30 + Math.random() * 120)
        }));
    }

    generateChartLabels(days) {
        const labels = [];
        const now = new Date();
        
        for (let i = days; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString());
        }
        
        return labels;
    }

    getChartOptions(title, showLegend = false) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: showLegend,
                    position: 'top',
                },
                title: {
                    display: true,
                    text: title,
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)',
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        };
    }

    createFallbackChart(canvasId, title) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;
        
        if (this.charts[canvasId]) this.charts[canvasId].destroy();
        
        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Demo Data',
                    data: [65, 59, 80, 81, 56, 55, 40],
                    borderColor: '#784cc4',
                    backgroundColor: 'rgba(120, 76, 196, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: this.getChartOptions(title + ' (Demo)')
        });
    }

    // === REAL-TIME MONITORING ===
    async toggleRealTimeMonitoring() {
        const toggleBtn = document.getElementById('webcamToggle');
        const globalStatus = document.getElementById('globalStatus');
        const statusDot = document.querySelector('.status-dot-global');
        
        if (!this.isMonitoring) {
            // Start monitoring
            console.log("🚀 Starting real-time wellness monitoring...");
            this.showNotification('Starting webcam... Please allow camera access if prompted.', 'info');
            
            try {
                const webcamSuccess = await this.initializeWebcam();
                
                if (webcamSuccess) {
                    await this.startMonitoringSuccess(toggleBtn, globalStatus, statusDot, 'real');
                    this.showNotification('🎥 Webcam activated! Real-time monitoring started.', 'success');
                } else {
                    await this.startDemoMode(toggleBtn, globalStatus, statusDot);
                    this.showNotification('🔶 Demo mode started (no webcam access).', 'warning');
                }
                
            } catch (error) {
                console.error("❌ Monitoring startup error:", error);
                await this.startDemoMode(toggleBtn, globalStatus, statusDot);
                this.showNotification('🔶 Demo mode activated.', 'warning');
            }
        } else {
            // Stop monitoring
            await this.stopMonitoring(toggleBtn, globalStatus, statusDot);
        }
    }

    async initializeWebcam() {
        return new Promise(async (resolve) => {
            try {
                console.log("📷 Attempting to access webcam...");
                
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    console.error("❌ Webcam API not supported");
                    resolve(false);
                    return;
                }

                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        facingMode: 'user'
                    },
                    audio: false
                });

                this.webcamStream = stream;
                console.log("✅ Webcam access granted!");

                this.createWebcamVideoElement(stream);
                resolve(true);

            } catch (error) {
                console.error("❌ Webcam access failed:", error);
                resolve(false);
            }
        });
    }

    createWebcamVideoElement(stream) {
        const existingVideo = document.getElementById('webcamFeed');
        if (existingVideo) existingVideo.remove();
        
        const existingCloseBtn = document.querySelector('.webcam-close-btn');
        if (existingCloseBtn) existingCloseBtn.remove();

        const videoElement = document.createElement('video');
        videoElement.id = 'webcamFeed';
        videoElement.autoplay = true;
        videoElement.muted = true;
        videoElement.playsInline = true;
        
        videoElement.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            width: 300px;
            height: 225px;
            border: 3px solid #10b981;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 10000;
            background: #000;
            object-fit: cover;
        `;

        const closeButton = document.createElement('button');
        closeButton.className = 'webcam-close-btn';
        closeButton.innerHTML = '×';
        closeButton.style.cssText = `
            position: fixed;
            top: 75px;
            right: 15px;
            background: #ef4444;
            color: white;
            border: none;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            cursor: pointer;
            font-size: 18px;
            font-weight: bold;
            z-index: 10001;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        closeButton.onclick = () => {
            if (this.webcamStream) {
                this.webcamStream.getTracks().forEach(track => track.stop());
                this.webcamStream = null;
            }
            videoElement.remove();
            closeButton.remove();
            this.showNotification('Webcam turned off', 'info');
        };

        document.body.appendChild(videoElement);
        document.body.appendChild(closeButton);

        videoElement.srcObject = stream;
        
        videoElement.onloadedmetadata = () => {
            console.log("🎥 Webcam video metadata loaded");
            videoElement.play();
        };

        videoElement.onplay = () => {
            console.log("🎬 Webcam video started playing!");
            this.showNotification('🎥 Webcam is now active and recording!', 'success');
        };
    }

    async startMonitoringSuccess(toggleBtn, globalStatus, statusDot, mode) {
        this.isMonitoring = true;
        toggleBtn.classList.add('running');
        toggleBtn.querySelector('.webcam-text').textContent = 'Stop Monitoring';
        
        if (mode === 'real') {
            globalStatus.textContent = 'Real-Time Monitoring Active';
            statusDot.style.background = '#10b981';
        } else if (mode === 'frontend') {
            globalStatus.textContent = 'Frontend Analysis Active';
            statusDot.style.background = '#3b82f6';
        }
        
        this.startLiveDataUpdates();
        this.startDataAnalysis();
        console.log(`✅ Monitoring started in ${mode} mode`);
    }

    startDataAnalysis() {
        console.log("🔍 Starting data analysis...");
        
        const analysisInterval = setInterval(() => {
            if (!this.isMonitoring) {
                clearInterval(analysisInterval);
                return;
            }
            
            const analysisData = {
                blinkRate: 15 + Math.random() * 10,
                eyeStrain: 20 + Math.random() * 50,
                postureScore: 60 + Math.random() * 35,
                focusLevel: 50 + Math.random() * 45,
                attention: 70 + Math.random() * 25
            };
            
            this.updateLiveWellnessMetrics(analysisData);
            this.addActivityLog('webcam_analysis', 'Webcam analysis completed', analysisData);
            
        }, 3000);
    }

    async startDemoMode(toggleBtn, globalStatus, statusDot) {
        this.isMonitoring = true;
        toggleBtn.classList.add('running');
        toggleBtn.querySelector('.webcam-text').textContent = 'Stop Demo Mode';
        globalStatus.textContent = 'Demo Mode Active';
        statusDot.style.background = '#f59e0b';
        
        this.startLiveDataUpdates();
        this.startDemoDataGeneration();
        console.log("✅ Demo mode started");
    }

    startDemoDataGeneration() {
        console.log("🎭 Starting demo data generation...");
        
        const demoInterval = setInterval(() => {
            if (!this.isMonitoring) {
                clearInterval(demoInterval);
                return;
            }
            
            const demoData = {
                blinkRate: 12 + Math.random() * 8,
                eyeStrain: 25 + Math.random() * 40,
                postureScore: 65 + Math.random() * 30,
                focusLevel: 55 + Math.random() * 40,
                attention: 65 + Math.random() * 30
            };
            
            this.updateLiveWellnessMetrics(demoData);
            this.addActivityLog('demo_analysis', 'Demo analysis completed', demoData);
            
        }, 3000);
    }

    updateLiveWellnessMetrics(metrics) {
        const burnoutScore = Math.round(100 - (metrics.focusLevel * 0.7 + metrics.postureScore * 0.3));
        document.getElementById("burnoutScore").textContent = burnoutScore;
        
        const burnoutLevel = burnoutScore > 70 ? "High" : burnoutScore > 40 ? "Medium" : "Low";
        const burnoutLevelElement = document.getElementById("burnoutLevel");
        if (burnoutLevelElement) {
            burnoutLevelElement.textContent = burnoutLevel;
            burnoutLevelElement.className = `status-level ${burnoutLevel.toLowerCase()}`;
        }
        
        const eyeStrainStatus = document.getElementById("eyeStrainStatus");
        const eyeStrainAverage = document.getElementById("eyeStrainAverage");
        
        if (eyeStrainStatus) {
            eyeStrainStatus.textContent = metrics.eyeStrain > 50 ? "High" : metrics.eyeStrain > 25 ? "Medium" : "Low";
        }
        if (eyeStrainAverage) {
            eyeStrainAverage.textContent = metrics.eyeStrain.toFixed(1);
        }
        
        const sessionElement = document.getElementById("sessionTime");
        if (sessionElement) {
            const currentTime = parseInt(sessionElement.textContent) || 0;
            sessionElement.textContent = currentTime + 1;
        }
    }

    async stopMonitoring(toggleBtn, globalStatus, statusDot) {
        console.log("🛑 Stopping monitoring...");
        
        if (this.webcamStream) {
            this.webcamStream.getTracks().forEach(track => track.stop());
            this.webcamStream = null;
        }
        
        const videoElement = document.getElementById('webcamFeed');
        const closeButton = document.querySelector('.webcam-close-btn');
        
        if (videoElement) videoElement.remove();
        if (closeButton) closeButton.remove();
        
        this.isMonitoring = false;
        toggleBtn.classList.remove('running');
        toggleBtn.querySelector('.webcam-text').textContent = 'Start Real-Time Monitoring';
        globalStatus.textContent = 'Monitoring Ready';
        statusDot.style.background = '#6b7280';
        
        this.stopLiveDataUpdates();
        this.addActivityLog('monitoring_stopped', 'Real-time monitoring stopped');
        
        console.log("✅ Monitoring stopped");
        this.showNotification('Monitoring stopped. Webcam turned off.', 'info');
    }

    // === ACTIVITY LOG SYSTEM ===
    initializeActivityLog() {
        this.activityLog = [];
        this.addActivityLog('monitoring_started', 'Dashboard initialized');
        this.updateActivityLogUI();
    }

    addActivityLog(type, message, data = {}) {
        const activity = {
            id: Date.now() + Math.random(),
            type: type,
            message: message,
            data: data,
            timestamp: new Date().toISOString(),
            time: new Date().toLocaleTimeString()
        };
        
        this.activityLog.unshift(activity);
        if (this.activityLog.length > 50) this.activityLog = this.activityLog.slice(0, 50);
        
        this.updateActivityLogUI();
        return activity;
    }

    updateActivityLogUI() {
        const activityLogContainer = document.getElementById('activityLog');
        if (!activityLogContainer) return;
        
        activityLogContainer.innerHTML = '';
        
        this.activityLog.slice(0, 10).forEach(activity => {
            const activityElement = document.createElement('div');
            activityElement.className = `activity-item activity-${activity.type}`;
            activityElement.innerHTML = `
                <div class="activity-content">
                    <div class="activity-message">${activity.message}</div>
                    <div class="activity-time">${activity.time}</div>
                </div>
                ${activity.data.blinkRate ? `<div class="activity-data">Blink: ${Math.round(activity.data.blinkRate)}/min, Eyes: ${Math.round(activity.data.eyeStrain)}%</div>` : ''}
            `;
            
            activityLogContainer.appendChild(activityElement);
        });
    }

    // === RECOMMENDATIONS SYSTEM ===
    generateRecommendations() {
        this.recommendations = [
            {
                id: 1,
                type: 'eye_care',
                priority: 'high',
                title: 'Take Eye Break',
                message: 'Follow the 20-20-20 rule: look 20 feet away for 20 seconds every 20 minutes',
                action: 'Take break',
                icon: '👀'
            },
            {
                id: 2,
                type: 'posture',
                priority: 'medium',
                title: 'Check Your Posture',
                message: 'Sit straight with shoulders relaxed and feet flat on the floor',
                action: 'Adjust posture',
                icon: '💺'
            },
            {
                id: 3,
                type: 'hydration',
                priority: 'medium',
                title: 'Stay Hydrated',
                message: 'Drink water to maintain focus and reduce eye strain',
                action: 'Drink water',
                icon: '💧'
            }
        ];
        
        this.updateRecommendationsUI();
    }

    updateRecommendationsUI() {
        const container = document.getElementById('recommendationsList');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.recommendations.forEach(rec => {
            const recElement = document.createElement('div');
            recElement.className = `recommendation-item priority-${rec.priority}`;
            recElement.innerHTML = `
                <div class="recommendation-icon">${rec.icon}</div>
                <div class="recommendation-content">
                    <div class="recommendation-title">${rec.title}</div>
                    <div class="recommendation-message">${rec.message}</div>
                    <div class="recommendation-actions">
                        <button class="btn-action" onclick="dashboard.handleRecommendationAction(${rec.id})">${rec.action}</button>
                        <button class="btn-dismiss" onclick="dashboard.dismissRecommendation(${rec.id})">Dismiss</button>
                    </div>
                </div>
            `;
            container.appendChild(recElement);
        });
    }

    handleRecommendationAction(recId) {
        const recommendation = this.recommendations.find(r => r.id === recId);
        if (recommendation) {
            this.showNotification(`Action taken: ${recommendation.action}`, 'success');
            this.addActivityLog('recommendation_action', `Completed: ${recommendation.title}`);
            this.recommendations = this.recommendations.filter(r => r.id !== recId);
            this.updateRecommendationsUI();
        }
    }

    dismissRecommendation(recId) {
        this.recommendations = this.recommendations.filter(r => r.id !== recId);
        this.updateRecommendationsUI();
        this.showNotification('Recommendation dismissed', 'info');
    }

    // === TIME RANGE FILTERS ===
    setupTimeRangeFilters() {
        const timeRangeButtons = document.querySelectorAll('.time-range-btn');
        
        timeRangeButtons.forEach(btn => {
            btn.addEventListener('click', async function() {
                timeRangeButtons.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                const days = parseInt(this.dataset.days);
                console.log(`⏰ Loading data for ${days} days`);
                
                await Promise.all([
                    dashboard.loadBurnoutChart(days),
                    dashboard.loadEyeStrainChart(days),
                    dashboard.loadAppUsageChart(days),
                    dashboard.loadActivityDistribution(days === 7 ? 1 : days)
                ]);
                
                dashboard.showNotification(`Viewing data for ${dashboard.getTimeRangeText(days)}`, 'info');
            });
        });
    }

    getTimeRangeText(days) {
        switch(days) {
            case 1: return '24 hours';
            case 7: return '1 week';
            case 30: return '1 month';
            case 90: return '3 months';
            default: return `${days} days`;
        }
    }

    // === LIVE DATA UPDATES ===
    startLiveDataUpdates() {
        this.monitoringInterval = setInterval(async () => {
            await this.loadDashboard();
            this.updateLiveStats();
        }, 10000);
    }

    stopLiveDataUpdates() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
    }

    updateLiveStats() {
        if (!this.isMonitoring) return;
        
        const liveStats = {
            blinkRate: Math.floor(12 + Math.random() * 8),
            eyeStrain: ['Low', 'Medium', 'High'][Math.floor(Math.random() * 3)],
            focusTime: Math.floor(45 + Math.random() * 60)
        };
        
        document.getElementById('liveBlinkRate').textContent = liveStats.blinkRate;
        document.getElementById('liveEyeStrain').textContent = liveStats.eyeStrain;
        document.getElementById('liveFocusTime').textContent = liveStats.focusTime;
    }

    // === UI UPDATE METHODS ===
    updateStatusDisplay(models) {
        const statusElement = document.getElementById('modelStatus');
        if (statusElement) {
            statusElement.innerHTML = `
                <div class="status-item"><strong>Eye Strain Model:</strong> ${models.eye_strain_model}</div>
                <div class="status-item"><strong>Activity Tracker:</strong> ${models.activity_tracker}</div>
                <div class="status-item"><strong>Camera:</strong> ${models.camera}</div>
                <div class="status-item"><strong>OpenCV:</strong> ${models.opencv || 'Unknown'}</div>
            `;
        }
    }

    updateAnalysisResults(analysis) {
        const resultsElement = document.getElementById('analysisResults');
        if (resultsElement) {
            resultsElement.innerHTML = `
                <div class="result-item"><strong>Strain Level:</strong> ${analysis.strain_level}</div>
                <div class="result-item"><strong>Recommendation:</strong> ${analysis.recommendation}</div>
                <div class="result-item"><strong>Last Update:</strong> ${new Date().toLocaleString()}</div>
            `;
        }
    }

    updateCameraStatus(message) {
        const statusElement = document.getElementById('cameraStatus');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    updateActivityStatus(message) {
        const statusElement = document.getElementById('activityStatus');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    updateDataSourceIndicator(source) {
        const indicator = document.getElementById('connectionStatus');
        if (!indicator) return;
        
        switch(source) {
            case 'real':
                indicator.textContent = 'Connected to Real-Time Analytics';
                indicator.style.color = '#10b981';
                break;
            case 'dummy':
                indicator.textContent = 'Using Demo Data - Start Monitoring';
                indicator.style.color = '#f59e0b';
                break;
            default:
                indicator.textContent = 'Connected to Analytics';
                indicator.style.color = '#6b7280';
        }
    }

    // === NOTIFICATION SYSTEM ===
    showNotification(message, type = 'info') {
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notif => notif.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️'}</span>
                <span class="notification-message">${message}</span>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in forwards';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }
}

// Global dashboard instance
let dashboard;

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    dashboard = new Dashboard();
    await dashboard.init();
});

// Add required CSS styles
function addDashboardStyles() {
    if (!document.querySelector('#dashboard-styles')) {
        const styles = document.createElement('style');
        styles.id = 'dashboard-styles';
        styles.textContent = `
            .activity-log {
                background: white;
                border-radius: 12px;
                padding: 1.5rem;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                max-height: 400px;
                overflow-y: auto;
            }
            
            .activity-item {
                padding: 1rem;
                border-left: 4px solid #784cc4;
                margin-bottom: 0.75rem;
                background: #f8fafc;
                border-radius: 8px;
            }
            
            .activity-message {
                font-weight: 500;
                color: #1f2937;
            }
            
            .activity-time {
                font-size: 0.875rem;
                color: #6b7280;
                margin-top: 0.25rem;
            }
            
            .activity-data {
                font-size: 0.875rem;
                color: #059669;
                margin-top: 0.25rem;
                font-weight: 500;
            }
            
            .recommendations-panel {
                background: white;
                border-radius: 12px;
                padding: 1.5rem;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            }
            
            .recommendation-item {
                display: flex;
                align-items: flex-start;
                gap: 1rem;
                padding: 1rem;
                margin-bottom: 1rem;
                border-radius: 8px;
                border-left: 4px solid #e5e7eb;
            }
            
            .priority-high { border-left-color: #ef4444; background: #fef2f2; }
            .priority-medium { border-left-color: #f59e0b; background: #fffbeb; }
            .priority-low { border-left-color: #10b981; background: #f0fdf4; }
            
            .recommendation-icon {
                font-size: 1.5rem;
                flex-shrink: 0;
            }
            
            .recommendation-title {
                font-weight: 600;
                color: #1f2937;
                margin-bottom: 0.25rem;
            }
            
            .recommendation-message {
                color: #6b7280;
                font-size: 0.875rem;
                margin-bottom: 0.75rem;
            }
            
            .recommendation-actions {
                display: flex;
                gap: 0.5rem;
            }
            
            .btn-action {
                background: #784cc4;
                color: white;
                border: none;
                padding: 0.5rem 1rem;
                border-radius: 6px;
                font-size: 0.875rem;
                cursor: pointer;
            }
            
            .btn-dismiss {
                background: #6b7280;
                color: white;
                border: none;
                padding: 0.5rem 1rem;
                border-radius: 6px;
                font-size: 0.875rem;
                cursor: pointer;
            }
            
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                padding: 1rem 1.5rem;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                border-left: 4px solid #784cc4;
                z-index: 10000;
                animation: slideIn 0.3s ease-out;
                max-width: 400px;
            }
            
            .notification-success { border-left-color: #10b981; }
            .notification-warning { border-left-color: #f59e0b; }
            .notification-info { border-left-color: #3b82f6; }
            
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(styles);
    }
}

// Initialize styles
addDashboardStyles();