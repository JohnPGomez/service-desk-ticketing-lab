const STORAGE_KEY="serviceDeskTicketsV1";
const SLA_HOURS={P1:4,P2:8,P3:24,P4:72};
const state={tickets:loadTickets(),activeId:null};
const $=id=>document.getElementById(id);

function loadTickets(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||[]}catch{return[]}}
function saveTickets(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state.tickets))}
function uid(){return crypto?.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)}
function ticketNumber(){const max=state.tickets.reduce((m,t)=>Math.max(m,Number((t.number||"").replace(/\D/g,""))||0),0);return"INC"+String(max+1).padStart(4,"0")}
function priorityFrom(impact,urgency){const m={"High|High":"P1","High|Medium":"P2","Medium|High":"P2","High|Low":"P3","Medium|Medium":"P3","Low|High":"P3","Medium|Low":"P4","Low|Medium":"P4","Low|Low":"P4"};return m[`${impact}|${urgency}`]||"P3"}
function slaDue(createdAt,priority){return new Date(new Date(createdAt).getTime()+SLA_HOURS[priority]*3600000)}
function fmt(date){return new Intl.DateTimeFormat(undefined,{year:"numeric",month:"short",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(date))}
function isSlaRisk(t){if(t.status==="Resolved")return false;const due=slaDue(t.createdAt,t.priority),left=due-new Date(),total=SLA_HOURS[t.priority]*3600000;return left<=total*.25}
function escapeHtml(s=""){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

function render(){renderStats();renderTickets()}
function renderStats(){
 $("statOpen").textContent=state.tickets.filter(t=>t.status==="Open").length;
 $("statProgress").textContent=state.tickets.filter(t=>t.status==="In Progress").length;
 $("statResolved").textContent=state.tickets.filter(t=>t.status==="Resolved").length;
 $("statRisk").textContent=state.tickets.filter(isSlaRisk).length;
}
function renderTickets(){
 const q=$("search").value.trim().toLowerCase(),status=$("statusFilter").value,priority=$("priorityFilter").value;
 const rows=state.tickets.filter(t=>{
   const matches=!q||[t.number,t.subject,t.requester,t.category,t.assignee].join(" ").toLowerCase().includes(q);
   return matches&&(!status||t.status===status)&&(!priority||t.priority===priority)
 }).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
 $("ticketList").innerHTML=rows.map(t=>{
   const risk=isSlaRisk(t);
   return `<article class="ticket" data-id="${t.id}">
    <div class="ticket-number">${t.number}</div>
    <div class="ticket-title"><strong>${escapeHtml(t.subject)}</strong><span>${escapeHtml(t.requester)} • ${escapeHtml(t.category)}</span></div>
    <span class="priority ${t.priority}">${t.priority}</span>
    <span class="status hide-mobile">${escapeHtml(t.status)}</span>
    <span class="ticket-meta hide-tablet ${risk?"sla-risk":""}">${risk?"SLA RISK":"Due "+fmt(slaDue(t.createdAt,t.priority))}</span>
   </article>`
 }).join("");
 $("emptyState").style.display=rows.length?"none":"block";
 document.querySelectorAll(".ticket").forEach(el=>el.addEventListener("click",()=>openTicket(el.dataset.id)));
}

$("ticketForm").addEventListener("submit",e=>{
 e.preventDefault();
 const impact=$("impact").value,urgency=$("urgency").value,priority=priorityFrom(impact,urgency),now=new Date().toISOString();
 state.tickets.push({
  id:uid(),number:ticketNumber(),requester:$("requester").value.trim(),subject:$("subject").value.trim(),
  description:$("description").value.trim(),category:$("category").value,assignee:$("assignee").value.trim()||"Service Desk L1",
  impact,urgency,priority,status:"Open",createdAt:now,
  notes:[{id:uid(),text:"Incident created and initial triage started.",createdAt:now}]
 });
 saveTickets();e.target.reset();$("impact").value="Medium";$("urgency").value="Medium";render();
});

function openTicket(id){
 const t=state.tickets.find(x=>x.id===id);if(!t)return;state.activeId=id;
 $("detailNumber").textContent=t.number;$("detailSubject").textContent=t.subject;$("detailDescription").textContent=t.description;
 $("detailPriority").textContent=t.priority;$("detailPriority").className=`priority-badge priority ${t.priority}`;
 $("detailRequester").textContent=t.requester;$("detailCategory").textContent=t.category;$("detailImpact").textContent=t.impact;$("detailUrgency").textContent=t.urgency;
 $("detailCreated").textContent=fmt(t.createdAt);$("detailSla").textContent=fmt(slaDue(t.createdAt,t.priority));
 $("detailStatus").value=t.status;$("detailAssignee").value=t.assignee;renderNotes(t);$("ticketDialog").showModal();
}
function renderNotes(t){
 $("notesList").innerHTML=(t.notes||[]).slice().reverse().map(n=>`<div class="note">${escapeHtml(n.text)}<small>${fmt(n.createdAt)}</small></div>`).join("")||`<div class="muted">No notes yet.</div>`;
}
$("addNoteBtn").addEventListener("click",()=>{
 const text=$("noteText").value.trim();if(!text||!state.activeId)return;const t=state.tickets.find(x=>x.id===state.activeId);
 t.notes||=[];t.notes.push({id:uid(),text,createdAt:new Date().toISOString()});$("noteText").value="";saveTickets();renderNotes(t);
});
$("saveTicketBtn").addEventListener("click",()=>{
 const t=state.tickets.find(x=>x.id===state.activeId);if(!t)return;const old=t.status;t.status=$("detailStatus").value;t.assignee=$("detailAssignee").value.trim()||"Unassigned";
 if(old!==t.status){t.notes||=[];t.notes.push({id:uid(),text:`Status changed from ${old} to ${t.status}.`,createdAt:new Date().toISOString()})}
 saveTickets();render();$("ticketDialog").close();
});
$("deleteTicketBtn").addEventListener("click",()=>{
 if(!state.activeId||!confirm("Delete this ticket?"))return;state.tickets=state.tickets.filter(t=>t.id!==state.activeId);saveTickets();render();$("ticketDialog").close();
});
["search","statusFilter","priorityFilter"].forEach(id=>{$(id).addEventListener("input",renderTickets);$(id).addEventListener("change",renderTickets)});

$("seedBtn").addEventListener("click",()=>{
 if(state.tickets.length&&!confirm("Add demo tickets to the existing queue?"))return;
 const now=Date.now();
 const samples=[
  ["Maria Santos","VPN authentication failure","Remote employee cannot connect to corporate VPN after password change.","Network / VPN","Medium","High","Service Desk L1","In Progress",5],
  ["Daniel Cruz","Microsoft 365 MFA prompt loop","User repeatedly receives MFA prompts and cannot open Outlook or Teams.","Identity & Access","Medium","Medium","John Paul","Open",18],
  ["Operations Team","Shared workstation unavailable","Critical shared workstation used by operations fails to boot.","Windows / Endpoint","High","High","Service Desk L1","Open",3.4],
  ["Kevin Lee","Outlook mailbox access restored","Mailbox issue resolved after credential and profile troubleshooting.","Microsoft 365","Low","Medium","John Paul","Resolved",30]
 ];
 for(const s of samples){
  const createdAt=new Date(now-s[8]*3600000).toISOString(),priority=priorityFrom(s[4],s[5]);
  state.tickets.push({id:uid(),number:ticketNumber(),requester:s[0],subject:s[1],description:s[2],category:s[3],impact:s[4],urgency:s[5],assignee:s[6],status:s[7],createdAt,priority,
  notes:[{id:uid(),text:"Incident created and categorized.",createdAt},{id:uid(),text:"Initial troubleshooting and user verification completed.",createdAt:new Date(new Date(createdAt).getTime()+25*60000).toISOString()}]});
 }
 saveTickets();render();
});
$("resetBtn").addEventListener("click",()=>{if(!confirm("Clear all locally stored tickets?"))return;state.tickets=[];saveTickets();render()});
$("exportBtn").addEventListener("click",()=>{
 const blob=new Blob([JSON.stringify(state.tickets,null,2)],{type:"application/json"}),a=document.createElement("a");
 a.href=URL.createObjectURL(blob);a.download="service-desk-tickets.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
});
render();