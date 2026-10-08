const liveBrowseGrid=document.getElementById("liveBrowseGrid");
const liveBrowseEmpty=document.getElementById("liveBrowseEmpty");
const liveBrowseStatus=document.getElementById("liveBrowseStatus");
const liveCategories=document.getElementById("liveCategories");
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

  liveBrowseGrid.replaceChildren();
  liveBrowseStatus.textContent="";

  if(!rooms?.length){
    liveBrowseEmpty.hidden=false;
    return;
  }

  const filteredRooms=selectedCategory==="All" ? rooms : selectedCategory==="🔥 Trending" ? [...rooms].sort((a,b)=>new Date(b.started_at)-new Date(a.started_at)) : rooms.filter(room=>roomCategory(room)===selectedCategory);

  if(!filteredRooms.length){
    liveBrowseEmpty.hidden=false;
    liveBrowseEmpty.querySelector("h2").textContent="No live streams in this category";
    return;
  }

  liveBrowseEmpty.hidden=true;

  for(const room of filteredRooms){
    const [profileResult,viewerResult]=await Promise.all([
      supabaseClient.from("profiles").select("username,display_name,avatar_url").eq("id",room.creator_id).maybeSingle(),
      supabaseClient.from("live_viewers").select("user_id",{count:"exact",head:true}).eq("room_id",room.id)
    ]);

    const profile=profileResult.data;
    const viewers=viewerResult.count||0;

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

const channel=supabaseClient.channel("beyond-live-directory")
  .on("postgres_changes",{event:"*",schema:"public",table:"live_rooms"},loadLiveBrowse)
  .on("postgres_changes",{event:"*",schema:"public",table:"live_viewers"},loadLiveBrowse)
  .subscribe();

window.addEventListener("beforeunload",()=>supabaseClient.removeChannel(channel));
