const openSearchBtn = document.getElementById("openSearchBtn");
const closeSearchBtn = document.getElementById("closeSearchBtn");
const overlay = document.getElementById("searchOverlay");
const form = document.getElementById("homeSearchForm");
const input = document.getElementById("homeSearchInput");
const status = document.getElementById("homeSearchStatus");
const results = document.getElementById("homeSearchResults");

function openSearch() {
  overlay.hidden = false;
  document.body.classList.add("search-open");
  setTimeout(() => input.focus(), 50);
}

function closeSearch() {
  overlay.hidden = true;
  document.body.classList.remove("search-open");
}

openSearchBtn.addEventListener("click", openSearch);
closeSearchBtn.addEventListener("click", closeSearch);

overlay.addEventListener("click", event => {
  if (event.target === overlay) closeSearch();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !overlay.hidden) closeSearch();
});

form.addEventListener("submit", async event => {
  event.preventDefault();

  const term = input.value.trim();
  if (!term) {
    status.textContent = "Type a creator name, username, or video caption.";
    results.replaceChildren();
    return;
  }

  status.textContent = "Searching Beyond...";
  results.replaceChildren();

  const safe = term.replace(/[%_]/g, "\\$&");

  const [{ data: profiles, error: profileError }, { data: videos, error: videoError }] =
    await Promise.all([
      supabaseClient
        .from("profiles")
        .select("id, username, display_name, bio, avatar_url")
        .or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`)
        .order("username")
        .limit(15),

      supabaseClient
        .from("videos")
        .select("id, user_id, video_url, caption, created_at")
        .ilike("caption", `%${term}%`)
        .order("created_at", { ascending: false })
        .limit(20)
    ]);

  if (profileError || videoError) {
    console.error(profileError || videoError);
    status.textContent = "Search failed. Check your Supabase tables.";
    return;
  }

  const creatorIds = [...new Set((videos || []).map(video => video.user_id).filter(Boolean))];
  let videoCreators = [];

  if (creatorIds.length) {
    const { data } = await supabaseClient
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", creatorIds);

    videoCreators = data || [];
  }

  results.replaceChildren();

  const total = (profiles?.length || 0) + (videos?.length || 0);
  status.textContent = total
    ? `${total} result${total === 1 ? "" : "s"} found`
    : "No creators or videos found.";

  if (profiles?.length) {
    addHeading("Creators");

    profiles.forEach(profile => {
      const card = document.createElement("a");
      card.className = "creator-card";
      card.href = "profile.html?user=" + encodeURIComponent(profile.id);

      const avatar = profile.avatar_url
        ? `<img src="${escapeHTML(profile.avatar_url)}" alt="">`
        : `<span>${escapeHTML((profile.display_name || "B").charAt(0).toUpperCase())}</span>`;

      card.innerHTML = `
        <div class="creator-avatar">${avatar}</div>
        <div class="creator-info">
          <strong>${escapeHTML(profile.display_name)}</strong>
          <span>@${escapeHTML(profile.username)}</span>
          <p>${escapeHTML(profile.bio || "")}</p>
        </div>
      `;

      results.appendChild(card);
    });
  }

  if (videos?.length) {
    addHeading("Videos");

    videos.forEach(video => {
      const creator = videoCreators.find(profile => profile.id === video.user_id);
      const card = document.createElement("article");
      card.className = "search-video-card";

      card.innerHTML = `
        <a class="search-video-link" href="index.html#video-${encodeURIComponent(video.id)}">
          <video src="${escapeHTML(video.video_url)}" muted playsinline preload="metadata"></video>
          <div class="search-video-info">
            <strong>${escapeHTML(video.caption || "Beyond video")}</strong>
            <span>@${escapeHTML(creator?.username || "beyond_creator")}</span>
          </div>
        </a>
      `;

      results.appendChild(card);
    });
  }
});

function addHeading(text) {
  const heading = document.createElement("h3");
  heading.className = "search-section-title";
  heading.textContent = text;
  results.appendChild(heading);
}

function escapeHTML(value = "") {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}
