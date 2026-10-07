const hashtagsEl=document.getElementById("hashtags");
const creatorsEl=document.getElementById("creators");
const videosEl=document.getElementById("trendingVideos");
const statusEl=document.getElementById("discoverStatus");
let discoverChannel=null;
let activeHashtag="";
let refreshTimer=null;
let discoverLoading=false;

async function loadDiscover(hashtag=""){\n  activeHashtag=hashtag;
  if(discoverLoading)return;
  discoverLoading=true;
  statusEl.textContent="Loading trends...";
  const {data:videos,error}=await supabaseClient.from("videos").select("id,user_id,video_url,caption,created_at").order("created_at",{ascending:false}).limit(100);
  if(error){console.error(error);statusEl.textContent="Could not load Discover.";return}

  const ids=(videos||[]).map(v=>v.id);\n\n  const {data:currentUserData}=await supabaseClient.auth.getUser();\n  const currentUser=currentUserData?.user;\n  let preferredUsers=[];\n  if(currentUser){\n    const {data:followed}=await supabaseClient.from("follows").select("following_id").eq("follower_id",currentUser.id);\n    preferredUsers=(followed||[]).map(x=>x.following_id);\n  }
  const userIds=[...new Set((videos||[]).map(v=>v.user_id).filter(Boolean))];

  const [{data:likes},{data:comments},{data:views},{data:profiles}]=await Promise.all([
    ids.length?supabaseClient.from("video_likes").select("video_id").in("video_id",ids):{data:[]},
    ids.length?supabaseClient.from("video_comments").select("video_id").in("video_id",ids):{data:[]},
    ids.length?supabaseClient.from("video_views").select("video_id").in("video_id",ids):{data:[]},
    userIds.length?supabaseClient.from("profiles").select("id,username,display_name,avatar_url").in("id",userIds):{data:[]}
  ]);

  const likeCount=id=>(likes||[]).filter(x=>x.video_id===id).length;
  const commentCount=id=>(comments||[]).filter(x=>x.video_id===id).length;
  const viewCount=id=>(views||[]).filter(x=>x.video_id===id).length;

  const filteredVideos=activeHashtag
    ? (videos||[]).filter(v=>(v.caption||"").toLowerCase().includes(activeHashtag.toLowerCase()))
    : (videos||[]);
  const scored=filteredVideos.map(v=>({...v,score:(preferredUsers.includes(v.user_id)?12:0)+likeCount(v.id)*4+commentCount(v.id)*5+viewCount(v.id)+Math.max(0,7-Math.floor((Date.now()-new Date(v.created_at).getTime())/86400000))*2}))
    .sort((a,b)=>b.score-a.score);

  videosEl.replaceChildren();
  scored.slice(0,20).forEach(v=>{
    const p=(profiles||[]).find(x=>x.id===v.user_id);
    const card=document.createElement("article");
    card.className="trending-card";
    card.innerHTML=`<a href="index.html#video-${encodeURIComponent(v.id)}"><video src="${escapeHTML(v.video_url)}" muted playsinline preload="metadata"></video><div class="trending-info"><strong>${escapeHTML(v.caption||"Beyond video")}</strong><span>@${escapeHTML(p?.username||"beyond_creator")}</span><small>❤️ ${likeCount(v.id)} · 💬 ${commentCount(v.id)} · 👁 ${viewCount(v.id)}</small></div></a>`;
    videosEl.appendChild(card);
  });

  const creatorScores={};
  scored.forEach(v=>{creatorScores[v.user_id]=(creatorScores[v.user_id]||0)+v.score});
  creatorsEl.replaceChildren();
  (profiles||[]).sort((a,b)=>(creatorScores[b.id]||0)-(creatorScores[a.id]||0)).slice(0,10).forEach(p=>{
    const card=document.createElement("a");
    card.className="discover-creator";
    card.href="profile.html?user="+encodeURIComponent(p.id);
    card.innerHTML=`<div class="discover-avatar">${p.avatar_url?`<img src="${escapeHTML(p.avatar_url)}" alt="">`:`<span>${escapeHTML((p.display_name||"B").charAt(0).toUpperCase())}</span>`}</div><div><strong>${escapeHTML(p.display_name)}</strong><span>@${escapeHTML(p.username)}</span></div>`;
    creatorsEl.appendChild(card);
  });

  const tags={};
  scored.forEach(v=>{
    const matches=(v.caption||"").match(/#[a-zA-Z0-9_]+/g)||[];
    matches.forEach(tag=>{const key=tag.toLowerCase();tags[key]=(tags[key]||0)+v.score});
  });
  hashtagsEl.replaceChildren();
  Object.entries(tags).sort((a,b)=>b[1]-a[1]).slice(0,20).forEach(([tag])=>{
    const el=document.createElement("span");el.className="hashtag";el.textContent=tag;hashtagsEl.appendChild(el);
  });
  if(!hashtagsEl.children.length) hashtagsEl.innerHTML='<span class="muted">Add hashtags to captions to start trending.</span>';
  statusEl.textContent=activeHashtag?`Showing ${activeHashtag}`:"";
  discoverLoading=false;
}
function escapeHTML(v=""){const d=document.createElement("div");d.textContent=v;return d.innerHTML}

function scheduleDiscoverRefresh(){
  clearTimeout(refreshTimer);
  refreshTimer=setTimeout(()=>loadDiscover(),350);
}

function subscribeToDiscover(){
  if(discoverChannel) supabaseClient.removeChannel(discoverChannel);

  discoverChannel=supabaseClient
    .channel("beyond-discover-live")
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"video_likes"},scheduleDiscoverRefresh)
    .on("postgres_changes",{event:"DELETE",schema:"public",table:"video_likes"},scheduleDiscoverRefresh)
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"video_comments"},scheduleDiscoverRefresh)
    .on("postgres_changes",{event:"DELETE",schema:"public",table:"video_comments"},scheduleDiscoverRefresh)
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"video_views"},scheduleDiscoverRefresh)
    .subscribe((status)=>{
      if(status==="SUBSCRIBED") statusEl.textContent="Live trends enabled";
    });
}

window.addEventListener("beforeunload",()=>{
  if(discoverChannel) supabaseClient.removeChannel(discoverChannel);
});

loadDiscover();
subscribeToDiscover();
