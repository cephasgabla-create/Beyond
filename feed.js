const feed = document.getElementById("feed");

function escapeHTML(value = "") {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

async function loadBeyondFeed() {
  feed.innerHTML = '<p class="feed-loading">Loading Beyond...</p>';

  const { data: videos, error } = await supabaseClient
    .from("videos")
    .select("id, user_id, video_url, caption, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    feed.innerHTML = '<p class="feed-loading">Could not load videos.</p>';
    return;
  }

  if (!videos?.length) {
    feed.innerHTML = '<p class="feed-loading">No videos yet. Upload the first one.</p>';
    return;
  }

  const ids = videos.map(v => v.id);
  const [{ data: likes }, { data: comments }, { data: views }] = await Promise.all([
    supabaseClient.from("video_likes").select("video_id, user_id").in("video_id", ids),
    supabaseClient.from("video_comments").select("id, video_id, user_id, comment").in("video_id", ids).order("created_at", { ascending: false }),
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
      <video class="video" src="${escapeHTML(video.video_url)}" playsinline loop preload="metadata"></video>

      <div class="video-overlay">
        <div class="video-meta">
          <strong>@beyond_creator</strong>
          <p>${escapeHTML(video.caption || "")}</p>
        </div>

        <div class="video-actions">
          <button class="action-btn like-btn" data-id="${video.id}">
            <span class="action-icon">${liked ? "❤️" : "♡"}</span>
            <span>${videoLikes.length}</span>
          </button>

          <button class="action-btn comment-btn" data-id="${video.id}">
            <span class="action-icon">💬</span>
            <span>${videoComments.length}</span>
          </button>

          <button class="action-btn share-btn" data-url="${escapeHTML(video.video_url)}">
            <span class="action-icon">↗</span>
            <span>Share</span>
          </button>
        </div>
      </div>

      <div class="comments" data-comments="${video.id}">
        ${videoComments.slice(0, 3).map(c => `<p class="comment">${escapeHTML(c.comment)}</p>`).join("")}
      </div>
    `;

    const videoElement = card.querySelector(".video");

    videoElement.addEventListener("click", () => {
      if (videoElement.paused) videoElement.play().catch(() => {});
      else videoElement.pause();
    });

    videoElement.addEventListener("play", async () => {
      const { data: { user: currentUser } } = await supabaseClient.auth.getUser();
      await supabaseClient.from("video_views").insert({
        video_id: video.id,
        user_id: currentUser?.id || null
      });
    }, { once: true });

    card.querySelector(".like-btn").addEventListener("click", async () => {
      const current = await BeyondAuth.getCurrentUser();
      if (!current) {
        window.location.href = "login.html?next=index.html";
        return;
      }

      const existing = videoLikes.find(x => x.user_id === current.id);

      if (existing) {
        await supabaseClient.from("video_likes")
          .delete()
          .eq("video_id", video.id)
          .eq("user_id", current.id);
      } else {
        await supabaseClient.from("video_likes")
          .insert({ video_id: video.id, user_id: current.id });
      }

      loadBeyondFeed();
    });

    card.querySelector(".comment-btn").addEventListener("click", async () => {
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

    card.querySelector(".share-btn").addEventListener("click", async () => {
      const shareData = {
        title: "Beyond video",
        text: video.caption || "Watch this video on Beyond",
        url: window.location.href.split("#")[0] + "#video-" + video.id
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
        } catch {}
      } else {
        await navigator.clipboard?.writeText(shareData.url);
        alert("Beyond video link copied.");
      }
    });

    feed.appendChild(card);
  });

  setupVerticalFeed();
}

function setupVerticalFeed() {
  const cards = [...document.querySelectorAll(".video-card")];
  if (!cards.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const video = entry.target.querySelector(".video");
      if (!video) return;

      if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
        document.querySelectorAll(".video").forEach(other => {
          if (other !== video) other.pause();
        });
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, { threshold: [0.2, 0.65, 0.9] });

  cards.forEach(card => observer.observe(card));
}

loadBeyondFeed();
