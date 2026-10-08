// Beyond Live WebRTC foundation
const rtcPeers = new Map();
const pendingIce = new Map();
let rtcChannel = null;
const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

async function sendLiveSignal(roomId, senderId, receiverId, signalType, payload) {
  const { error } = await supabaseClient.from("live_signals").insert({
    room_id: roomId,
    sender_id: senderId,
    receiver_id: receiverId || null,
    signal_type: signalType,
    payload
  });
  if (error) console.error("Beyond WebRTC signal:", error);
}

function createPeerConnection(peerId, initiator) {
  if (rtcPeers.has(peerId)) return rtcPeers.get(peerId);

  const pc = new RTCPeerConnection(rtcConfig);
  rtcPeers.set(peerId, pc);

  if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  }

  pc.onicecandidate = event => {
    if (event.candidate && room && user) {
      sendLiveSignal(room.id, user.id, peerId, "ice", event.candidate.toJSON());
    }
  };

  pc.ontrack = event => { if (viewerVideo && event.streams[0]) { viewerVideo.srcObject = event.streams[0]; viewerVideo.hidden = false; liveVideo.hidden = true; cameraPlaceholder.hidden = true; } };

  pc.onconnectionstatechange = () => {
    if (["failed", "closed"].includes(pc.connectionState)) {
      pc.close();
      rtcPeers.delete(peerId);
    }
  };

  if (initiator) {
    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer).then(() => offer))
      .then(offer => sendLiveSignal(room.id, user.id, peerId, "offer", offer))
      .catch(error => console.error("Beyond WebRTC offer:", error));
  }

  return pc;
}

async function handleLiveSignal(signal) {
  if (!room || !user || signal.sender_id === user.id) return;

  if (signal.signal_type === "offer" && signal.payload?.type === "viewer-ready") {
    if (room.creator_id === user.id) await connectCreatorToViewer(signal.sender_id);
    return;
  }

  const pc = createPeerConnection(signal.sender_id, false);

  if (signal.signal_type === "offer") {
    await pc.setRemoteDescription(signal.payload);
    const queued = pendingIce.get(signal.sender_id) || [];
    for (const candidate of queued) { try { await pc.addIceCandidate(candidate); } catch (_) {} }
    pendingIce.delete(signal.sender_id);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await sendLiveSignal(room.id, user.id, signal.sender_id, "answer", answer);
  } else if (signal.signal_type === "answer") {
    await pc.setRemoteDescription(signal.payload);
  } else if (signal.signal_type === "ice") {
    if (!pc.remoteDescription) {
      const queue = pendingIce.get(signal.sender_id) || [];
      queue.push(signal.payload);
      pendingIce.set(signal.sender_id, queue);
      return;
    }
    try {
      await pc.addIceCandidate(signal.payload);
    } catch (error) {
      console.warn("Beyond ICE candidate:", error);
    }
  }
}

function subscribeWebRTCSignals() {
  rtcChannel = supabaseClient
    .channel("live-webrtc-" + room.id)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "live_signals",
      filter: "room_id=eq." + room.id
    }, payload => {
      handleLiveSignal(payload.new);
    })
    .subscribe();
}

async function connectCreatorToViewer(viewerId) {
  if (!room || room.creator_id !== user?.id || viewerId === user.id) return;
  const existing = rtcPeers.get(viewerId);
  if (existing) {
    existing.close();
    rtcPeers.delete(viewerId);
  }
  createPeerConnection(viewerId, true);
}

async function startCreatorBroadcast() {
  if (!room || room.creator_id !== user?.id) return;
  const { data: viewers } = await supabaseClient
    .from("live_viewers")
    .select("user_id")
    .eq("room_id", room.id);

  for (const viewer of viewers || []) {
    await connectCreatorToViewer(viewer.user_id);
  }
}
const params=new URLSearchParams(location.search);
const liveVideo=document.getElementById("liveVideo");
const viewerVideo=document.getElementById("viewerVideo");
const cameraPlaceholder=document.getElementById("cameraPlaceholder");
const cameraBtn=document.getElementById("cameraBtn");
const micBtn=document.getElementById("micBtn");
const creatorControls=document.getElementById("creatorControls");
const moderationPanel=document.getElementById("moderationPanel");
const moderationList=document.getElementById("moderationList");
const moderatedUsers=new Map();
let localStream=null;
let transferredStream=null;
let transferredRoomId=null;
let streamTransferWaiters=[];

