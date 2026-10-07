const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const authStatus = document.getElementById("authStatus");

const params = new URLSearchParams(window.location.search);
const nextPage = params.get("next") || "index.html";

loginBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    authStatus.textContent = "Enter your email and password.";
    return;
  }

  loginBtn.disabled = true;
  loginBtn.textContent = "Logging in...";
  authStatus.textContent = "";

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    authStatus.textContent = error.message;
    loginBtn.disabled = false;
    loginBtn.textContent = "Log in";
    return;
  }

  window.location.href = nextPage;
});
