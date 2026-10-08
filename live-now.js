const liveNowSection=document.getElementById("liveNowSection");
const liveNowList=document.getElementById("liveNowList");

async function loadLiveNow(){
  if(!liveNowSection||!liveNowList)return;
  const {data,error}=await supabaseClient
    .from("live_rooms")
    .select("id,creator_id,title,started_at,status")
    .eq("status","live")
    .order("started_at",{ascending:false})
    .limit(12);

  if(error){
    console.error("Beyond Live now:",error);
    return;
  }

  liveNowList.replaceChildren();
  if(!data?.length){
    liveNowSection.hidden=true;
    return;
  }

  liveNowSection.hidden=false;

  for(const room of data){
    const {data:profile}=await supabaseClient
      .from("profiles")
      .select("username,display_name,avatar_url")
      .eq("id",room.creator_id)
      .maybeSingle();

    const card=document.createElement("a");
    card.className="live-now-card";
    card.href="live-room.html?room="+encodeURIComponent(room.id);

    const avatar=document.createElement("div");
    avatar.className="live-now-avatar";
    if(profile?.avatar_url){
      const img=document.createElement("img");
      img.src=profile.avatar_url;
      img.alt="";
      avatar.appendChild(img);
    }else{
      avatar.textContent=(profile?.display_name||"B").charAt(0).toUpperCase();
    }

    const info=document.createElement("div");
    info.className="live-now-info";

    const badge=document.createElement("span");
    badge.className="live-now-badge";
    badge.textContent="LIVE";

    const title=document.createElement("strong");
    title.textContent=room.title||"Beyond Live";

    const creator=document.createElement("small");
    creator.textContent="@"+(profile?.username||"creator");

    info.append(badge,title,creator);

    const join=document.createElement("span");
    join.className="live-now-join";
    join.textContent="Join →";

    card.append(avatar,info,join);
    liveNowList.appendChild(card);
  }
}

loadLiveNow();

const liveNowChannel=supabaseClient
  .channel("beyond-live-now")
  .on("postgres_changes",{
    event:"*",
    schema:"public",
    table:"live_rooms"
  },()=>loadLiveNow())
  .subscribe();

window.addEventListener("beforeunload",()=>{
  supabaseClient.removeChannel(liveNowChannel);
});