window.addEventListener("message",event=>{
  if(event.origin!==location.origin)return;
  const data=event.data||{};
  if(data.type!=="beyond-live-stream"||!data.stream||!data.roomId)return;
  if(roomId&&data.roomId!==roomId)return;
  transferredStream=data.stream;
  transferredRoomId=data.roomId;
  event.source?.postMessage({type:"beyond-live-stream-received",roomId:data.roomId},event.origin);
  for(const resolve of streamTransferWaiters)resolve(transferredStream);
  streamTransferWaiters=[];
});

function waitForTransferredStream(timeout=5000){
  if(transferredStream)return Promise.resolve(transferredStream);
  return new Promise(resolve=>{
    let settled=false;
    const finish=stream=>{if(settled)return;settled=true;clearTimeout(timer);resolve(stream)};
    streamTransferWaiters.push(finish);
    const timer=setTimeout(()=>finish(null),timeout);
  });
}

function useLocalStream(stream){
  localStream=stream;
  liveVideo.srcObject=localStream;
  liveVideo.muted=true;
  liveVideo.hidden=false;
  cameraPlaceholder.hidden=true;
  cameraBtn.textContent="📷 Camera on";
  const micTrack=localStream.getAudioTracks()[0];
  micBtn.textContent=micTrack?.enabled?"🎙️ Mic on":"🔇 Mic off";
  return true;
}
async function enableCamera(){
  if(transferredStream&&(!transferredRoomId||transferredRoomId===room?.id)){
    return useLocalStream(transferredStream);
  }
  if(!navigator.mediaDevices?.getUserMedia){liveRoomStatus.textContent="Camera access is not supported by this browser.";return false}
  try{
    useLocalStream(await navigator.mediaDevices.getUserMedia({video:true,audio:true}));
    return true;
  }catch(error){
    console.error("Beyond camera:",error);
    liveRoomStatus.textContent="Camera permission was not granted. You can still use chat and reactions.";
    return false;
  }
}
const roomId=params.get("room");const liveStage=document.querySelector(".live-stage"),roomStatus=document.getElementById("roomStatus"),viewerCount=document.getElementById("viewerCount"),sideViewerCount=document.getElementById("sideViewerCount"),reactionCount=document.getElementById("reactionCount"),chatList=document.getElementById("chatList"),chatForm=document.getElementById("chatForm"),chatInput=document.getElementById("chatInput"),endLiveBtn=document.getElementById("endLiveBtn"),roomTitle=document.getElementById("roomTitle"),roomHeading=document.getElementById("roomHeading"),roomCreator=document.getElementById("roomCreator"),creatorName=document.getElementById("creatorName"),liveRoomStatus=document.getElementById("liveRoomStatus"),reactionFloat=document.getElementById("reactionFloat");let user=null,room=null,channel=null;
(async()=>{user=await BeyondAuth.getCurrentUser();if(!user){location.href="login.html?next="+encodeURIComponent(location.pathname+location.search);return}if(roomId) await joinExistingRoom();else await startRoom();})();
async function startRoom(){const title=prompt("Give your live stream a title","Beyond Live")?.trim()||"Beyond Live";const {data,error}=await supabaseClient.from("live_rooms").insert({creator_id:user.id,title,status:"live"}).select().single();if(error){liveRoomStatus.textContent=error.message||"Could not start live room.";return}history.replaceState(null,"","live-room.html?room="+data.id);room=data;endLiveBtn.hidden=false;await setupRoom()}
async function joinExistingRoom(){const {data,error}=await supabaseClient.from("live_rooms").select("id,creator_id,title,status,started_at").eq("id",roomId).maybeSingle();if(error||!data){liveRoomStatus.textContent="Live room not found.";return}room=data;if(room.status!=="live"){roomStatus.textContent="ENDED";liveRoomStatus.textContent="This live stream has ended.";chatForm.querySelector("button").disabled=true;chatInput.disabled=true;return}await supabaseClient.from("live_viewers").upsert({room_id:room.id,user_id:user.id,last_seen_at:new Date().toISOString()});await setupRoom();if(room.creator_id!==user.id){sendLiveSignal(room.id,user.id,room.creator_id,"offer",{type:"viewer-ready"}).catch(()=>{});}}
async function setupRoom(){subscribeWebRTCSignals();await supabaseClient.from("live_viewers").upsert({room_id:room.id,user_id:user.id,last_seen_at:new Date().toISOString()});roomTitle.textContent=room.title;roomHeading.textContent=room.title;const {data:p}=await supabaseClient.from("profiles").select("username,display_name").eq("id",room.creator_id).maybeSingle();const name=p?.display_name||"Beyond Creator";roomCreator.textContent="@"+(p?.username||"creator");creatorName.textContent=name;if(room.creator_id===user.id){
  endLiveBtn.hidden=false;
  creatorControls.hidden=false;
  const handedOff=await waitForTransferredStream(6000);
  if(handedOff&&transferredRoomId===room.id){
    useLocalStream(handedOff);
    liveRoomStatus.textContent="Camera and microphone transferred from the waiting room.";
  }else{
    await enableCamera();
  }
  await startCreatorBroadcast();
  await loadModeration();
}await loadChat();await refreshStats();subscribeRealtime();setInterval(heartbeat,20000)}
async function heartbeat(){if(!room||!user)return;await supabaseClient.from("live_viewers").upsert({room_id:room.id,user_id:user.id,last_seen_at:new Date().toISOString()})}
async function refreshStats(){const cutoff=new Date(Date.now()-45000).toISOString();const {data:viewers=[]}=await supabaseClient.from("live_viewers").select("user_id").eq("room_id",room.id).gte("last_seen_at",cutoff);const {count:reactions}=await supabaseClient.from("live_reactions").select("*",{count:"exact",head:true}).eq("room_id",room.id);viewerCount.textContent=viewers.length;sideViewerCount.textContent=viewers.length;reactionCount.textContent=reactions||0}
async function loadModeration(){
  if(!room || room.creator_id!==user?.id)return;
  const {data}=await supabaseClient.from("live_moderation").select("user_id,action").eq("room_id",room.id);
  moderatedUsers.clear();
  for(const item of data||[])moderatedUsers.set(item.user_id,item.action);
  moderationPanel.hidden=false;
  renderModeration();
}
function renderModeration(){
  if(!moderationList)return;
  moderationList.replaceChildren();
  if(!moderatedUsers.size){moderationList.innerHTML="<small>No moderated users.</small>";return}
  for(const [userId,action] of moderatedUsers){
    const row=document.createElement("div");row.className="moderation-user";
    const label=document.createElement("span");label.textContent=userId.slice(0,8)+"… • "+action;
    const btn=document.createElement("button");btn.textContent="Remove";btn.onclick=async()=>{await supabaseClient.from("live_moderation").delete().eq("room_id",room.id).eq("user_id",userId);moderatedUsers.delete(userId);renderModeration()};
    row.append(label,btn);moderationList.appendChild(row);
  }
}
async function moderateUser(userId,action){
  if(!room||room.creator_id!==user.id||userId===user.id)return;
  const {error}=await supabaseClient.from("live_moderation").upsert({room_id:room.id,user_id:userId,action},{onConflict:"room_id,user_id"});
  if(error){liveRoomStatus.textContent=error.message;return}
  moderatedUsers.set(userId,action);renderModeration();
}
async function loadChat(){const {data,error}=await supabaseClient.from("live_chat_messages").select("id,user_id,message,created_at").eq("room_id",room.id).order("created_at",{ascending:true}).limit(100);if(error){liveRoomStatus.textContent="Run live-room.sql in Supabase first.";return}chatList.replaceChildren();for(const item of data||[])addChat(item)}
async function addChat(item){const row=document.createElement("article");row.className="live-chat-message";row.dataset.chatId=item.id;row.innerHTML='<strong>Beyond user</strong><p>'+escapeHTML(item.message)+'</p>';const {data:p}=await supabaseClient.from("profiles").select("username,display_name").eq("id",item.user_id).maybeSingle();if(p){row.querySelector("strong").textContent=p.display_name||("@"+p.username);row.querySelector("strong").className="chat-user-name";row.querySelector("strong").title="Creator: click to moderate";row.querySelector("strong").onclick=()=>{if(room?.creator_id===user.id){const action=moderatedUsers.get(item.user_id)==="blocked"?"muted":"blocked";moderateUser(item.user_id,action)}}}chatList.appendChild(row);chatList.scrollTop=chatList.scrollHeight}
chatForm.addEventListener("submit",async e=>{e.preventDefault();const message=chatInput.value.trim();if(!message||!room)return;chatInput.value="";const {error}=await supabaseClient.from("live_chat_messages").insert({room_id:room.id,user_id:user.id,message});if(error){chatInput.value=message;liveRoomStatus.textContent=error.message||"Could not send message.";}});
document.querySelectorAll(".reaction-buttons button").forEach(btn=>btn.addEventListener("click",async()=>{if(!room)return;const reaction=btn.dataset.reaction;const {error}=await supabaseClient.from("live_reactions").insert({room_id:room.id,user_id:user.id,reaction});if(error){liveRoomStatus.textContent=error.message||"Could not send reaction.";return}showReaction(btn.textContent)}));
function showReaction(value){reactionFloat.textContent=value;reactionFloat.classList.remove("pop");void reactionFloat.offsetWidth;reactionFloat.classList.add("pop")}
cameraBtn.addEventListener("click",async()=>{
  if(!localStream){await enableCamera();return}
  const track=localStream.getVideoTracks()[0];
  if(!track)return;
  track.enabled=!track.enabled;
  cameraBtn.textContent=track.enabled?"📷 Camera on":"🚫 Camera off";
  cameraBtn.classList.toggle("off",!track.enabled);
});
micBtn.addEventListener("click",()=>{
  if(!localStream)return;
  const track=localStream.getAudioTracks()[0];
  if(!track)return;
  track.enabled=!track.enabled;
  micBtn.textContent=track.enabled?"🎙️ Mic on":"🔇 Mic off";
  micBtn.classList.toggle("off",!track.enabled);
});
endLiveBtn.addEventListener("click",async()=>{if(!room||room.creator_id!==user.id)return;if(!confirm("End this Beyond Live?"))return;const {error}=await supabaseClient.from("live_rooms").update({status:"ended",ended_at:new Date().toISOString()}).eq("id",room.id).eq("creator_id",user.id);if(error){liveRoomStatus.textContent=error.message;return}roomStatus.textContent="ENDED";endLiveBtn.disabled=true;if(localStream)localStream.getTracks().forEach(track=>track.stop());liveRoomStatus.textContent="Live stream ended.";if(channel)await supabaseClient.removeChannel(channel)});
function subscribeRealtime(){channel=supabaseClient.channel("live-room-"+room.id).on("postgres_changes",{event:"*",schema:"public",table:"live_chat_messages",filter:"room_id=eq."+room.id},payload=>{if(payload.eventType==="INSERT"&&!document.querySelector(`[data-chat-id="${payload.new.id}"]`))addChat(payload.new)}).on("postgres_changes",{event:"*",schema:"public",table:"live_reactions",filter:"room_id=eq."+room.id},payload=>{if(payload.eventType==="INSERT"){reactionCount.textContent=Number(reactionCount.textContent||0)+1;showReaction(payload.new.reaction==="love"?"❤️":payload.new.reaction==="fire"?"🔥":payload.new.reaction==="wow"?"😮":"👍")}}).on("postgres_changes",{event:"*",schema:"public",table:"live_viewers",filter:"room_id=eq."+room.id},()=>refreshStats()).on("postgres_changes",{event:"*",schema:"public",table:"live_rooms",filter:"id=eq."+room.id},payload=>{if(payload.new?.status==="ended"){roomStatus.textContent="ENDED";liveRoomStatus.textContent="This live stream has ended."}}).subscribe()}
function escapeHTML(value=""){const d=document.createElement("div");d.textContent=value;return d.innerHTML}window.addEventListener("beforeunload",async()=>{if(localStream)localStream.getTracks().forEach(track=>track.stop());if(room&&user)await supabaseClient.from("live_viewers").delete().eq("room_id",room.id).eq("user_id",user.id);if(channel)await supabaseClient.removeChannel(channel)});