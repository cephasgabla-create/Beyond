const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const signupBtn = document.getElementById("signupBtn");
const authStatus = document.getElementById("authStatus");

signupBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    authStatus.textContent = "Enter your email and password.";
    return;
  }

  if (password.length < 6) {
    authStatus.textContent = "Password must be at least 6 characters.";
    return;
  }

  signupBtn.disabled = true;
  signupBtn.textContent = "Creating...";
  authStatus.textContent = "";

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password
  });

  if (error) {
    authStatus.textContent = error.message;
    signupBtn.disabled = false;
    signupBtn.textContent = "Create account";
    return;
  }

  if (data.session) {
    window.location.href = "index.html";
    return;
  }

  authStatus.textContent =
    "Account created. Check your email to confirm your account, then log in.";
  signupBtn.disabled = false;
  signupBtn.textContent = "Create account";
});
