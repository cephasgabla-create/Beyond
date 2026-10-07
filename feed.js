const feed = document.getElementById("feed");
const commentsOverlay = document.getElementById("commentsOverlay");
const closeCommentsBtn = document.getElementById("closeCommentsBtn");
const commentsList = document.getElementById("commentsList");
const commentsCount = document.getElementById("commentsCount");
const commentForm = document.getElementById("commentForm");
const commentInput = document.getElementById("commentInput");
let activeCommentVideoId = null;
let commentsChannel = null;

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
  const userIds = [...new Set(videos.map(v => v.user_id).filter(Boolean))];

  const [{ data: likes }, { data: comments }, { data: views }, { data: profiles }] =
    await Promise.all([
      supabaseClient.from("video_likes").select("video_id, user_id").in("video_id", ids),
      supabaseClient.from("video_comments").select("id, video_id, user_id, comment").in("video_id", ids).order("created_at", { ascending: false }),
      supabaseClient.from("video_views").select("video_id").in("video_id", ids),
      supabaseClient.from("profiles").select("id, username, display_name, avatar_url").in("id", userIds)
    ]);

  const { data: { user } } = await supabaseClient.auth.getUser();
  feed.replaceChildren();

  videos.forEach(video => {
    const videoLikes = likes?.filter(x => x.video_id === video.id) || [];
    const videoComments = comments?.filter(x => x.video_id === video.id) || [];
    const videoViews = views?.filter(x => x.video_id === video.id) || [];
    const creator = profiles?.find(p => p.id === video.user_id);
    const liked = !!user && videoLikes.some(x => x.user_id === user.id);

    const username = creator?.username || "beyond_creator";
    const displayName = creator?.display_name || "Beyond Creator";

    const card = document.createElement("article");
    card.className = "video-card";
    card.id = "video-" + video.id;

    card.innerHTML = `
      <video class="video" src="${escapeHTML(video.video_url)}" playsinline loop preload="metadata"></video>

      <div class="video-overlay">
        <div class="video-meta">
          <a class="creator-link" href="profile.html?user=${encodeURIComponent(video.user_id)}">
            <strong>@${escapeHTML(username)}</strong>
          </a>
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

    card.querySelector(".comment-btn").addEventListener("click", () => openComments(video.id));


      loadBeyondFeed();
    });

    card.querySelector(".share-btn").addEventListener("click", async () => {
      const shareData = {
        title: "Beyond video",
        text: video.caption || `Watch @${username} on Beyond`,
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

  const hash = window.location.hash;
  if (hash && hash.startsWith("#video-")) {
    requestAnimationFrame(() => {
      document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
    });
  }
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


async function openComments(videoId) {
  activeCommentVideoId = videoId;
  commentsOverlay.hidden = false;
  document.body.classList.add("comments-open");
  await loadComments(videoId);
  subscribeToComments(videoId);
  setTimeout(() => commentInput.focus(), 50);
}

function closeComments() {
  commentsOverlay.hidden = true;
  document.body.classList.remove("comments-open");
  activeCommentVideoId = null;
  if (commentsChannel) {
    supabaseClient.removeChannel(commentsChannel);
    commentsChannel = null;
  }
}

async function loadComments(videoId) {
  commentsList.innerHTML = '<p class="comments-empty">Loading comments...</p>';
  const { data, error } = await supabaseClient
    .from("video_comments")
    .select("id, video_id, user_id, comment, created_at")
    .eq("video_id", videoId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error(error);
    commentsList.innerHTML = '<p class="comments-empty">Could not load comments.</p>';
    return;
  }
  const comments = data || [];
  const ids = [...new Set(comments.map(c => c.user_id).filter(Boolean))];
  const { data: profiles } = ids.length
    ? await supabaseClient.from("profiles").select("id, username, display_name, avatar_url").in("id", ids)
    : { data: [] };
  commentsCount.textContent = `${comments.length} comment${comments.length === 1 ? "" : "s"}`;
  commentsList.replaceChildren();
  if (!comments.length) {
    commentsList.innerHTML = '<p class="comments-empty">Be the first to comment.</p>';
    return;
  }
  comments.forEach(c => {
    const p = profiles?.find(x => x.id === c.user_id);
    const item = document.createElement("article");
    item.className = "comment-item";
    const avatar = p?.avatar_url
      ? `<img src="${escapeHTML(p.avatar_url)}" alt="">`
      : `<span>${escapeHTML((p?.display_name || "B").charAt(0).toUpperCase())}</span>`;
    item.innerHTML = `<div class="comment-avatar">${avatar}</div><div class="comment-body"><strong>@${escapeHTML(p?.username || "beyond_user")}</strong><p>${escapeHTML(c.comment)}</p></div>`;
    commentsList.appendChild(item);
  });
  commentsList.scrollTop = commentsList.scrollHeight;
}

function subscribeToComments(videoId) {
  if (commentsChannel) supabaseClient.removeChannel(commentsChannel);
  commentsChannel = supabaseClient.channel("comments-" + videoId)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "video_comments", filter: "video_id=eq." + videoId }, () => {
      if (activeCommentVideoId === videoId) loadComments(videoId);
    })
    .subscribe();
}

commentForm?.addEventListener("submit", async event => {
  event.preventDefault();
  const text = commentInput.value.trim();
  if (!text || !activeCommentVideoId) return;
  const user = await BeyondAuth.getCurrentUser();
  if (!user) {
    window.location.href = "login.html?next=index.html";
    return;
  }
  commentInput.disabled = true;
  const { error } = await supabaseClient.from("video_comments").insert({
    video_id: activeCommentVideoId,
    user_id: user.id,
    comment: text.slice(0, 500)
  });
  commentInput.disabled = false;
  if (error) console.error(error);
  else commentInput.value = "";
});

closeCommentsBtn?.addEventListener("click", closeComments);
commentsOverlay?.addEventListener("click", e => { if (e.target === commentsOverlay) closeComments(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && !commentsOverlay.hidden) closeComments(); });

loadBeyondFeed();
