document.getElementById('login-form').addEventListener('submit',async(e)=>{

    e.preventDefault(); //prevents form from reloading

    const res = await fetch('http://localhost:8080/login',{
        method : "POST",
        headers : {
            "Content-Type" : 'application/json'
        },
        body : JSON.stringify({
            username: document.getElementById('username').value,
            password: document.getElementById('password').value
        })
    });

    const data = await res.json();
    console.log(data);

    if(data.success){
        window.location.href = "dashboard.html";
    }
    else{
        alert("Login failed")
    }
});