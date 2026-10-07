const notificationsBtn=document.getElementById("notificationsBtn");
const notificationBadge=document.getElementById("notificationBadge");
const notificationsPanel=document.getElementById("notificationsPanel");
const closeNotificationsBtn=document.getElementById("closeNotificationsBtn");
const notificationsList=document.getElementById("notificationsList");

async function loadNotifications(){
  const user=await BeyondAuth.getCurrentUser();
  if(!user){notificationsList.innerHTML='<p class="comments-empty">Log in to see notifications.</p>';return;}
  const {data,error}=await supabaseClient.from("notifications").select("id,type,message,read_at,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(30);
  if(error){console.error(error);notificationsList.innerHTML='<p class="comments-empty">Run notifications.sql in Supabase first.</p>';return;}
  const unread=(data||[]).filter(n=>!n.read_at).length;
  notificationBadge.textContent=unread>9?"9+":unread;
  notificationBadge.hidden=unread===0;
  notificationsList.replaceChildren();
  if(!data?.length){notificationsList.innerHTML='<p class="comments-empty">No notifications yet.</p>';return;}
  data.forEach(n=>{const item=document.createElement("article");item.className="notification-item"+(n.read_at?"":" unread");item.innerHTML='<span class="notification-icon">'+(n.type==="comment"?"💬":n.type==="like"?"❤️":"👤")+'</span><div><strong>'+escapeHTML(n.message)+'</strong><small>'+formatTime(n.created_at)+'</small></div>';item.addEventListener("click",async()=>{await supabaseClient.from("notifications").update({read_at:new Date().toISOString()}).eq("id",n.id);item.classList.remove("unread");loadNotifications()});notificationsList.appendChild(item)});
}
function formatTime(value){const diff=Date.now()-new Date(value).getTime();const m=Math.floor(diff/60000);if(m<1)return"Just now";if(m<60)return m+"m ago";const h=Math.floor(m/60);if(h<24)return h+"h ago";return Math.floor(h/24)+"d ago"}
function escapeHTML(value=""){const d=document.createElement("div");d.textContent=value;return d.innerHTML}
notificationsBtn?.addEventListener("click",async()=>{notificationsPanel.hidden=false;document.body.classList.add("notifications-open");await loadNotifications()});
closeNotificationsBtn?.addEventListener("click",()=>{notificationsPanel.hidden=true;document.body.classList.remove("notifications-open")});
notificationsPanel?.addEventListener("click",e=>{if(e.target===notificationsPanel){notificationsPanel.hidden=true;document.body.classList.remove("notifications-open")}});
loadNotifications();
