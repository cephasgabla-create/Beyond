const feed = document.getElementById("feed");
const forYouTab = document.getElementById("forYouTab");
const followingTab = document.getElementById("followingTab");

const commentsOverlay = document.getElementById("commentsOverlay");
const closeCommentsBtn = document.getElementById("closeCommentsBtn");
const commentsList = document.getElementById("commentsList");
const commentsCount = document.getElementById("commentsCount");
const commentForm = document.getElementById("commentForm");
const commentInput = document.getElementById("commentInput");

let activeFeed = "forYou";
let activeCommentVideoId = null;
let commentsChannel = null;

function escapeHTML(value = "") {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

async function loadBeyondFeed(feedType = activeFeed) {
  activeFeed = feedType;
  updateFeedTabs();
  feed.innerHTML = '<p class="feed-loading">Loading Beyond...</p>';

  const { data: { user } } = await supabaseClient.auth.getUser();

  let query = supabaseClient
    .from("videos")
    .select("id, user_id, video_url, caption, created_at")
    .order("created_at", { ascending: false });

  if (feedType === "following") {
    if (!user) {
      feed.innerHTML = '<div class="feed-empty"><h2>Log in to see Following</h2><p>Follow creators to build your personal feed.</p><a class="upload-link" href="login.html?next=index.html">Log in</a></div>';
      return;
    }

    const { data: follows, error } = await supabaseClient
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id);

    if (error) {
      console.error(error);
      feed.innerHTML = '<p class="feed-loading">Could not load Following.</p>';
      return;
    }

    const followingIds = (follows || []).map(row => row.following_id);

    if (!followingIds.length) {
      feed.innerHTML = '<div class="feed-empty"><h2>Your Following feed is empty</h2><p>Follow creators and their videos will appear here.</p><a class="upload-link" href="search.html">Find creators</a></div>';
      return;
    }

    query = query.in("user_id", followingIds);
  }

  const { data: videos, error } = await query;

  if (error) {
    console.error(error);
    feed.innerHTML = '<p class="feed-loading">Could not load videos.</p>';
    return;
  }

  if (!videos?.length) {
    feed.innerHTML = feedType === "following"
      ? '<div class="feed-empty"><h2>No new videos yet</h2><p>The creators you follow have not posted anything yet.</p></div>'
      : '<p class="feed-loading">No videos yet. Upload the first one.</p>';
    return;
  }

  const ids = videos.map(v => v.id);
  const userIds = [...new Set(videos.map(v => v.user_id).filter(Boolean))];

  const [{ data: likes }, { data: comments }, { data: profiles }] = await Promise.all([
    supabaseClient.from("video_likes").select("video_id, user_id").in("video_id", ids),
    supabaseClient.from("video_comments").select("id, video_id, user_id, comment").in("video_id", ids).order("created_at", { ascending: false }),
    supabaseClient.from("profiles").select("id, username, display_name, avatar_url").in("id", userIds)
  ]);

  feed.replaceChildren();

  videos.forEach(video => {
    const videoLikes = likes?.filter(x => x.video_id === video.id) || [];
    const videoComments = comments?.filter(x => x.video_id === video.id) || [];
    const creator = profiles?.find(p => p.id === video.user_id);
    const liked = !!user && videoLikes.some(x => x.user_id === user.id);
    const username = creator?.username || "beyond_creator";

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
          <button class="action-btn like-btn" type="button">
            <span class="action-icon">${liked ? "❤️" : "♡"}</span>
            <span>${videoLikes.length}</span>
          </button>
          <button class="action-btn comment-btn" type="button">
            <span class="action-icon">💬</span>
            <span>${videoComments.length}</span>
          </button>
          <button class="action-btn share-btn" type="button">
            <span class="action-icon">↗</span>
            <span>Share</span>
          </button>
        </div>
      </div>
    `;

    const videoElement = card.querySelector(".video");

    videoElement.addEventListener("click", () => {
      if (videoElement.paused) videoElement.play().catch(() => {});
      else videoElement.pause();
    });

    videoElement.addEventListener("play", async () => {
      await supabaseClient.from("video_views").insert({
        video_id: video.id,
        user_id: user?.id || null
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

      await loadBeyondFeed(activeFeed);
    });

    card.querySelector(".comment-btn").addEventListener("click", () => {
      openComments(video.id);
    });

    card.querySelector(".share-btn").addEventListener("click", async () => {
      const shareData = {
        title: "Beyond video",
        text: video.caption || `Watch @${username} on Beyond`,
        url: window.location.href.split("#")[0] + "#video-" + video.id
      };

      if (navigator.share) {
        try { await navigator.share(shareData); } catch {}
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

function updateFeedTabs() {
  if (!forYouTab || !followingTab) return;
  const forYou = activeFeed === "forYou";
  forYouTab.classList.toggle("active", forYou);
  followingTab.classList.toggle("active", !forYou);
  forYouTab.setAttribute("aria-selected", String(forYou));
  followingTab.setAttribute("aria-selected", String(!forYou));
}

forYouTab?.addEventListener("click", () => loadBeyondFeed("forYou"));
followingTab?.addEventListener("click", () => loadBeyondFeed("following"));

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
  setTimeout(() => commentInput?.focus(), 50);
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

  comments.forEach(comment => {
    const profile = profiles?.find(p => p.id === comment.user_id);
    const item = document.createElement("article");
    item.className = "comment-item";

    const avatar = profile?.avatar_url
      ? `<img src="${escapeHTML(profile.avatar_url)}" alt="">`
      : `<span>${escapeHTML((profile?.display_name || "B").charAt(0).toUpperCase())}</span>`;

    item.innerHTML = `
      <div class="comment-avatar">${avatar}</div>
      <div class="comment-body">
        <strong>@${escapeHTML(profile?.username || "beyond_user")}</strong>
        <p>${escapeHTML(comment.comment)}</p>
      </div>
    `;

    commentsList.appendChild(item);
  });

  commentsList.scrollTop = commentsList.scrollHeight;
}

function subscribeToComments(videoId) {
  if (commentsChannel) supabaseClient.removeChannel(commentsChannel);

  commentsChannel = supabaseClient
    .channel("comments-" + videoId)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "video_comments", filter: "video_id=eq." + videoId },
      () => {
        if (activeCommentVideoId === videoId) loadComments(videoId);
      }
    )
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

commentsOverlay?.addEventListener("click", event => {
  if (event.target === commentsOverlay) closeComments();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !commentsOverlay.hidden) closeComments();
});

loadBeyondFeed("forYou");
