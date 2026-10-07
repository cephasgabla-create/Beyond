const form=document.getElementById("searchForm"),input=document.getElementById("searchInput"),results=document.getElementById("searchResults"),status=document.getElementById("searchStatus");
form.addEventListener("submit",e=>{e.preventDefault();searchCreators(input.value.trim())});
async function searchCreators(term){
 if(!term){results.replaceChildren();status.textContent="Type a username or creator name.";return}
 status.textContent="Searching...";results.replaceChildren();
 const safe=term.replace(/[%_]/g,"\\$&");
 const {data,error}=await supabaseClient.from("profiles").select("id,username,display_name,bio,avatar_url").or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`).order("username").limit(30);
 if(error){console.error(error);status.textContent="Search failed. Run creator-profile.sql in Supabase.";return}
 status.textContent=data.length?`${data.length} creator${data.length===1?"":"s"} found`:"No creators found.";
 data.forEach(p=>{const card=document.createElement("a");card.className="creator-card";card.href="profile.html?user="+encodeURIComponent(p.id);card.innerHTML=`<div class="creator-avatar">${p.avatar_url?`<img src="${escapeHTML(p.avatar_url)}" alt="">`:`<span>${escapeHTML((p.display_name||"B").charAt(0).toUpperCase())}</span>`}</div><div class="creator-info"><strong>${escapeHTML(p.display_name)}</strong><span>@${escapeHTML(p.username)}</span><p>${escapeHTML(p.bio||"")}</p></div>`;results.appendChild(card)})}
function escapeHTML(v=""){const d=document.createElement("div");d.textContent=v;return d.innerHTML}