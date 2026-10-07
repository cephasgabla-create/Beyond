const profileName = document.getElementById("profileName");
const profileUsername = document.getElementById("profileUsername");
const profileBio = document.getElementById("profileBio");
const videoCount = document.getElementById("videoCount");
const followerCount = document.getElementById("followerCount");
const followingCount = document.getElementById("followingCount");
const avatar = document.getElementById("avatar");
const myVideos = document.getElementById("myVideos");
const logoutBtn = document.getElementById("logoutBtn");
const usernameInput = document.getElementById("usernameInput");
const displayNameInput = document.getElementById("displayNameInput");
const bioInput = document.getElementById("bioInput");
const avatarInput = document.getElementById("avatarInput");
const saveBtn = document.getElementById("saveProfileBtn");
const status = document.getElementById("profileStatus");
const followBtn = document.getElementById("followBtn");
const editSection = document.getElementById("editSection");

let currentUser = null;
let profileUserId = null;
let currentAvatarUrl = null;

(async () => {
  currentUser = await BeyondAuth.getCurrentUser();
  const requestedUser = new URLSearchParams(window.location.search).get("user");

  if (requestedUser) {
    profileUserId = requestedUser;
  } else {
    if (!currentUser) {
      window.location.href = "login.html?next=profile.html";
      return;
    }
    profileUserId = currentUser.id;
  }

  await loadProfile();

  if (profileUserId === currentUser?.id) {
    editSection.hidden = false;
    followBtn.hidden = true;
  } else {
    editSection.hidden = true;
    followBtn.hidden = false;
    await loadFollowState();
  }

  await loadVideos();
})();

async function loadProfile() {
  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url")
    .eq("id", profileUserId)
    .maybeSingle();

  if (error) {
    console.error(error);
    status.textContent = "Could not load profile.";
    return;
  }

  if (!profile) {
    status.textContent = "Profile not found. Run creator-profile.sql in Supabase.";
    return;
  }

  currentAvatarUrl = profile.avatar_url || null;
  fillProfile(profile);

  const [{ count: followers }, { count: following }] = await Promise.all([
    supabaseClient.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profileUserId),
    supabaseClient.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profileUserId)
  ]);

  followerCount.textContent = followers || 0;
  followingCount.textContent = following || 0;
}

function fillProfile(profile) {
  profileName.textContent = profile.display_name;
  profileUsername.textContent = "@" + profile.username;
  profileBio.textContent = profile.bio || "";

  if (profileUserId === currentUser?.id) {
    usernameInput.value = profile.username;
    displayNameInput.value = profile.display_name;
    bioInput.value = profile.bio || "";
  }

  if (profile.avatar_url) {
    avatar.innerHTML = `<img src="${escapeHTML(profile.avatar_url)}" alt="Profile photo">`;
  } else {
    avatar.textContent = profile.display_name.charAt(0).toUpperCase();
  }
}

async function loadFollowState() {
  if (!currentUser) {
    followBtn.textContent = "Log in to follow";
    followBtn.onclick = () => {
      window.location.href = "login.html?next=" + encodeURIComponent(window.location.pathname + window.location.search);
    };
    return;
  }

  const { data } = await supabaseClient
    .from("follows")
    .select("follower_id")
    .eq("follower_id", currentUser.id)
    .eq("following_id", profileUserId)
    .maybeSingle();

  followBtn.textContent = data ? "Following" : "Follow";
  followBtn.classList.toggle("following", !!data);

  followBtn.onclick = async () => {
    followBtn.disabled = true;

    if (data) {
      await supabaseClient.from("follows")
        .delete()
        .eq("follower_id", currentUser.id)
        .eq("following_id", profileUserId);
    } else {
      await supabaseClient.from("follows")
        .insert({ follower_id: currentUser.id, following_id: profileUserId });
    }

    await loadProfile();
    await loadFollowState();
    followBtn.disabled = false;
  };
}

async function loadVideos() {
  const { data, error } = await supabaseClient
    .from("videos")
    .select("id, video_url, caption, created_at")
    .eq("user_id", profileUserId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    myVideos.innerHTML = '<p class="muted">Could not load videos.</p>';
    return;
  }

  videoCount.textContent = data.length;

  if (!data.length) {
    myVideos.innerHTML = '<p class="muted">No videos yet.</p>';
    return;
  }

  myVideos.replaceChildren();

  data.forEach(video => {
    const card = document.createElement("article");
    card.className = "profile-video";
    card.innerHTML = `
      <video src="${escapeHTML(video.video_url)}" controls playsinline preload="metadata"></video>
      <p>${escapeHTML(video.caption || "")}</p>
    `;
    myVideos.appendChild(card);
  });
}

saveBtn.addEventListener("click", async () => {
  if (!currentUser || profileUserId !== currentUser.id) return;

  const username = usernameInput.value.trim().toLowerCase();
  const displayName = displayNameInput.value.trim();
  const bio = bioInput.value.trim();
  const image = avatarInput.files?.[0];

  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    status.textContent = "Username: 3–30 letters, numbers, or underscores.";
    return;
  }

  if (!displayName) {
    status.textContent = "Enter a display name.";
    return;
  }

  saveBtn.disabled = true;

  try {
    let avatarUrl = currentAvatarUrl;

    if (image) {
      if (image.size > 5 * 1024 * 1024) {
        throw new Error("Profile photo must be 5 MB or smaller.");
      }

      if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
        throw new Error("Use JPG, PNG, or WebP.");
      }

      status.textContent = "Uploading profile photo...";

      const extension = image.type === "image/jpeg" ? "jpg" : image.type.split("/")[1];
      const storagePath = `${currentUser.id}/avatar.${extension}`;

      const { error: uploadError } = await supabaseClient.storage
        .from("avatars")
        .upload(storagePath, image, {
          cacheControl: "3600",
          contentType: image.type,
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabaseClient.storage
        .from("avatars")
        .getPublicUrl(storagePath);

      avatarUrl = publicData.publicUrl + "?v=" + Date.now();
    }

    status.textContent = "Saving profile...";

    const { error } = await supabaseClient
      .from("profiles")
      .upsert({
        id: currentUser.id,
        username,
        display_name: displayName,
        bio,
        avatar_url: avatarUrl
      }, { onConflict: "id" });

    if (error) throw error;

    currentAvatarUrl = avatarUrl;
    avatarInput.value = "";
    status.textContent = "Profile saved successfully!";
    await loadProfile();
  } catch (error) {
    console.error(error);
    status.textContent = error.message.includes("profiles_username_key")
      ? "That username is already taken."
      : error.message || "Could not save profile.";
  } finally {
    saveBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  await BeyondAuth.logoutBeyond();
});

function escapeHTML(value = "") {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}
