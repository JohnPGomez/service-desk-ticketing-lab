const KEY="servicedesk-pro-v2";
const SLA={P1:4,P2:8,P3:24,P4:72};
const state={tickets:load(),activeId:null,currentView:"dashboard"};
const $=id=>document.getElementById(id);

function uid(){return crypto?.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)}
function load(){try{return JSON.parse(localStorage.getItem(KEY))||[]}catch{return[]}}
function save(){localStorage.setItem(KEY,JSON.stringify(state.tickets))}
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function fmt(v){return new Intl.DateTimeFormat(undefined,{month:"short",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(v))}
function number(){const n=state.tickets.reduce((m,t)=>Math.max(m,+String(t.number||"").replace(/\D/g,"")||0),0);return"INC"+String(n+1).padStart(4,"0")}
function priority(impact,urgency){const m={"High|High":"P1","High|Medium":"P2","Medium|High":"P2","High|Low":"P3","Medium|Medium":"P3","Low|High":"P3","Medium|Low":"P4","Low|Medium":"P4","Low|Low":"P4"};return m[impact+"|"+urgency]||"P3"}
function due(t){return new Date(new Date(t.createdAt).getTime()+SLA[t.priority]*3600000)}
function risk(t){if(t.status==="Resolved")return false;const total=SLA[t.priority]*3600000;return due(t)-Date.now()<=total*.25}
function statusClass(s){return "status-"+s.toLowerCase().replaceAll(" ","-")}
function toast(msg){const el=$("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200)}

function setView(view){
  state.currentView=view;
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(v=>v.classList.toggle("active",v.dataset.view===view));
  $(view+"View").classList.add("active");
  const titles={dashboard:"Support Dashboard",tickets:"Incident Management",knowledge:"Knowledge Base",analytics:"Service Analytics"};
  $("pageTitle").textContent=titles[view];
  if(view==="analytics")renderAnalytics();
}
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
document.querySelectorAll("[data-view-jump]").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.viewJump)));

function openModal(id){$("modalBackdrop").classList.add("open");$(id).classList.add("open")}
function closeModals(){document.querySelectorAll(".modal").forEach(m=>m.classList.remove("open"));$("modalBackdrop").classList.remove("open")}
document.querySelectorAll(".close-modal").forEach(b=>b.addEventListener("click",closeModals));
$("modalBackdrop").addEventListener("click",closeModals);

$("newTicketBtn").addEventListener("click",()=>{
  $("ticketForm").reset();$("impact").value="Medium";$("urgency").value="Medium";updatePriorityPreview();openModal("ticketModal");
});
["impact","urgency"].forEach(id=>$(id).addEventListener("change",updatePriorityPreview));
function updatePriorityPreview(){const p=priority($("impact").value,$("urgency").value),el=$("priorityPreview");el.textContent=p;el.className="priority-badge "+p}

$("ticketForm").addEventListener("submit",e=>{
  e.preventDefault();
  const now=new Date().toISOString(),p=priority($("impact").value,$("urgency").value);
  state.tickets.push({
    id:uid(),number:number(),requester:$("requester").value.trim(),assignee:$("assignee").value.trim()||"Service Desk L1",
    subject:$("subject").value.trim(),description:$("description").value.trim(),category:$("category").value,
    impact:$("impact").value,urgency:$("urgency").value,priority:p,status:"Open",createdAt:now,updatedAt:now,
    notes:[{id:uid(),text:"Incident created and initial triage started.",createdAt:now}]
  });
  save();closeModals();renderAll();toast("Incident created successfully");
});

