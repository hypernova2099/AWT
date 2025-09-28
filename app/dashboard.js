async function fetchDashboard() {
    const token = localStorage.getItem("token");

    if (!token) {
        alert("You are not logged in!");
        window.location.href = "../loginform/LoginForm.html";
        return;
    }

    try {
        const res = await fetch("http://localhost:8080/dashboard-data", {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await res.json();

        if (res.ok) {
            // Fill dashboard UI
            document.getElementById("burnoutScore").innerText = data.burnoutScore;
            document.getElementById("burnoutLevel").innerText = data.burnoutLevel;
            document.getElementById("workHours").innerText = data.workHours;
            document.getElementById("sessionTime").innerText = data.sessionTime;

            // Make sure HTML id matches
            const eyeEl = document.getElementById("eyeStrainStatus") || document.getElementById("eyeStrain");
            if (eyeEl) eyeEl.innerText = data.eyeStrain;

            console.log("Dashboard data:", data);
        } else {
            alert("Error fetching dashboard: " + data.message);
        }
    } catch (err) {
        console.error(err);
        alert("Fetch error. See console.");
    }
}

// Call this when dashboard loads
fetchDashboard();
