const feed = document.getElementById("feed");

function escapeHTML(value = "") {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

async function loadBeyondFeed() {
  feed.innerHTML = '<p class="muted">Loading Beyond...</p>';

  const { data, error } = await supabaseClient
    .from("videos")
    .select("id, user_id, video_url, caption, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    feed.innerHTML = '<p class="muted">Could not load videos. Check your Supabase setup.</p>';
    return;
  }

  if (!data?.length) {
    feed.innerHTML = '<p class="muted">No videos yet. Upload the first one.</p>';
    return;
  }

  feed.replaceChildren();

  data.forEach(video => {
    const card = document.createElement("article");
    card.className = "video-card";

    card.innerHTML = `
      <video class="video" src="${escapeHTML(video.video_url)}"
        controls playsinline preload="metadata"></video>
      <div class="video-info">
        <p class="caption">${escapeHTML(video.caption)}</p>
        <small>${new Date(video.created_at).toLocaleString()}</small>
      </div>
    `;

    feed.appendChild(card);
  });
}

loadBeyondFeed();
