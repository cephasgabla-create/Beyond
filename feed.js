const feed = document.getElementById("feed");

function escapeHTML(value = "") {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

async function loadBeyondFeed() {
  feed.innerHTML = '<p class="muted">Loading Beyond...</p>';

  const { data: videos, error } = await supabaseClient
    .from("videos")
    .select("id, user_id, video_url, caption, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    feed.innerHTML = '<p class="muted">Could not load videos.</p>';
    return;
  }

  if (!videos?.length) {
    feed.innerHTML = '<p class="muted">No videos yet. Upload the first one.</p>';
    return;
  }

  const ids = videos.map(v => v.id);
  const [{ data: likes }, { data: comments }, { data: views }] = await Promise.all([
    supabaseClient.from("video_likes").select("video_id, user_id").in("video_id", ids),
    supabaseClient.from("video_comments").select("id, video_id, user_id, comment, created_at").in("video_id", ids).order("created_at", { ascending: false }),
    supabaseClient.from("video_views").select("video_id").in("video_id", ids)
  ]);

  const { data: { user } } = await supabaseClient.auth.getUser();
  feed.replaceChildren();

  videos.forEach(video => {
    const videoLikes = likes?.filter(x => x.video_id === video.id) || [];
    const videoComments = comments?.filter(x => x.video_id === video.id) || [];
    const videoViews = views?.filter(x => x.video_id === video.id) || [];
    const liked = !!user && videoLikes.some(x => x.user_id === user.id);

    const card = document.createElement("article");
    card.className = "video-card";
    card.innerHTML = `
      <video class="video" src="${escapeHTML(video.video_url)}" controls playsinline preload="metadata"></video>
      <div class="video-info">
        <p class="caption">${escapeHTML(video.caption)}</p>
        <div class="social-actions">
          <button class="like-btn" data-id="${video.id}">${liked ? "❤️" : "♡"} <span>${videoLikes.length}</span></button>
          <button class="comment-btn" data-id="${video.id}">💬 <span>${videoComments.length}</span></button>
          <span class="view-count">👁️ ${videoViews.length}</span>
        </div>
        <div class="comments" data-comments="${video.id}"></div>
      </div>
    `;

    const commentBox = card.querySelector(".comments");
    videoComments.slice(0, 5).forEach(c => {
      const p = document.createElement("p");
      p.className = "comment";
      p.textContent = c.comment;
      commentBox.appendChild(p);
    });

    const videoElement = card.querySelector("video");
    videoElement.addEventListener("play", async () => {
      const { data: { user: currentUser } } = await supabaseClient.auth.getUser();
      await supabaseClient.from("video_views").insert({
        video_id: video.id,
        user_id: currentUser?.id || null
      });
    }, { once: true });

    card.querySelector(".like-btn").addEventListener("click", async e => {
      const current = await BeyondAuth.getCurrentUser();
      if (!current) {
        window.location.href = "login.html?next=index.html";
        return;
      }

      const existing = videoLikes.find(x => x.user_id === current.id);
      if (existing) {
        await supabaseClient.from("video_likes")
          .delete().eq("video_id", video.id).eq("user_id", current.id);
      } else {
        await supabaseClient.from("video_likes")
          .insert({ video_id: video.id, user_id: current.id });
      }
      loadBeyondFeed();
    });

    card.querySelector(".comment-btn").addEventListener("click", async e => {
      const current = await BeyondAuth.getCurrentUser();
      if (!current) {
        window.location.href = "login.html?next=index.html";
        return;
      }

      const text = prompt("Write a comment:");
      if (!text?.trim()) return;

      await supabaseClient.from("video_comments").insert({
        video_id: video.id,
        user_id: current.id,
        comment: text.trim().slice(0, 500)
      });
      loadBeyondFeed();
    });

    feed.appendChild(card);
  });
}

loadBeyondFeed();
