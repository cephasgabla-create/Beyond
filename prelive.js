const previewVideo=document.getElementById("previewVideo");
const previewPlaceholder=document.getElementById("previewPlaceholder");
const liveTitle=document.getElementById("liveTitle");
const liveCategory=document.getElementById("liveCategory");
const cameraBtn=document.getElementById("cameraBtn");
const micBtn=document.getElementById("micBtn");
const cameraCheck=document.getElementById("cameraCheck");
const micCheck=document.getElementById("micCheck");
const cameraState=document.getElementById("cameraState");
const micState=document.getElementById("micState");
const goLiveBtn=document.getElementById("goLiveBtn");
const preliveStatus=document.getElementById("preliveStatus");
const liveCountdown=document.getElementById("liveCountdown");
const countdownNumber=document.getElementById("countdownNumber");

let stream=null;
let streamHandedOff=false;

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
  const category=liveCategory.value||"Chat";
  if(!stream){
    const ready=await startPreview();
    if(!ready)return;
  }

  if(!stream.getVideoTracks()[0]?.enabled){
    preliveStatus.textContent="Turn your camera on before going live.";
    return;
  }

  const liveWindow=window.open("about:blank","BeyondLiveRoom");
  if(!liveWindow){
    preliveStatus.textContent="Your browser blocked the Live Room window. Allow pop-ups for Beyond and try again.";
    return;
  }

  try{
    goLiveBtn.disabled=true;
    goLiveBtn.textContent="Preparing...";
    preliveStatus.textContent="Your stream is ready. Going live...";
    liveCountdown.hidden=false;

    for(const value of [3,2,1]){
      countdownNumber.textContent=value;
      await new Promise(resolve=>setTimeout(resolve,1000));
    }

    countdownNumber.textContent="LIVE";
    await new Promise(resolve=>setTimeout(resolve,500));
    liveCountdown.hidden=true;

    const {data,error}=await supabaseClient
      .from("live_rooms")
      .insert({creator_id:user.id,title,category,status:"live"})
      .select("id")
      .single();

    if(error)throw error;

    sessionStorage.setItem("beyondLivePreviewReady","true");
    sessionStorage.setItem("beyondLiveTitle",title);
    sessionStorage.setItem("beyondLiveCategory",category);

    liveWindow.location.href="live-room.html?room="+encodeURIComponent(data.id);

    const message={type:"beyond-live-stream",roomId:data.id,title,stream};
    let acknowledged=false;

    const acknowledge=event=>{
      if(event.origin!==location.origin||event.source!==liveWindow)return;
      if(event.data?.type==="beyond-live-stream-received"&&event.data.roomId===data.id){
        acknowledged=true;
        streamHandedOff=true;
        window.removeEventListener("message",acknowledge);
        preliveStatus.textContent="You're live. Your camera and microphone are now connected.";
        goLiveBtn.textContent="Live Room Open";
      }
    };
    window.addEventListener("message",acknowledge);

    const sendStream=()=>{
      if(acknowledged||liveWindow.closed)return;
      try{liveWindow.postMessage(message,location.origin,[stream]);}
      catch(error){console.error("Beyond stream handoff:",error);}
    };

    setTimeout(sendStream,350);
    const handoffTimer=setInterval(()=>{
      if(acknowledged||liveWindow.closed){clearInterval(handoffTimer);return;}
      sendStream();
    },300);

    setTimeout(()=>{
      clearInterval(handoffTimer);
      window.removeEventListener("message",acknowledge);
    },10000);
  }catch(error){
    console.error("Beyond Go Live:",error);
    liveCountdown.hidden=true;
    preliveStatus.textContent=error.message||"Could not start your live room.";
    goLiveBtn.disabled=false;
    goLiveBtn.textContent="🔴 Go Live";
    try{liveWindow.close()}catch(_){}
  }
});
window.addEventListener("beforeunload",()=>{
  if(!streamHandedOff)stream?.getTracks().forEach(track=>track.stop());
});
