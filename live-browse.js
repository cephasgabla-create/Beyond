const liveBrowseGrid=document.getElementById("liveBrowseGrid");
const liveBrowseEmpty=document.getElementById("liveBrowseEmpty");
const liveBrowseStatus=document.getElementById("liveBrowseStatus");
const liveCategories=document.getElementById("liveCategories");
const liveSearchInput=document.getElementById("liveSearchInput");
const liveSearchMeta=document.getElementById("liveSearchMeta");
let searchTerm="";
let liveRoomsCache=[];
let creatorProfilesCache=new Map();
let selectedCategory="All";
const categories=["All","🔥 Trending","🎮 Gaming","🎵 Music","⚽ Sports","💬 Chat","📚 Education"];

function renderCategories(){
  if(!liveCategories)return;
  liveCategories.replaceChildren();
  categories.forEach(category=>{
    const button=document.createElement("button");
    button.type="button";
    button.className="live-category"+(category===selectedCategory?" active":"");
    button.textContent=category;
    button.addEventListener("click",()=>{selectedCategory=category;renderCategories();loadLiveBrowse();});
    liveCategories.appendChild(button);
  });
}

function roomCategory(room){
  if(room.category)return room.category;
  const text=(room.title||"").toLowerCase();
  if(/gaming|game|minecraft|fortnite|roblox|fc\s?26|football game/.test(text))return "🎮 Gaming";
  if(/music|song|sing|dj|beat|afrobeats|concert/.test(text))return "🎵 Music";
  if(/sport|football|soccer|basketball|real madrid|ghana|match/.test(text))return "⚽ Sports";
  if(/learn|school|class|education|study|code|coding|tutorial/.test(text))return "📚 Education";
  if(/chat|talk|q&a|question|talking/.test(text))return "💬 Chat";
  return "💬 Chat";
}


async function loadLiveBrowse(){
  const {data:rooms,error}=await supabaseClient
    .from("live_rooms")
    .select("id,creator_id,title,category,started_at,status")
    .eq("status","live")
    .order("started_at",{ascending:false})
    .limit(50);

  if(error){
    console.error("Beyond Live browse:",error);
    liveBrowseStatus.textContent=error.message;
    return;
  }

  liveRoomsCache=rooms||[];
  await loadCreatorProfiles(liveRoomsCache);
  renderLiveBrowse();
}

async function loadCreatorProfiles(rooms){
  const ids=[...new Set(rooms.map(room=>room.creator_id).filter(Boolean))];
  await Promise.all(ids.map(async id=>{
    if(creatorProfilesCache.has(id))return;
    const {data}=await supabaseClient.from("profiles").select("username,display_name,avatar_url").eq("id",id).maybeSingle();
    creatorProfilesCache.set(id,data||{});
  }));
}

function renderLiveBrowse(){
  liveBrowseGrid.replaceChildren();
  liveBrowseStatus.textContent="";
  liveBrowseStatus.textContent="";

  const rooms=liveRoomsCache;
  if(!rooms.length){
    liveBrowseEmpty.hidden=false;
    return;
  }

  const normalizedSearch=searchTerm.trim().toLowerCase();
  let filteredRooms=selectedCategory==="All" ? [...rooms] : selectedCategory==="🔥 Trending" ? [...rooms].sort((a,b)=>new Date(b.started_at)-new Date(a.started_at)) : rooms.filter(room=>roomCategory(room)===selectedCategory);
  if(normalizedSearch){filteredRooms=filteredRooms.filter(room=>{const profile=creatorProfilesCache.get(room.creator_id)||{};return [room.title,room.category,profile.username,profile.display_name].some(value=>String(value||"").toLowerCase().includes(normalizedSearch));});}
  if(liveSearchMeta)liveSearchMeta.textContent=normalizedSearch ? `${filteredRooms.length} live stream${filteredRooms.length===1?"":"s"} found` : "";

  if(!filteredRooms.length){
    liveBrowseEmpty.hidden=false;
    liveBrowseEmpty.querySelector("h2").textContent="No live streams in this category";
    return;
  }

  liveBrowseEmpty.hidden=true;

  for(const room of filteredRooms){
    const profile=creatorProfilesCache.get(room.creator_id)||{};
    const {count:viewersCount}=await supabaseClient.from("live_viewers").select("user_id",{count:"exact",head:true}).eq("room_id",room.id);
    const viewers=viewersCount||0;

    const card=document.createElement("a");
    card.className="live-browse-card";
    card.href="live-room.html?room="+encodeURIComponent(room.id);

    const visual=document.createElement("div");
    visual.className="live-browse-visual";

    const avatar=document.createElement("div");
    avatar.className="live-browse-avatar";
    if(profile?.avatar_url){
      const img=document.createElement("img");
      img.src=profile.avatar_url;
      img.alt="";
      avatar.appendChild(img);
    }else{
      avatar.textContent=(profile?.display_name||"B").charAt(0).toUpperCase();
    }

    const badge=document.createElement("span");
    badge.className="live-browse-badge";
    badge.textContent="LIVE";

    const viewerBadge=document.createElement("span");
    viewerBadge.className="live-browse-viewers";
    viewerBadge.textContent="👁 "+viewers;

    visual.append(avatar,badge,viewerBadge);

    const body=document.createElement("div");
    body.className="live-browse-body";

    const title=document.createElement("h2");
    title.textContent=room.title||"Beyond Live";

    const creator=document.createElement("p");
    creator.textContent="@"+(profile?.username||"creator");

    const join=document.createElement("span");
    join.className="live-browse-join";
    join.textContent="Join Live →";

    body.append(title,creator,join);
    card.append(visual,body);
    liveBrowseGrid.appendChild(card);
  }
}

renderCategories();
loadLiveBrowse();

liveSearchInput?.addEventListener("input",()=>{searchTerm=liveSearchInput.value;renderLiveBrowse();});

const channel=supabaseClient.channel("beyond-live-directory")
  .on("postgres_changes",{event:"*",schema:"public",table:"live_rooms"},loadLiveBrowse)
  .on("postgres_changes",{event:"*",schema:"public",table:"live_viewers"},loadLiveBrowse)
  .subscribe();

window.addEventListener("beforeunload",()=>supabaseClient.removeChannel(channel));
