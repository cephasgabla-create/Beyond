const previewVideo=document.getElementById("previewVideo");
const previewPlaceholder=document.getElementById("previewPlaceholder");
const liveTitle=document.getElementById("liveTitle");
const cameraBtn=document.getElementById("cameraBtn");
const micBtn=document.getElementById("micBtn");
const cameraCheck=document.getElementById("cameraCheck");
const micCheck=document.getElementById("micCheck");
const cameraState=document.getElementById("cameraState");
const micState=document.getElementById("micState");
const goLiveBtn=document.getElementById("goLiveBtn");
const preliveStatus=document.getElementById("preliveStatus");

let stream=null;

(async()=>{
  const user=await BeyondAuth.requireAuth("login.html");
  if(!user)return;
  preliveStatus.textContent="You're ready to set up your live.";
})();

async function startPreview(){
  if(!navigator.mediaDevices?.getUserMedia){
    preliveStatus.textContent="Camera and microphone access is not supported by this browser.";
    return false;
  }

  try{
    stream=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
    previewVideo.srcObject=stream;
    previewPlaceholder.hidden=true;
    updateDeviceState();
    preliveStatus.textContent="Camera and microphone are ready.";
    return true;
  }catch(error){
    console.error("Beyond pre-live:",error);
    preliveStatus.textContent="Camera or microphone permission was not granted.";
    return false;
  }
}

function updateDeviceState(){
  const videoTrack=stream?.getVideoTracks()[0];
  const audioTrack=stream?.getAudioTracks()[0];

  const cameraOn=Boolean(videoTrack?.enabled);
  const micOn=Boolean(audioTrack?.enabled);

  cameraCheck.textContent=cameraOn?"Ready":"Off";
  micCheck.textContent=micOn?"Ready":"Off";
  cameraState.textContent=cameraOn?"📷 Camera on":"🚫 Camera off";
  micState.textContent=micOn?"🎙️ Mic on":"🔇 Mic off";
  cameraBtn.textContent=cameraOn?"Turn camera off":"Turn camera on";
  micBtn.textContent=micOn?"Mute microphone":"Unmute microphone";
}

cameraBtn.addEventListener("click",async()=>{
  if(!stream){
    await startPreview();
    return;
  }
  const track=stream.getVideoTracks()[0];
  if(track)track.enabled=!track.enabled;
  updateDeviceState();
});

micBtn.addEventListener("click",async()=>{
  if(!stream){
    await startPreview();
    return;
  }
  const track=stream.getAudioTracks()[0];
  if(track)track.enabled=!track.enabled;
  updateDeviceState();
});

goLiveBtn.addEventListener("click",async()=>{
  const user=await BeyondAuth.getCurrentUser();
  if(!user){
    location.href="login.html?next=prelive.html";
    return;
  }

  const title=liveTitle.value.trim()||"Beyond Live";
  if(!stream){
    const ready=await startPreview();
    if(!ready)return;
  }

  if(!stream.getVideoTracks()[0]?.enabled){
    preliveStatus.textContent="Turn your camera on before going live.";
    return;
  }

  try{
    goLiveBtn.disabled=true;
    goLiveBtn.textContent="Starting Live...";
    preliveStatus.textContent="Creating your Beyond Live room...";

    const {data,error}=await supabaseClient
      .from("live_rooms")
      .insert({creator_id:user.id,title,status:"live"})
      .select("id")
      .single();

    if(error)throw error;

    sessionStorage.setItem("beyondLivePreviewReady","true");
    sessionStorage.setItem("beyondLiveTitle",title);

    location.href="live-room.html?room="+encodeURIComponent(data.id);
  }catch(error){
    console.error("Beyond Go Live:",error);
    preliveStatus.textContent=error.message||"Could not start your live room.";
    goLiveBtn.disabled=false;
    goLiveBtn.textContent="🔴 Go Live";
  }
});

window.addEventListener("beforeunload",()=>{
  stream?.getTracks().forEach(track=>track.stop());
});
