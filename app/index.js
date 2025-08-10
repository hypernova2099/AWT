import axios from "axios";

document.getElementById('login-form').addEventListener('submit',async(e)=>{

    e.preventDefault(); //prevents form from reloading

    try {
        const res = await axios.post('http://localhost:8080/login',{
            username: document.getElementById("username").value,
            password: document.getElementById("password").value
        });
        if(res.data.success){
            window.location.href = "dashboard.html";
        }
        else{
            alert("Login failed")
        }

    
    } catch (error) {
        console.error("Login Failed:",error);
        alert("An error occured , Please Try again later!");
    }

    
    
});






    