function renderAll(){
  renderMetrics();renderPriorityQueue();renderActivity();renderTable();renderDonut();$("sidebarCount").textContent=state.tickets.filter(t=>t.status!=="Resolved").length;
}
function counts(){
  return {
    open:state.tickets.filter(t=>t.status==="Open").length,
    progress:state.tickets.filter(t=>t.status==="In Progress").length,
    pending:state.tickets.filter(t=>t.status==="Pending").length,
    resolved:state.tickets.filter(t=>t.status==="Resolved").length,
    risk:state.tickets.filter(risk).length,total:state.tickets.length
  };
}
function renderMetrics(){const c=counts();$("metricOpen").textContent=c.open;$("metricProgress").textContent=c.progress;$("metricRisk").textContent=c.risk;$("metricResolved").textContent=c.resolved}
function renderPriorityQueue(){
  const rows=[...state.tickets].filter(t=>t.status!=="Resolved").sort((a,b)=>a.priority.localeCompare(b.priority)||new Date(a.createdAt)-new Date(b.createdAt)).slice(0,5);
  $("priorityQueue").innerHTML=rows.length?rows.map(t=>`<div class="queue-item" data-open="${t.id}">
    <div class="queue-number">${t.number}</div>
    <div><strong>${esc(t.subject)}</strong><small>${esc(t.requester)} • ${esc(t.category)}</small></div>
    <span class="priority-badge ${t.priority}">${t.priority}</span>
  </div>`).join(""):`<div class="empty-state">No active incidents.</div>`;
  document.querySelectorAll("[data-open]").forEach(el=>el.addEventListener("click",()=>openDetail(el.dataset.open)));
}
function renderActivity(){
  const items=[...state.tickets].sort((a,b)=>new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt)).slice(0,6);
  $("activityFeed").innerHTML=items.length?items.map(t=>`<div class="activity-item">
    <div class="activity-icon">${t.status==="Resolved"?"✓":"↻"}</div>
    <div><p><b>${esc(t.number)}</b> — ${esc(t.subject)}</p><small>${esc(t.status)} • ${esc(t.assignee)}</small></div>
    <small>${fmt(t.updatedAt||t.createdAt)}</small>
  </div>`).join(""):`<div class="empty-state">No recent activity.</div>`;
}
function renderDonut(){
  const c=counts();$("totalTickets").textContent=c.total;$("legendOpen").textContent=c.open;$("legendProgress").textContent=c.progress;$("legendPending").textContent=c.pending;$("legendResolved").textContent=c.resolved;
  if(!c.total){$("donutChart").style.background="#122029";return}
  let a=c.open/c.total*100,b=a+c.progress/c.total*100,d=b+c.pending/c.total*100;
  $("donutChart").style.background=`conic-gradient(var(--accent) 0 ${a}%,var(--purple) ${a}% ${b}%,var(--warn) ${b}% ${d}%,var(--success) ${d}% 100%)`;
}
function renderTable(){
  const q=$("searchInput").value.trim().toLowerCase(),sf=$("statusFilter").value,pf=$("priorityFilter").value;
  const rows=[...state.tickets].filter(t=>{
    const matches=!q||[t.number,t.subject,t.requester,t.category,t.assignee].join(" ").toLowerCase().includes(q);
    return matches&&(!sf||t.status===sf)&&(!pf||t.priority===pf)
  }).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  $("ticketTableBody").innerHTML=rows.map(t=>`<tr class="ticket-row" data-row="${t.id}">
    <td><div class="incident-cell"><strong>${esc(t.number)}</strong><span>${esc(t.subject)}</span></div></td>
    <td>${esc(t.requester)}</td><td>${esc(t.category)}</td>
    <td><span class="priority-badge ${t.priority}">${t.priority}</span></td>
    <td><span class="status-badge ${statusClass(t.status)}">${esc(t.status)}</span></td>
    <td>${esc(t.assignee)}</td>
    <td class="${risk(t)?"sla-risk":""}">${risk(t)?"AT RISK":fmt(due(t))}</td>
  </tr>`).join("");
  $("emptyTickets").style.display=rows.length?"none":"block";
  document.querySelectorAll("[data-row]").forEach(el=>el.addEventListener("click",()=>openDetail(el.dataset.row)));
}
["searchInput","statusFilter","priorityFilter"].forEach(id=>{$(id).addEventListener("input",renderTable);$(id).addEventListener("change",renderTable)});

function openDetail(id){
  const t=state.tickets.find(x=>x.id===id);if(!t)return;state.activeId=id;
  $("detailNumber").textContent=t.number;$("detailSubject").textContent=t.subject;$("detailDescription").textContent=t.description;
  $("detailPriority").textContent=t.priority;$("detailPriority").className="priority-badge "+t.priority;
  $("detailRequester").textContent=t.requester;$("detailCategory").textContent=t.category;$("detailImpact").textContent=t.impact;$("detailUrgency").textContent=t.urgency;
  $("detailCreated").textContent=fmt(t.createdAt);$("detailSla").textContent=fmt(due(t));$("detailStatus").value=t.status;$("detailAssignee").value=t.assignee;
  renderNotes(t);openModal("detailModal");
}
function renderNotes(t){
  $("notesList").innerHTML=(t.notes||[]).slice().reverse().map(n=>`<div class="note-item">${esc(n.text)}<small>${fmt(n.createdAt)}</small></div>`).join("")||`<div class="empty-state">No work notes yet.</div>`;
}
$("addNoteBtn").addEventListener("click",()=>{
  const t=state.tickets.find(x=>x.id===state.activeId),text=$("noteText").value.trim();if(!t||!text)return;
  const now=new Date().toISOString();t.notes.push({id:uid(),text,createdAt:now});t.updatedAt=now;$("noteText").value="";save();renderNotes(t);renderAll();toast("Work note added");
});
$("saveTicketBtn").addEventListener("click",()=>{
  const t=state.tickets.find(x=>x.id===state.activeId);if(!t)return;const old=t.status,now=new Date().toISOString();
  t.status=$("detailStatus").value;t.assignee=$("detailAssignee").value.trim()||"Unassigned";t.updatedAt=now;
  if(old!==t.status)t.notes.push({id:uid(),text:`Status changed from ${old} to ${t.status}.`,createdAt:now});
  save();closeModals();renderAll();toast("Incident updated");
});
$("deleteTicketBtn").addEventListener("click",()=>{
  if(!state.activeId||!confirm("Delete this incident?"))return;state.tickets=state.tickets.filter(t=>t.id!==state.activeId);save();closeModals();renderAll();toast("Incident deleted");
});

