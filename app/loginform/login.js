async function login(username, password) {
    try {
        const res = await fetch("http://localhost:8080/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (data.success) {
            // ✅ Store the JWT token locally
            localStorage.setItem("token", data.token);

            // Go to dashboard page
            window.location.href = "../dashboard.html";
        } else {
            alert("Login failed: " + data.message);
        }
    } catch (err) {
        console.error(err);
        alert("Login error. See console.");
    }
}
