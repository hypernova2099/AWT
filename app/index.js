const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Prevent the form from reloading the page

  
    const res = await fetch('http://localhost:8080/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
      }),
    });

    const data = await res.json(); 

    if (data.success) {
      window.location.href = "../dashboard.html";
    } else {
      alert("Login failed");
    }
  });
}

const signupForm = document.getElementById('signupform');
if (signupForm) {
  signupForm.addEventListener('submit',async(e)=>{
    e.preventDefault();

    const res = await fetch('http://localhost:8080/register',{
      method: "POST",
      headers: { 'Content-Type': 'application/json'},
      body: JSON.stringify({
        name : document.getElementById('Name').value,
        username: document.getElementById('username').value,
        email: document.getElementById('email').value,
        password: document.getElementById('password').value
      })
    });

    const data = await res.json();
    alert(data.message);

    if(res.ok){
      window.location.href = "LoginForm.html";
    }

  });
}