$("seedBtn").addEventListener("click",()=>{
  if(state.tickets.length&&!confirm("Add demo tickets to the current queue?"))return;
  const base=Date.now();
  const demos=[
    ["Maria Santos","VPN authentication failure","Remote employee cannot connect after a password change.","Network / VPN","Medium","High","John Paul","In Progress",5],
    ["Daniel Cruz","MFA prompt loop","Repeated MFA prompts prevent access to Outlook and Teams.","Identity & Access","Medium","Medium","John Paul","Open",18],
    ["Operations Team","Shared workstation unavailable","Critical shared workstation fails to boot.","Windows / Endpoint","High","High","Service Desk L1","Open",3.3],
    ["Kevin Lee","Outlook mailbox access restored","Mailbox access restored after credential and profile troubleshooting.","Microsoft 365","Low","Medium","John Paul","Resolved",30],
    ["Angela Reyes","Adobe application crashes","Application closes immediately after launch.","Software","Low","Medium","Service Desk L1","Pending",22]
  ];
  for(const d of demos){
    const createdAt=new Date(base-d[8]*3600000).toISOString(),p=priority(d[4],d[5]);
    state.tickets.push({id:uid(),number:number(),requester:d[0],subject:d[1],description:d[2],category:d[3],impact:d[4],urgency:d[5],assignee:d[6],status:d[7],createdAt,updatedAt:createdAt,priority:p,
      notes:[{id:uid(),text:"Incident logged and categorized.",createdAt},{id:uid(),text:"Initial troubleshooting completed and user updated.",createdAt:new Date(new Date(createdAt).getTime()+25*60000).toISOString()}]});
  }
  save();renderAll();toast("Demo data loaded");
});
$("exportBtn").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify(state.tickets,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="servicedesk-pro-tickets.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast("JSON export generated");
});

function renderAnalytics(){
  const c=counts();$("aTotal").textContent=c.total;$("aResolved").textContent=c.resolved;$("aRate").textContent=c.total?Math.round(c.resolved/c.total*100)+"%":"0%";$("aRisk").textContent=c.risk;
  const by={};state.tickets.forEach(t=>by[t.category]=(by[t.category]||0)+1);const max=Math.max(1,...Object.values(by));
  $("categoryBars").innerHTML=Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="bar-row"><span>${esc(k)}</span><div class="bar-track"><div class="bar-fill" style="width:${v/max*100}%"></div></div><b>${v}</b></div>`).join("")||`<div class="empty-state">No analytics yet.</div>`;
}

const KB={
 vpn:{title:"VPN Connectivity Troubleshooting",html:`<p>Use this workflow for a user who cannot establish a remote-access VPN connection.</p><h3>Recommended workflow</h3><ol><li>Confirm the user's local internet connection.</li><li>Capture the exact VPN error message or code.</li><li>Verify user credentials and account status.</li><li>Check the VPN client profile and configuration.</li><li>Test DNS and basic network connectivity.</li><li>Determine whether one user or multiple users are affected.</li><li>Escalate with logs, timestamps, user impact, and completed troubleshooting.</li></ol>`},
 mfa:{title:"Microsoft 365 MFA Sign-In Issues",html:`<p>Use this workflow for repeated MFA prompts, failed authentication, or inaccessible Microsoft 365 services.</p><h3>Recommended workflow</h3><ol><li>Verify the user's identity.</li><li>Confirm account status and affected Microsoft 365 services.</li><li>Review registered authentication methods.</li><li>Check whether re-registration is appropriate.</li><li>Retest sign-in through a browser.</li><li>Document the result and escalate if policy or tenant-level issues are suspected.</li></ol>`},
 ad:{title:"Repeated Active Directory Lockout",html:`<p>Use this workflow when a user is repeatedly locked after changing a password.</p><h3>Potential causes</h3><ul><li>Cached credentials</li><li>Mapped drives</li><li>VPN clients</li><li>Outlook or mobile email</li><li>Windows services</li><li>Scheduled tasks</li></ul><h3>Action</h3><p>Identify the stale credential source, update it, retest authentication, and document the root cause.</p>`}
};
document.querySelectorAll(".kb-open").forEach(b=>b.addEventListener("click",()=>{const x=KB[b.dataset.kb];$("kbTitle").textContent=x.title;$("kbContent").innerHTML=x.html;openModal("kbModal")}));

renderAll();updatePriorityPreview();
