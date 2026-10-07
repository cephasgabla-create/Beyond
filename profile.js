const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const videoCount = document.getElementById("videoCount");
const avatar = document.getElementById("avatar");
const myVideos = document.getElementById("myVideos");
const logoutBtn = document.getElementById("logoutBtn");

(async () => {
  const user = await BeyondAuth.requireAuth("login.html");
  if (!user) return;

  const email = user.email || "Beyond User";
  profileName.textContent = email.split("@")[0];
  profileEmail.textContent = email;
  avatar.textContent = email.charAt(0).toUpperCase();

  const { data, error } = await supabaseClient
    .from("videos")
    .select("id, video_url, caption, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    myVideos.innerHTML = '<p class="muted">Could not load your videos.</p>';
    return;
  }

  videoCount.textContent = `${data.length} video${data.length === 1 ? "" : "s"}`;

  if (!data.length) {
    myVideos.innerHTML =
      '<p class="muted">You have not uploaded a video yet.</p>';
    return;
  }

  myVideos.replaceChildren();

  data.forEach(video => {
    const card = document.createElement("article");
    card.className = "profile-video";
    card.innerHTML = `
      <video src="${video.video_url}" controls playsinline preload="metadata"></video>
      <p>${escapeHTML(video.caption || "")}</p>
    `;
    myVideos.appendChild(card);
  });
})();

function escapeHTML(value = "") {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

logoutBtn.addEventListener("click", async () => {
  logoutBtn.disabled = true;
  try {
    await BeyondAuth.logoutBeyond();
  } catch (error) {
    console.error(error);
    logoutBtn.disabled = false;
  }
});
