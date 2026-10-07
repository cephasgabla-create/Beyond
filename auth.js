// Beyond authentication helpers
async function getCurrentUser() {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error) {
    console.error("Beyond auth:", error);
    return null;
  }
  return data.user || null;
}

async function requireAuth(redirectTo = "login.html") {
  const user = await getCurrentUser();

  if (!user) {
    const next = encodeURIComponent(
      window.location.pathname.split("/").pop() || "index.html"
    );
    window.location.href = `${redirectTo}?next=${next}`;
    return null;
  }

  return user;
}

async function logoutBeyond() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
  window.location.href = "login.html";
}

window.BeyondAuth = {
  getCurrentUser,
  requireAuth,
  logoutBeyond
};
