/* ════════════════════════════════════════════
   JIMS Attendance System — Frontend (app.js)
════════════════════════════════════════════ */

const session = { role:'student', currentUser:null, currentStudent:null };

// ── UTILITIES ──────────────────────────────────────────────────────────────
function ini(n){ return (n||'').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2); }
function fmtDate(ds){
  if(!ds) return '—';
  const [y,m,d]=ds.split('-'), mo=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${mo[parseInt(m)-1]} ${y}`;
}
function badgeCls(s){ return s==='approved'?'badge-green':s==='rejected'?'badge-red':'badge-amber'; }
function badgeIcon(s){ return s==='approved'?'✓':s==='rejected'?'✕':'⏳'; }
function updateTopbarDate(){
  const el=document.getElementById('topbar-date');
  if(el) el.textContent=new Date().toLocaleDateString('en-IN',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
}

// ── COLOR PALETTE ──────────────────────────────────────────────────────────
const SUBJECT_COLORS=[
  {hex:'#1a7a6e',name:'Teal'},      {hex:'#9333ea',name:'Purple'},
  {hex:'#c94040',name:'Red'},        {hex:'#d97706',name:'Amber'},
  {hex:'#1e40af',name:'Blue'},       {hex:'#be185d',name:'Pink'},
  {hex:'#0891b2',name:'Cyan'},       {hex:'#7c3aed',name:'Violet'},
  {hex:'#15803d',name:'Green'},      {hex:'#ea580c',name:'Orange'},
  {hex:'#0f766e',name:'Dark Teal'},  {hex:'#dc2626',name:'Crimson'},
  {hex:'#2563eb',name:'Royal Blue'}, {hex:'#16a34a',name:'Emerald'},
  {hex:'#b45309',name:'Gold'},       {hex:'#6d28d9',name:'Indigo'},
  {hex:'#0e7490',name:'Ocean'},      {hex:'#9f1239',name:'Ruby'},
  {hex:'#064e3b',name:'Forest'},     {hex:'#92400e',name:'Copper'},
];
function colorName(hex){ return SUBJECT_COLORS.find(c=>c.hex===hex)?.name||hex; }

// ── TOAST ──────────────────────────────────────────────────────────────────
let _tt;
function showToast(msg,type='info'){
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.style.background=type==='success'?'#15803d':type==='error'?'#dc2626':'#0f172a';
  t.classList.add('show'); clearTimeout(_tt);
  _tt=setTimeout(()=>t.classList.remove('show'),3200);
}

// ── API ────────────────────────────────────────────────────────────────────
async function api(method,url,body){
  try{
    const opts={method,headers:{'Content-Type':'application/json'}};
    if(body) opts.body=JSON.stringify(body);
    const res=await fetch(url,opts);
    const data=await res.json();
    if(!res.ok) throw new Error(data.error||'Request failed');
    return data;
  }catch(e){ showToast('⚠️ '+e.message,'error'); throw e; }
}

// ── LOGIN / LOGOUT ─────────────────────────────────────────────────────────
function setRole(r, btn){
  session.role=r;
  document.querySelectorAll('.role-tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  if(r==='admin'){
    document.getElementById('login-id').value='ADMIN001';
    document.getElementById('login-pass').value='admin123';
    document.getElementById('demo-hint').textContent='Demo: ADMIN001 / admin123';
    document.getElementById('id-label').textContent='Admin ID';
  } else {
    document.getElementById('login-id').value='04614004425';
    document.getElementById('login-pass').value='password123';
    document.getElementById('demo-hint').textContent='Demo: 04614004425 / password123';
    document.getElementById('id-label').textContent='Student ID';
  }
  document.getElementById('login-error').style.display='none';
}

async function doLogin(){
  const username=document.getElementById('login-id').value.trim();
  const password=document.getElementById('login-pass').value.trim();
  const errEl=document.getElementById('login-error');
  const btn=document.getElementById('login-btn');
  errEl.style.display='none';
  if(!username||!password){ errEl.textContent='⚠️ Please enter your credentials.'; errEl.style.display='block'; return; }
  btn.textContent='Signing in…'; btn.disabled=true;
  try{
    const user=await api('POST','/api/login',{username,password,role:session.role});
    session.currentUser=user;
    if(session.role==='admin'){
      document.getElementById('sb-avatar').textContent='AD';
      document.getElementById('sb-name').textContent='Administrator';
      document.getElementById('sb-role').textContent='Admin';
      buildAdminNav();
    } else {
      session.currentStudent=user.student;
      const stu=user.student;
      document.getElementById('sb-avatar').textContent=ini(stu.name);
      document.getElementById('sb-name').textContent=stu.name;
      document.getElementById('sb-role').textContent=`${stu.section} · Sem ${stu.semester}`;
      buildStudentNav();
    }
    document.getElementById('login-screen').style.display='none';
    document.getElementById('app').style.display='block';
    updateTopbarDate(); loadNotifications();
    showPage(session.role==='admin'?'admin-dashboard':'student-dashboard');
  } catch(e){
    errEl.textContent='❌ Invalid credentials. Please check your ID and password.';
    errEl.style.display='block';
  } finally { btn.textContent='Sign In →'; btn.disabled=false; }
}

async function doLogout(){
  await fetch('/api/logout',{method:'POST'});
  session.currentUser=session.currentStudent=null;
  document.querySelectorAll('.page-content').forEach(p=>{p.innerHTML='';p.classList.remove('active');});
  document.getElementById('app').style.display='none';
  document.getElementById('login-screen').style.display='flex';
  document.getElementById('login-error').style.display='none';
  document.getElementById('notif-panel')?.remove();
}

// ── NAVIGATION ─────────────────────────────────────────────────────────────
function buildStudentNav(){
  buildNav([
    {id:'student-dashboard', icon:'⊞',  label:'Dashboard'},
    {id:'student-attendance',icon:'📅', label:'My Attendance'},
    {id:'student-leave',     icon:'📝', label:'Apply Leave'},
    {id:'student-history',   icon:'🗂', label:'Leave History'},
    {id:'student-profile',   icon:'👤', label:'My Profile'},
  ]);
}
function buildAdminNav(){
  buildNav([
    {id:'admin-dashboard',  icon:'⊞',  label:'Dashboard'},
    {id:'admin-attendance', icon:'📋', label:'Manage Attendance'},
    {id:'admin-leaves',     icon:'📋', label:'Leave Requests'},
    {id:'admin-students',   icon:'👥', label:'Students'},
    {id:'admin-subjects',   icon:'📚', label:'Subjects'},
    {id:'admin-reports',    icon:'📊', label:'Reports'},
  ]);
}
function buildNav(items){
  document.getElementById('sidebar-nav').innerHTML=items.map(it=>
    `<button class="nav-item" id="nav-${it.id}" onclick="showPage('${it.id}')">
       <span class="nav-icon">${it.icon}</span>${it.label}
     </button>`).join('');
}

const PAGE_TITLES={
  'student-dashboard':'My Dashboard','student-attendance':'Attendance Record',
  'student-leave':'Apply for Leave','student-history':'Leave History','student-profile':'My Profile',
  'admin-dashboard':'Admin Dashboard','admin-attendance':'Manage Attendance',
  'admin-leaves':'Leave Requests','admin-students':'Student Management',
  'admin-subjects':'Subject Management','admin-reports':'Reports & Analytics',
};

function showPage(id){
  document.querySelectorAll('.page-content').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const page=document.getElementById('page-'+id);
  if(!page) return;
  if(!page.innerHTML.trim()) buildPage(id,page);
  page.classList.add('active');
  document.getElementById('nav-'+id)?.classList.add('active');
  document.getElementById('topbar-title').textContent=PAGE_TITLES[id]||id;
  document.getElementById('notif-panel')?.remove();
}

function buildPage(id,el){
  const map={
    'student-dashboard': buildStudentDashboard,
    'student-attendance':buildStudentAttendance,
    'student-leave':     buildStudentLeave,
    'student-history':   buildStudentHistory,
    'student-profile':   buildStudentProfile,
    'admin-dashboard':   buildAdminDashboard,
    'admin-attendance':  buildAdminAttendance,
    'admin-leaves':      buildAdminLeaves,
    'admin-students':    buildAdminStudents,
    'admin-subjects':    buildAdminSubjects,
    'admin-reports':     buildAdminReports,
  };
  if(map[id]) map[id](el);
}

function invalidatePage(...ids){
  ids.forEach(id=>{
    const el=document.getElementById('page-'+id);
    if(!el) return;
    if(el.classList.contains('active')){
      // Page is currently visible — rebuild it immediately
      el.innerHTML='';
      buildPage(id,el);
    } else {
      el.innerHTML=''; // Will rebuild next time user navigates to it
    }
  });
}

// ── NOTIFICATIONS ──────────────────────────────────────────────────────────
let _notifs=[];
async function loadNotifications(){
  try{
    _notifs=await api('GET','/api/notifications');
    const dot=document.querySelector('.notif-dot');
    if(dot) dot.style.display=_notifs.length>0?'block':'none';
  } catch(e){}
}

function toggleNotifPanel(){
  const existing=document.getElementById('notif-panel');
  if(existing){ existing.remove(); return; }
  const panel=document.createElement('div');
  panel.id='notif-panel';
  panel.style.cssText=`position:fixed;top:68px;right:20px;width:340px;background:var(--card);
    border:1.5px solid var(--border);border-radius:14px;box-shadow:var(--shadow-lg);z-index:500;overflow:hidden;`;
  const header=`<div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
    <div style="font-family:'DM Serif Display',serif;font-size:16px">Notifications</div>
    <span data-notif-count style="font-size:12px;color:var(--muted)">${_notifs.length} item${_notifs.length!==1?'s':''}</span>
  </div>`;
  function renderNotifBody(){
    if(_notifs.length===0)
      return `<div class="empty-state" style="padding:32px"><div class="empty-state-icon">🔔</div><div class="empty-state-text">All clear!</div></div>`;
    return _notifs.map((n,i)=>`
    <div id="notif-item-${i}" style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;gap:12px;align-items:flex-start">
      <div style="font-size:20px;flex-shrink:0">${n.type.includes('pending')?'⏳':n.type.includes('approved')?'✅':'❌'}</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:500;line-height:1.4">${n.message}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">${fmtDate(n.date)}</div>
      </div>
      <button onclick="dismissNotif(${i})" title="Dismiss"
        style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:18px;line-height:1;padding:2px 6px;border-radius:4px;flex-shrink:0;transition:color .15s"
        onmouseenter="this.style.color='var(--ink)'" onmouseleave="this.style.color='var(--muted)'">×</button>
    </div>`).join('');
  }
  const bodyWrap=document.createElement('div');
  bodyWrap.id='notif-body';
  bodyWrap.style.cssText='max-height:360px;overflow-y:auto';
  bodyWrap.innerHTML=renderNotifBody();
  panel.innerHTML=header;
  panel.appendChild(bodyWrap);
  window.dismissNotif=function(i){
    _notifs.splice(i,1);
    const dot=document.querySelector('.notif-dot');
    if(dot) dot.style.display=_notifs.length>0?'block':'none';
    const countEl=panel.querySelector('[data-notif-count]');
    if(countEl) countEl.textContent=`${_notifs.length} item${_notifs.length!==1?'s':''}`;
    const wrap=document.getElementById('notif-body');
    if(wrap) wrap.innerHTML=renderNotifBody();
  };
  document.body.appendChild(panel);
  // Close on outside click
  setTimeout(()=>document.addEventListener('click',function h(e){
    if(!panel.contains(e.target)&&!e.target.closest('.notif-btn')){
      panel.remove(); document.removeEventListener('click',h);
    }
  }),50);
}

// ══════════════════════════════════════════════
//  STUDENT — DASHBOARD
// ══════════════════════════════════════════════
async function buildStudentDashboard(el){
  el.innerHTML='<div class="loading-state">Loading dashboard…</div>';
  const stu=session.currentStudent;
  const [stats,leaves]=await Promise.all([
    api('GET',`/api/stats/student/${stu.dbId}`),
    api('GET',`/api/leaves?studentDbId=${stu.dbId}`)
  ]);
  const {summary,subjects}=stats;
  el.innerHTML=`
  <div class="stats-grid">
    <div class="stat-card teal"><div class="stat-icon">📅</div><div class="stat-label">Overall Attendance</div>
      <div class="stat-value" style="color:var(--teal)">${summary.percentage}%</div>
      <div class="stat-change ${summary.percentage>=75?'up':'down'}">${summary.percentage>=75?'✓ Above 75%':'⚠ Below 75% — at risk'}</div></div>
    <div class="stat-card gold"><div class="stat-icon">📆</div><div class="stat-label">Days Present</div>
      <div class="stat-value" style="color:var(--gold)">${summary.present}</div>
      <div class="stat-change">Out of ${summary.total} working days</div></div>
    <div class="stat-card rose"><div class="stat-icon">🚫</div><div class="stat-label">Days Absent</div>
      <div class="stat-value" style="color:var(--danger)">${summary.absent}</div>
      <div class="stat-change down">${summary.onLeave} on approved leave</div></div>
    <div class="stat-card amber"><div class="stat-icon">📝</div><div class="stat-label">Leave Requests</div>
      <div class="stat-value" style="color:var(--warn)">${leaves.length}</div>
      <div class="stat-change">${leaves.filter(l=>l.status==='pending').length} pending review</div></div>
  </div>
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><div class="card-title">Subject-wise Attendance</div><span class="text-muted">Semester ${stu.semester}</span></div>
      <div class="card-body">
        ${subjects.map(sub=>`
          <div class="subject-row">
            <div class="subject-color" style="background:${sub.color}"></div>
            <div style="flex:1">
              <div class="subject-name">${sub.name}</div>
              <div class="subject-meta">${sub.classes} classes attended${sub.onLeave>0?` · ${sub.onLeave} on leave`:''}</div>
              <div class="progress-bar" style="margin-top:6px"><div class="progress-fill" style="width:${sub.pct}%;background:${sub.color}"></div></div>
            </div>
            <div class="subject-pct" style="color:${sub.pct<75?'var(--danger)':sub.color}">${sub.pct}%</div>
          </div>`).join('')}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:20px">
      <div class="card">
        <div class="card-header"><div class="card-title">Recent Leave Status</div>
          <button class="btn-secondary" style="padding:6px 14px;font-size:12px" onclick="showPage('student-leave')">+ New</button></div>
        <div class="card-body" style="padding:0">
          ${leaves.length===0?`<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">No leave requests</div></div>`
          :leaves.slice(0,4).map(l=>`
            <div style="padding:14px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
              <div><div style="font-size:14px;font-weight:500">${l.type} Leave</div>
                <div style="font-size:12px;color:var(--muted);margin-top:2px">${fmtDate(l.fromDate)} → ${fmtDate(l.toDate)} (${l.days}d)</div></div>
              <span class="badge ${badgeCls(l.status)}">${badgeIcon(l.status)} ${l.status}</span>
            </div>`).join('')}
          <div style="padding:14px 24px"><button class="btn-secondary" style="width:100%;padding:10px;font-size:13px" onclick="showPage('student-history')">View All History</button></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Attendance Alert</div></div>
        <div class="card-body">
          ${subjects.filter(s=>s.pct<75).length===0
            ?`<div style="display:flex;gap:12px;align-items:flex-start;padding:12px;background:var(--success-light);border-radius:10px">
                <span style="font-size:20px">✅</span>
                <div><div style="font-size:14px;font-weight:600;color:#15803d">All subjects on track!</div>
                  <div style="font-size:13px;color:#166534;margin-top:4px">Attendance above 75% in all subjects.</div></div></div>`
            :subjects.filter(s=>s.pct<75).map(s=>`
              <div style="display:flex;gap:12px;align-items:flex-start;padding:12px;background:var(--danger-light);border-radius:10px;margin-bottom:10px">
                <span style="font-size:20px">⚠️</span>
                <div><div style="font-size:14px;font-weight:600;color:var(--danger)">${s.name} — ${s.pct}%</div>
                  <div style="font-size:12px;color:#991b1b;margin-top:3px">Need ${Math.ceil((0.75*s.total-s.present)/0.25)} more classes to recover.</div></div></div>`).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

// ══════════════════════════════════════════════
//  STUDENT — ATTENDANCE
// ══════════════════════════════════════════════
async function buildStudentAttendance(el){
  el.innerHTML='<div class="loading-state">Loading attendance…</div>';
  const stu=session.currentStudent;
  const data=await api('GET',`/api/stats/student/${stu.dbId}`);
  const {summary,subjects,calendar}=data;
  const now=new Date(),yr=now.getFullYear(),mo=now.getMonth();
  const firstDay=new Date(yr,mo,1).getDay(),daysInMo=new Date(yr,mo+1,0).getDate();
  const todayStr=now.toISOString().split('T')[0];
  const monthName=now.toLocaleDateString('en-IN',{month:'long',year:'numeric'});
  const dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let calHTML=dayNames.map(d=>`<div class="cal-day-name">${d}</div>`).join('');
  for(let i=0;i<firstDay;i++) calHTML+='<div class="cal-day empty"></div>';
  for(let d=1;d<=daysInMo;d++){
    const ds=`${yr}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dow=new Date(ds+'T00:00:00').getDay();
    const isToday=ds===todayStr;
    let cls=dow===0||dow===6?'weekend':ds>todayStr?'future':(calendar[ds]||'absent');
    calHTML+=`<div class="cal-day ${cls}${isToday?' today':''}" title="${ds}">${d}</div>`;
  }
  const recentDates=Object.keys(calendar).sort((a,b)=>b.localeCompare(a)).slice(0,15);
  el.innerHTML=`
  <div class="stats-grid">
    <div class="stat-card teal"><div class="stat-icon">✅</div><div class="stat-label">Present</div><div class="stat-value" style="color:var(--teal)">${summary.present}</div><div class="stat-change up">Classes attended</div></div>
    <div class="stat-card rose"><div class="stat-icon">❌</div><div class="stat-label">Absent</div><div class="stat-value" style="color:var(--danger)">${summary.absent}</div></div>
    <div class="stat-card amber"><div class="stat-icon">📝</div><div class="stat-label">On Leave</div><div class="stat-value" style="color:var(--warn)">${summary.onLeave}</div></div>
    <div class="stat-card gold"><div class="stat-icon">📊</div><div class="stat-label">Overall %</div><div class="stat-value" style="color:var(--gold)">${summary.percentage}%</div>
      <div class="stat-change ${summary.percentage>=75?'up':'down'}">${summary.percentage>=75?'✓ On track':'⚠ At risk'}</div></div>
  </div>
  <div class="card mb-20">
    <div class="card-header"><div class="card-title">${monthName} — Attendance Calendar</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <span class="badge badge-green">● Present</span><span class="badge badge-red">● Absent</span>
        <span class="badge badge-amber">● Leave</span><span class="badge" style="background:var(--cream);color:var(--muted)">● Weekend</span>
      </div>
    </div>
    <div class="card-body"><div class="attendance-grid">${calHTML}</div></div>
  </div>
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><div class="card-title">Subject-wise Breakdown</div></div>
      <div class="card-body">
        ${subjects.map(sub=>`
          <div class="subject-row">
            <div class="subject-color" style="background:${sub.color}"></div>
            <div style="flex:1">
              <div class="subject-name">${sub.name} <span style="font-size:11px;color:var(--muted)">(${sub.code})</span></div>
              <div class="subject-meta">${sub.classes} attended${sub.onLeave>0?` · ${sub.onLeave} on leave`:''}</div>
              <div class="progress-bar" style="margin-top:6px"><div class="progress-fill" style="width:${sub.pct}%;background:${sub.color}"></div></div>
            </div>
            <div class="subject-pct" style="color:${sub.pct<75?'var(--danger)':sub.color}">${sub.pct}%</div>
          </div>`).join('')}
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Recent Attendance Log</div></div>
      <table class="data-table">
        <thead><tr><th>Date</th><th>Status</th></tr></thead>
        <tbody>
          ${recentDates.length===0?'<tr><td colspan="2" style="text-align:center;color:var(--muted)">No data yet</td></tr>'
          :recentDates.map(ds=>`
            <tr><td class="font-mono" style="font-size:13px">${fmtDate(ds)}</td>
              <td><span class="badge ${calendar[ds]==='present'?'badge-green':calendar[ds]==='leave'?'badge-amber':'badge-red'}">${calendar[ds]}</span></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ══════════════════════════════════════════════
//  STUDENT — LEAVE FORM
// ══════════════════════════════════════════════
async function buildStudentLeave(el){
  el.innerHTML='<div class="loading-state">Loading…</div>';
  const stu=session.currentStudent;
  const leaves=await api('GET',`/api/leaves?studentDbId=${stu.dbId}`);
  const used={Medical:0,Family:0,Academic:0,Personal:0,Sports:0};
  leaves.filter(l=>l.status!=='rejected').forEach(l=>{if(used[l.type]!==undefined) used[l.type]+=l.days;});
  el.innerHTML=`
  <div class="grid-2" style="align-items:start">
    <div class="card">
      <div class="card-header"><div class="card-title">Apply for Leave</div></div>
      <div class="card-body">
        <div class="leave-form">
          <div class="form-group"><label class="form-label">Leave Type</label>
            <select class="select-input" id="leave-type">
              <option value="Medical">Medical / Health</option><option value="Family">Family Emergency</option>
              <option value="Academic">Academic Event</option><option value="Personal">Personal</option>
              <option value="Sports">Sports / Cultural</option>
            </select></div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">From Date</label>
              <input class="form-input" type="date" id="leave-from" min="${new Date().toISOString().split('T')[0]}"></div>
            <div class="form-group"><label class="form-label">To Date</label>
              <input class="form-input" type="date" id="leave-to" min="${new Date().toISOString().split('T')[0]}"></div>
          </div>
          <div class="form-group" id="days-preview" style="display:none">
            <div style="background:var(--teal-light);border-radius:8px;padding:10px 14px;font-size:13px;color:var(--teal);font-weight:500">
              📅 Duration: <span id="days-count">0</span> working day(s)</div></div>
          <div class="form-group"><label class="form-label">Reason for Leave</label>
            <textarea class="textarea-input" id="leave-reason" placeholder="Please provide a detailed reason…"></textarea></div>
          <div id="leave-form-error" style="display:none;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:10px 14px;border-radius:8px;font-size:13px;"></div>
          <div style="display:flex;gap:12px">
            <button class="btn-submit" id="leave-submit-btn" onclick="submitLeave()">Submit Application</button>
            <button class="btn-secondary" onclick="clearLeaveForm()">Clear</button>
          </div>
        </div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:20px">
      <div class="card">
        <div class="card-header"><div class="card-title">Leave Balance</div></div>
        <div class="card-body" style="padding:0">
          ${[{type:'Medical',total:10,color:'#1a7a6e'},{type:'Family',total:5,color:'#9333ea'},
             {type:'Academic',total:5,color:'#d97706'},{type:'Personal',total:3,color:'#c94040'},
             {type:'Sports',total:3,color:'#1e40af'}].map(lt=>{
            const u=used[lt.type]||0,rem=Math.max(0,lt.total-u),pct=Math.min(100,Math.round(u/lt.total*100));
            return `<div style="padding:14px 20px;border-bottom:1px solid var(--border)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <div style="display:flex;align-items:center;gap:8px">
                  <div style="width:8px;height:8px;border-radius:50%;background:${lt.color}"></div>
                  <span style="font-size:14px;font-weight:500">${lt.type}</span>
                </div>
                <span class="font-mono" style="font-size:13px;color:var(--muted)">${rem}/${lt.total} remaining</span>
              </div>
              <div class="progress-bar" style="margin-top:0"><div class="progress-fill" style="width:${pct}%;background:${lt.color}"></div></div>
            </div>`;}).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Policy Reminder</div></div>
        <div class="card-body">
          ${[['📋','Apply at least 2 days in advance for planned leaves'],
             ['🏥','Medical leaves need a doctor\'s certificate for 3+ days'],
             ['⚠️','Attendance below 75% may affect exam eligibility'],
             ['✅','Approved leave is auto-marked in attendance records'],
             ['⏰','Applications reviewed within 1–2 working days']].map(([ic,txt])=>
            `<div style="display:flex;gap:12px;font-size:13px;color:var(--slate);align-items:flex-start;margin-bottom:10px">
               <span style="flex-shrink:0">${ic}</span><span>${txt}</span></div>`).join('')}
        </div>
      </div>
    </div>
  </div>`;
  ['leave-from','leave-to'].forEach(id=>{
    document.getElementById(id).addEventListener('change',()=>{
      const from=document.getElementById('leave-from').value;
      const to=document.getElementById('leave-to').value;
      const prev=document.getElementById('days-preview');
      if(from&&to&&to>=from){
        let d=new Date(from+'T00:00:00'),end=new Date(to+'T00:00:00'),cnt=0;
        while(d<=end){if(d.getDay()!==0&&d.getDay()!==6)cnt++;d.setDate(d.getDate()+1);}
        document.getElementById('days-count').textContent=cnt; prev.style.display='block';
      } else prev.style.display='none';
    });
  });
}

function clearLeaveForm(){
  ['leave-from','leave-to','leave-reason'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('days-preview').style.display='none';
  document.getElementById('leave-form-error').style.display='none';
}

async function submitLeave(){
  const type=document.getElementById('leave-type').value;
  const from=document.getElementById('leave-from').value;
  const to=document.getElementById('leave-to').value;
  const reason=document.getElementById('leave-reason').value.trim();
  const errEl=document.getElementById('leave-form-error');
  errEl.style.display='none';
  if(!from||!to){errEl.textContent='⚠️ Please select from and to dates.';errEl.style.display='block';return;}
  if(to<from){errEl.textContent='⚠️ To date must be after from date.';errEl.style.display='block';return;}
  if(!reason){errEl.textContent='⚠️ Please provide a reason.';errEl.style.display='block';return;}
  const btn=document.getElementById('leave-submit-btn');
  btn.textContent='Submitting…'; btn.disabled=true;
  try{
    await api('POST','/api/leaves',{studentDbId:session.currentStudent.dbId,type,fromDate:from,toDate:to,reason});
    showToast('✅ Leave application submitted!','success');
    invalidatePage('student-dashboard','student-history');
    showPage('student-history');
  } finally{btn.textContent='Submit Application';btn.disabled=false;}
}

// ══════════════════════════════════════════════
//  STUDENT — HISTORY
// ══════════════════════════════════════════════
async function buildStudentHistory(el){
  el.innerHTML='<div class="loading-state">Loading history…</div>';
  const stu=session.currentStudent;
  const leaves=await api('GET',`/api/leaves?studentDbId=${stu.dbId}`);
  const approved=leaves.filter(l=>l.status==='approved').length;
  const pending=leaves.filter(l=>l.status==='pending').length;
  const rejected=leaves.filter(l=>l.status==='rejected').length;
  el.innerHTML=`
  <div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
    <div class="stat-card teal"><div class="stat-icon">✓</div><div class="stat-label">Approved</div><div class="stat-value" style="color:#22c55e">${approved}</div><div class="stat-change up">Leaves granted</div></div>
    <div class="stat-card amber"><div class="stat-icon">⏳</div><div class="stat-label">Pending</div><div class="stat-value" style="color:var(--warn)">${pending}</div><div class="stat-change">Awaiting review</div></div>
    <div class="stat-card rose"><div class="stat-icon">✕</div><div class="stat-label">Rejected</div><div class="stat-value" style="color:var(--danger)">${rejected}</div></div>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title">All Leave Applications</div>
      <button class="btn-submit" style="padding:8px 16px;font-size:12px" onclick="showPage('student-leave')">+ New Application</button></div>
    ${leaves.length===0
      ?`<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">No leave requests yet</div><div class="empty-state-sub">Apply for your first leave</div></div>`
      :`<table class="data-table">
          <thead><tr><th>ID</th><th>Type</th><th>Duration</th><th>Days</th><th>Reason</th><th>Applied</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            ${leaves.map(l=>`
              <tr id="hist-row-${l.id}">
                <td class="font-mono" style="font-size:12px;color:var(--muted)">${l.code}</td>
                <td><span class="badge badge-blue">${l.type}</span></td>
                <td style="font-size:13px">${fmtDate(l.fromDate)} → ${fmtDate(l.toDate)}</td>
                <td class="font-mono" style="text-align:center">${l.days}</td>
                <td style="font-size:13px;color:var(--slate);max-width:200px">${l.reason}</td>
                <td style="font-size:12px;color:var(--muted)">${fmtDate(l.appliedOn)}</td>
                <td><span class="badge ${badgeCls(l.status)}">${badgeIcon(l.status)} ${l.status}</span></td>
                <td>${l.status==='pending'
                  ?`<button class="btn-danger" style="padding:4px 10px;font-size:11px" onclick="cancelLeave(${l.id})">✕ Cancel</button>`
                  :'<span style="color:var(--muted);font-size:12px">—</span>'}</td>
              </tr>`).join('')}
          </tbody>
        </table>`}
  </div>`;
}

async function cancelLeave(id){
  if(!confirm('Cancel this leave application?')) return;
  await api('PUT',`/api/leaves/${id}/cancel`);
  document.getElementById(`hist-row-${id}`)?.remove();
  invalidatePage('student-dashboard'); showToast('Leave application cancelled','info');
}

// ══════════════════════════════════════════════
//  STUDENT — PROFILE
// ══════════════════════════════════════════════
async function buildStudentProfile(el){
  el.innerHTML='<div class="loading-state">Loading profile…</div>';
  const stu=session.currentStudent;
  el.innerHTML=`
  <div class="grid-2" style="align-items:start">
    <div class="card">
      <div class="card-header"><div class="card-title">My Profile</div></div>
      <div class="card-body">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid var(--border)">
          <div style="width:64px;height:64px;border-radius:16px;background:${stu.avatar};color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;flex-shrink:0">${ini(stu.name)}</div>
          <div>
            <div style="font-family:'DM Serif Display',serif;font-size:22px">${stu.name}</div>
            <div class="font-mono" style="font-size:12px;color:var(--muted);margin-top:4px">${stu.studentId}</div>
            <div style="font-size:13px;color:var(--muted);margin-top:2px">${stu.section} · Semester ${stu.semester}</div>
          </div>
        </div>
        <div style="display:grid;gap:16px">
          ${[['📧 Email',stu.email||'—'],['📞 Phone',stu.phone||'—'],
             ['🏫 Section',stu.section],['📚 Semester',`Semester ${stu.semester}`]].map(([l,v])=>
            `<div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--border)">
               <span style="font-size:13px;color:var(--muted)">${l}</span>
               <span style="font-size:14px;font-weight:500">${v}</span>
             </div>`).join('')}
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Change Password</div></div>
      <div class="card-body">
        <div style="display:grid;gap:16px">
          <div class="form-group"><label class="form-label">Current Password</label>
            <input class="form-input" type="password" id="pwd-old" placeholder="••••••••"></div>
          <div class="form-group"><label class="form-label">New Password</label>
            <input class="form-input" type="password" id="pwd-new" placeholder="••••••••"></div>
          <div class="form-group"><label class="form-label">Confirm New Password</label>
            <input class="form-input" type="password" id="pwd-confirm" placeholder="••••••••"></div>
          <div id="pwd-error" style="display:none;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:10px 14px;border-radius:8px;font-size:13px;"></div>
          <button class="btn-submit" id="pwd-btn" onclick="changePassword()">Update Password</button>
        </div>
      </div>
    </div>
  </div>`;
}

async function changePassword(){
  const old=document.getElementById('pwd-old').value;
  const nw=document.getElementById('pwd-new').value;
  const cf=document.getElementById('pwd-confirm').value;
  const errEl=document.getElementById('pwd-error');
  errEl.style.display='none';
  if(!old||!nw||!cf){errEl.textContent='⚠️ All fields are required.';errEl.style.display='block';return;}
  if(nw!==cf){errEl.textContent='⚠️ New passwords do not match.';errEl.style.display='block';return;}
  if(nw.length<6){errEl.textContent='⚠️ Password must be at least 6 characters.';errEl.style.display='block';return;}
  const btn=document.getElementById('pwd-btn');
  btn.textContent='Updating…'; btn.disabled=true;
  try{
    await api('PUT','/api/profile/password',{oldPassword:old,newPassword:nw});
    showToast('✅ Password updated successfully','success');
    ['pwd-old','pwd-new','pwd-confirm'].forEach(id=>document.getElementById(id).value='');
  } catch(e){
    errEl.textContent='❌ '+e.message; errEl.style.display='block';
  } finally{btn.textContent='Update Password';btn.disabled=false;}
}

// ══════════════════════════════════════════════
//  ADMIN — DASHBOARD
// ══════════════════════════════════════════════
async function buildAdminDashboard(el){
  el.innerHTML='<div class="loading-state">Loading dashboard…</div>';
  const rep=await api('GET','/api/stats/admin');
  el.innerHTML=`
  <div class="stats-grid">
    <div class="stat-card teal"><div class="stat-icon">👥</div><div class="stat-label">Total Students</div><div class="stat-value" style="color:var(--teal)">${rep.totalStudents}</div><div class="stat-change up">Active in system</div></div>
    <div class="stat-card gold"><div class="stat-icon">📊</div><div class="stat-label">Monthly Attendance</div><div class="stat-value" style="color:var(--gold)">${rep.monthlyAttendance}%</div><div class="stat-change">This month average</div></div>
    <div class="stat-card amber"><div class="stat-icon">📝</div><div class="stat-label">Pending Leaves</div><div class="stat-value" style="color:var(--warn)">${rep.pendingLeaves}</div><div class="stat-change">Awaiting your review</div></div>
    <div class="stat-card rose"><div class="stat-icon">⚠️</div><div class="stat-label">At Risk (< 75%)</div><div class="stat-value" style="color:var(--danger)">${rep.atRiskStudents}</div><div class="stat-change down">Students need attention</div></div>
  </div>
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><div class="card-title">Pending Leave Requests</div>
        <button class="btn-submit" style="padding:8px 16px;font-size:12px" onclick="showPage('admin-leaves')">View All</button></div>
      <div id="dash-pending-list">
        ${rep.pendingLeavesList.length===0
          ?`<div class="empty-state"><div class="empty-state-icon">🎉</div><div class="empty-state-text">No pending leaves</div></div>`
          :rep.pendingLeavesList.map(l=>`
            <div id="dash-leave-${l.id}" style="padding:16px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:16px">
              <div style="width:36px;height:36px;border-radius:8px;background:${l.studentAvatar};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">${ini(l.studentName)}</div>
              <div style="flex:1">
                <div style="font-size:14px;font-weight:500">${l.studentName}</div>
                <div style="font-size:12px;color:var(--muted);margin-top:1px">${l.type} · ${fmtDate(l.fromDate)} → ${fmtDate(l.toDate)} (${l.days}d)</div>
              </div>
              <div style="display:flex;gap:6px">
                <button class="btn-approve" onclick="dashLeaveAction(${l.id},'approved')">✓</button>
                <button class="btn-reject"  onclick="dashLeaveAction(${l.id},'rejected')">✕</button>
              </div>
            </div>`).join('')}
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Student Attendance Overview</div></div>
      <div class="card-body">
        ${rep.allStudents.map(s=>`
          <div style="margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <div style="display:flex;align-items:center;gap:8px">
                <div style="width:28px;height:28px;border-radius:6px;background:${s.avatar};color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700">${ini(s.name)}</div>
                <div>
                  <div style="font-size:13px;font-weight:500">${s.name}</div>
                  <div style="font-size:10px;color:var(--muted);font-family:'JetBrains Mono',monospace">${s.studentId||''} &nbsp;${s.section}</div>
                </div>
              </div>
              <span class="font-mono" style="font-size:13px;font-weight:600;color:${s.percentage<75?'var(--danger)':'#22c55e'}">${s.percentage}%</span>
            </div>
            <div class="progress-bar" style="margin-top:0">
              <div class="progress-fill" style="width:${s.percentage}%;background:${s.percentage<75?'var(--danger)':'#22c55e'}"></div>
            </div>
          </div>`).join('')}
      </div>
    </div>
  </div>`;
}

async function dashLeaveAction(leaveId,status){
  await api('PUT',`/api/leaves/${leaveId}`,{status});
  document.getElementById('dash-leave-'+leaveId)?.remove();
  showToast(status==='approved'?'✅ Leave approved':'❌ Leave rejected',status==='approved'?'success':'error');
  invalidatePage('admin-leaves','admin-dashboard','admin-reports','admin-attendance','student-dashboard','student-attendance','student-history');
  buildAdminDashboard(document.getElementById('page-admin-dashboard'));
  loadNotifications();
}

// ══════════════════════════════════════════════
//  ADMIN — MANAGE ATTENDANCE
// ══════════════════════════════════════════════
let attState={records:[],students:[],subjects:[],page:1,perPage:20};

async function buildAdminAttendance(el){
  el.innerHTML='<div class="loading-state">Loading attendance records…</div>';
  const [students,subjects]=await Promise.all([api('GET','/api/students'),api('GET','/api/subjects')]);
  attState.students=students; attState.subjects=subjects;
  const sections=[...new Set(students.map(s=>s.section))];
  const semesters=[...new Set(students.map(s=>s.semester))].sort((a,b)=>a-b);
  el.innerHTML=`
  <div class="card mb-20">
    <div class="card-body" style="padding:16px 24px">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <input class="form-input" style="max-width:220px;margin:0" placeholder="🔍 Search student name…" id="att-filter-name" oninput="filterAttClientSide()">
        <select class="select-input" style="max-width:200px" id="att-filter-student" onchange="loadAttendanceTable()">
          <option value="">All Students</option>
          ${students.map(s=>`<option value="${s.dbId}">${s.name}</option>`).join('')}
        </select>
        <select class="select-input" style="max-width:200px" id="att-filter-subject" onchange="loadAttendanceTable()">
          <option value="">Select Course / Subject</option>
          ${subjects.map(s=>`<option value="${s.id}">${s.name} (${s.section})</option>`).join('')}
        </select>
        <select class="select-input" style="max-width:150px" id="att-filter-semester" onchange="loadAttendanceTable()">
          <option value="">All Semesters</option>
          ${semesters.map(i=>`<option value="${i}">Semester ${i}</option>`).join('')}
        </select>
        <select class="select-input" style="max-width:160px" id="att-filter-section" onchange="loadAttendanceTable()">
          <option value="">All Sections</option>
          ${sections.map(s=>`<option value="${s}">${s}</option>`).join('')}
        </select>
        <input class="form-input" type="date" style="max-width:160px;margin:0" id="att-filter-from" onchange="loadAttendanceTable()">
        <input class="form-input" type="date" style="max-width:160px;margin:0" id="att-filter-to"   onchange="loadAttendanceTable()">
        <select class="select-input" style="max-width:140px" id="att-filter-status" onchange="loadAttendanceTable()">
          <option value="">All Status</option>
          <option value="present">Present</option><option value="absent">Absent</option><option value="leave">Leave</option>
        </select>
        <button class="btn-secondary" style="padding:10px 16px;font-size:13px" onclick="clearAttFilters()">Clear</button>
        <button class="btn-secondary" style="padding:10px 16px;font-size:13px" onclick="openBulkAttModal()">⚡ Bulk Entry</button>
        <button class="btn-submit"    style="padding:10px 20px;font-size:13px;margin-left:auto" onclick="openAddAttModal()">+ Add Record</button>
      </div>
    </div>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title">Attendance Records</div><div id="att-count" class="text-muted"></div></div>
    <div id="att-table-wrap"><div class="loading-state">Loading records…</div></div>
    <div id="att-pagination" style="padding:16px 24px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end"></div>
  </div>`;
  loadAttendanceTable();
}

async function loadAttendanceTable(){
  const wrap=document.getElementById('att-table-wrap');
  if(!wrap) return;
  wrap.innerHTML='<div class="loading-state">Loading…</div>';
  let url='/api/attendance?';
  const sid=document.getElementById('att-filter-student')?.value;
  const sub=document.getElementById('att-filter-subject')?.value;
  const sec=document.getElementById('att-filter-section')?.value;
  const sem=document.getElementById('att-filter-semester')?.value;
  const df =document.getElementById('att-filter-from')?.value;
  const dt =document.getElementById('att-filter-to')?.value;
  const st =document.getElementById('att-filter-status')?.value;
  if(sid) url+=`studentDbId=${sid}&`;
  if(sub) url+=`subjectId=${sub}&`;
  if(sec) url+=`section=${encodeURIComponent(sec)}&`;
  if(sem) url+=`semester=${sem}&`;
  if(df)  url+=`dateFrom=${df}&`;
  if(dt)  url+=`dateTo=${dt}&`;
  if(st)  url+=`status=${st}&`;
  let records=await api('GET',url);
  // Client-side name filter
  const nameQ=(document.getElementById('att-filter-name')?.value||'').toLowerCase().trim();
  if(nameQ) records=records.filter(r=>(r.studentName||'').toLowerCase().includes(nameQ));
  attState.records=records; attState._allRecords=records; attState.page=1;
  renderAttTable();
}

function renderAttTable(){
  const wrap=document.getElementById('att-table-wrap');
  const pag=document.getElementById('att-pagination');
  const cnt=document.getElementById('att-count');
  if(!wrap) return;
  const {records,page,perPage}=attState;
  const total=records.length,totalPages=Math.ceil(total/perPage);
  const slice=records.slice((page-1)*perPage,page*perPage);
  if(cnt) cnt.textContent=`${total} record${total!==1?'s':''}`;
  if(total===0){
    wrap.innerHTML=`<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">No attendance records found</div><div class="empty-state-sub">Try adjusting your filters or add a new record</div></div>`;
    if(pag) pag.innerHTML=''; return;
  }
  // Group records by student (preserve first-appearance order)
  const grouped={};
  const studentOrder=[];
  slice.forEach(r=>{
    const key=String(r.studentDbId||r.studentName||'');
    if(!grouped[key]){grouped[key]={meta:r,records:[]};studentOrder.push(key);}
    grouped[key].records.push(r);
  });
  let rows='';
  studentOrder.forEach(key=>{
    const {meta:m,records:recs}=grouped[key];
    const stuId=m.studentIdStr||m.studentId||m.studentDbId||'—';
    const grpId='grp_'+String(key).replace(/[^a-z0-9]/gi,'_');
    rows+=`
    <tr class="student-group-header" style="background:var(--cream);cursor:pointer" onclick="toggleAttGroup('${grpId}')">
      <td colspan="4" style="padding:10px 20px;border-bottom:2px solid var(--border)">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;border-radius:9px;background:${m.studentAvatar||'#888'};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">${ini(m.studentName||'?')}</div>
          <div>
            <div style="font-size:14px;font-weight:600">${m.studentName||'Unknown'}</div>
            <div style="font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-top:2px">${stuId} &nbsp;·&nbsp; ${m.section||'—'}</div>
          </div>
          <span class="badge badge-blue" style="margin-left:auto">${recs.length} record${recs.length!==1?'s':''}</span>
          <span id="arrow-${grpId}" style="font-size:13px;color:var(--muted);margin-left:4px;transition:transform .2s;display:inline-block">▼</span>
        </div>
      </td>
    </tr>`;
    recs.forEach(r=>{
      rows+=`
      <tr id="att-row-${r.id}" class="att-group-row ${grpId}" style="border-left:3px solid ${r.subjectColor||'#ccc'}">
        <td class="font-mono" style="font-size:13px;padding-left:28px">${fmtDate(r.date)}<br><span style="font-size:10px;color:var(--muted)">${r.date}</span></td>
        <td><div style="display:flex;align-items:center;gap:8px">
          <div style="width:12px;height:12px;border-radius:3px;background:${r.subjectColor||'#ccc'};flex-shrink:0"></div>
          <div>
            <div style="font-size:13px;font-weight:500">${r.subjectName}</div>
            <div style="font-size:11px;color:var(--muted)">${r.subjectCode}</div>
          </div>
        </div></td>
        <td><select class="status-select ${r.status}" id="status-sel-${r.id}" onchange="updateAttStatus(${r.id},this)">
          <option value="present" ${r.status==='present'?'selected':''}>✓ Present</option>
          <option value="absent"  ${r.status==='absent' ?'selected':''}>✕ Absent</option>
          <option value="leave"   ${r.status==='leave'  ?'selected':''}>📝 Leave</option>
        </select></td>
        <td><button class="btn-danger" style="padding:5px 12px;font-size:12px" onclick="deleteAttRecord(${r.id})">🗑 Delete</button></td>
      </tr>`;
    });
  });
  wrap.innerHTML=`
  <table class="data-table">
    <thead><tr><th style="padding-left:28px">Date</th><th>Subject</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
  if(pag){
    let ph='';
    if(totalPages>1){
      ph+=`<span style="font-size:13px;color:var(--muted);margin-right:8px">Page ${page} of ${totalPages}</span>`;
      if(page>1) ph+=`<button class="btn-secondary" style="padding:6px 12px;font-size:12px" onclick="attPage(${page-1})">← Prev</button>`;
      if(page<totalPages) ph+=`<button class="btn-secondary" style="padding:6px 12px;font-size:12px" onclick="attPage(${page+1})">Next →</button>`;
    }
    pag.innerHTML=ph;
  }
}

function attPage(p){attState.page=p;renderAttTable();}

function toggleAttGroup(grpId){
  const rows=document.querySelectorAll('.att-group-row.'+grpId);
  const arrow=document.getElementById('arrow-'+grpId);
  if(!rows.length) return;
  const hidden=rows[0].style.display==='none';
  rows.forEach(r=>r.style.display=hidden?'':'none');
  if(arrow) arrow.style.transform=hidden?'':'rotate(-90deg)';
}

async function updateAttStatus(id,sel){
  const status=sel.value; sel.className=`status-select ${status}`;
  await api('PUT',`/api/attendance/${id}`,{status});
  const r=attState.records.find(r=>r.id===id); if(r) r.status=status;
  invalidatePage('admin-dashboard','admin-reports','student-dashboard','student-attendance');
  showToast('✅ Status updated','success');
}

async function deleteAttRecord(id){
  if(!confirm('Delete this attendance record?')) return;
  await api('DELETE',`/api/attendance/${id}`);
  attState.records=attState.records.filter(r=>r.id!==id);
  renderAttTable();
  invalidatePage('admin-dashboard','admin-reports','student-dashboard','student-attendance');
  showToast('🗑 Record deleted','info');
}

function filterAttClientSide(){
  const nameQ=(document.getElementById('att-filter-name')?.value||'').toLowerCase().trim();
  if(!nameQ){
    attState.records=attState._allRecords||attState.records;
    renderAttTable(); return;
  }
  attState._allRecords=attState._allRecords||attState.records;
  attState.records=(attState._allRecords||[]).filter(r=>(r.studentName||'').toLowerCase().includes(nameQ));
  attState.page=1; renderAttTable();
}

function clearAttFilters(){
  attState._allRecords=null;
  ['att-filter-student','att-filter-subject','att-filter-section','att-filter-status','att-filter-semester'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  ['att-filter-from','att-filter-to','att-filter-name'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  loadAttendanceTable();
}

function openAddAttModal(){
  const {students,subjects}=attState;
  const today=new Date().toISOString().split('T')[0];
  const ov=document.createElement('div'); ov.className='modal-overlay'; ov.id='att-modal';
  ov.innerHTML=`
  <div class="modal-box" style="max-width:480px">
    <div class="modal-title">Add Attendance Record</div>
    <div style="display:grid;gap:16px">
      <div class="form-group"><label class="form-label">Student *</label>
        <select class="select-input" id="am-student" onchange="filterSubjectByStudent()">
          <option value="">Select student…</option>
          ${students.map(s=>`<option value="${s.dbId}" data-section="${s.section}">${s.name} (${s.studentId})</option>`).join('')}
        </select></div>
      <div class="form-group"><label class="form-label">Subject *</label>
        <select class="select-input" id="am-subject">
          <option value="">Select student first…</option>
          ${subjects.map(s=>`<option value="${s.id}" data-section="${s.section}">${s.name} — ${s.section}</option>`).join('')}
        </select></div>
      <div class="form-group"><label class="form-label">Date *</label>
        <input class="form-input" type="date" id="am-date" value="${today}"></div>
      <div class="form-group"><label class="form-label">Status *</label>
        <select class="select-input" id="am-status">
          <option value="present">✓ Present</option><option value="absent">✕ Absent</option><option value="leave">📝 Leave</option>
        </select></div>
    </div>
    <div id="am-error" style="display:none;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:10px 14px;border-radius:8px;font-size:13px;margin-top:12px;"></div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-submit" id="am-btn" onclick="saveAttModal()">Add Record</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)closeModal();});
}

function filterSubjectByStudent(){
  const sel=document.getElementById('am-student');
  const subSel=document.getElementById('am-subject');
  if(!sel||!subSel) return;
  const opt=sel.options[sel.selectedIndex];
  const section=opt?opt.dataset.section:'';
  subSel.innerHTML='<option value="">Select subject…</option>';
  attState.subjects.forEach(s=>{
    if(!section||s.section===section){
      const o=document.createElement('option');
      o.value=s.id; o.textContent=`${s.name} (${s.code})`; subSel.appendChild(o);
    }
  });
}

async function saveAttModal(){
  const studentDbId=parseInt(document.getElementById('am-student').value);
  const subjectId=parseInt(document.getElementById('am-subject').value);
  const date=document.getElementById('am-date').value;
  const status=document.getElementById('am-status').value;
  const errEl=document.getElementById('am-error');
  errEl.style.display='none';
  if(!studentDbId){errEl.textContent='⚠️ Please select a student.';errEl.style.display='block';return;}
  if(!subjectId){errEl.textContent='⚠️ Please select a subject.';errEl.style.display='block';return;}
  if(!date){errEl.textContent='⚠️ Please select a date.';errEl.style.display='block';return;}
  const btn=document.getElementById('am-btn');
  btn.textContent='Saving…'; btn.disabled=true;
  try{
    await api('POST','/api/attendance',{studentDbId,subjectId,date,status});
    closeModal(); showToast('✅ Attendance record added','success');
    invalidatePage('admin-dashboard','admin-reports','student-dashboard','student-attendance');
    loadAttendanceTable();
  } finally{btn.textContent='Add Record';btn.disabled=false;}
}

function openBulkAttModal(){
  const {students,subjects}=attState;
  const today=new Date().toISOString().split('T')[0];
  const ov=document.createElement('div'); ov.className='modal-overlay'; ov.id='att-modal';
  ov.innerHTML=`
  <div class="modal-box" style="max-width:580px">
    <div class="modal-title">⚡ Bulk Attendance Entry</div>
    <p style="font-size:13px;color:var(--muted);margin-bottom:20px">Select a subject and date, then set status for each student in that section.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div class="form-group"><label class="form-label">Subject *</label>
        <select class="select-input" id="bm-subject" onchange="renderBulkRows()">
          <option value="">Select subject…</option>
          ${subjects.map(s=>`<option value="${s.id}" data-section="${s.section}">${s.name} — ${s.section}</option>`).join('')}
        </select></div>
      <div class="form-group"><label class="form-label">Date *</label>
        <input class="form-input" type="date" id="bm-date" value="${today}"></div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:14px">
      <button class="btn-secondary" style="padding:7px 14px;font-size:12px" onclick="bulkSetAll('present')">✓ All Present</button>
      <button class="btn-secondary" style="padding:7px 14px;font-size:12px" onclick="bulkSetAll('absent')">✕ All Absent</button>
      <button class="btn-secondary" style="padding:7px 14px;font-size:12px" onclick="bulkSetAll('leave')">📝 All Leave</button>
    </div>
    <div id="bm-rows" style="max-height:300px;overflow-y:auto;border:1.5px solid var(--border);border-radius:10px;padding:8px">
      <div style="text-align:center;padding:24px;color:var(--muted);font-size:14px">Select a subject to load students</div>
    </div>
    <div id="bm-error" style="display:none;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:10px 14px;border-radius:8px;font-size:13px;margin-top:12px;"></div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-submit" id="bm-btn" onclick="saveBulkAtt()">💾 Save All</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)closeModal();});
}

function renderBulkRows(){
  const sel=document.getElementById('bm-subject');
  const opt=sel.options[sel.selectedIndex];
  const section=opt?opt.dataset.section:'';
  const wrap=document.getElementById('bm-rows');
  if(!section){wrap.innerHTML='<div style="text-align:center;padding:24px;color:var(--muted);font-size:14px">Select a subject to load students</div>';return;}
  const stus=attState.students.filter(s=>s.section===section);
  if(stus.length===0){wrap.innerHTML='<div style="text-align:center;padding:24px;color:var(--muted)">No students in this section</div>';return;}
  wrap.innerHTML=stus.map(s=>`
    <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-bottom:1px solid var(--border)">
      <div style="width:32px;height:32px;border-radius:8px;background:${s.avatar};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${ini(s.name)}</div>
      <div style="flex:1"><div style="font-size:13px;font-weight:500">${s.name}</div>
        <div style="font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace">${s.studentId}</div></div>
      <select class="status-select present" id="bulk-status-${s.dbId}" onchange="this.className='status-select '+this.value">
        <option value="present" selected>✓ Present</option>
        <option value="absent">✕ Absent</option><option value="leave">📝 Leave</option>
      </select>
    </div>`).join('');
}

function bulkSetAll(status){
  document.querySelectorAll('[id^="bulk-status-"]').forEach(sel=>{sel.value=status;sel.className='status-select '+status;});
}

async function saveBulkAtt(){
  const subjectId=parseInt(document.getElementById('bm-subject').value);
  const date=document.getElementById('bm-date').value;
  const errEl=document.getElementById('bm-error');
  errEl.style.display='none';
  if(!subjectId){errEl.textContent='⚠️ Please select a subject.';errEl.style.display='block';return;}
  if(!date){errEl.textContent='⚠️ Please select a date.';errEl.style.display='block';return;}
  const rows=document.querySelectorAll('[id^="bulk-status-"]');
  if(rows.length===0){errEl.textContent='⚠️ No students loaded. Select a subject first.';errEl.style.display='block';return;}
  const items=Array.from(rows).map(sel=>({studentDbId:parseInt(sel.id.replace('bulk-status-','')),subjectId,date,status:sel.value}));
  const btn=document.getElementById('bm-btn');
  btn.textContent='Saving…'; btn.disabled=true;
  try{
    const result=await api('POST','/api/attendance/bulk',items);
    closeModal(); showToast(`✅ Bulk entry saved — ${result.saved} records`,'success');
    invalidatePage('admin-dashboard','admin-reports','student-dashboard','student-attendance');
    loadAttendanceTable();
  } finally{btn.textContent='💾 Save All';btn.disabled=false;}
}

// ══════════════════════════════════════════════
//  ADMIN — LEAVE REQUESTS
// ══════════════════════════════════════════════
async function buildAdminLeaves(el){
  el.innerHTML='<div class="loading-state">Loading leaves…</div>';
  const leaves=await api('GET','/api/leaves');
  const pending=leaves.filter(l=>l.status==='pending').length;
  const approved=leaves.filter(l=>l.status==='approved').length;
  const rejected=leaves.filter(l=>l.status==='rejected').length;
  el.innerHTML=`
  <div class="stats-grid">
    <div class="stat-card amber"><div class="stat-label">Pending</div><div class="stat-value" style="color:var(--warn)">${pending}</div></div>
    <div class="stat-card teal"><div class="stat-label">Approved</div><div class="stat-value" style="color:#22c55e">${approved}</div></div>
    <div class="stat-card rose"><div class="stat-label">Rejected</div><div class="stat-value" style="color:var(--danger)">${rejected}</div></div>
    <div class="stat-card gold"><div class="stat-label">Total</div><div class="stat-value" style="color:var(--gold)">${leaves.length}</div></div>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title">All Leave Applications</div>
      <select class="select-input" style="max-width:140px;padding:8px 12px" onchange="filterLeavesAdmin(this.value)">
        <option value="">All Status</option><option value="pending">Pending</option>
        <option value="approved">Approved</option><option value="rejected">Rejected</option>
      </select></div>
    <table class="data-table">
      <thead><tr><th>ID</th><th>Student</th><th>Type</th><th>Duration</th><th>Days</th><th>Reason</th><th>Applied</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody id="admin-leaves-tbody">${renderAdminLeaveRows(leaves)}</tbody>
    </table>
  </div>`;
}

function renderAdminLeaveRows(leaves){
  return leaves.map(l=>`
  <tr id="al-row-${l.id}" data-status="${l.status}">
    <td class="font-mono" style="font-size:12px;color:var(--muted)">${l.code}</td>
    <td><div style="display:flex;align-items:center;gap:8px">
      <div style="width:28px;height:28px;border-radius:6px;background:${l.studentAvatar};color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700">${ini(l.studentName||'?')}</div>
      <div><div style="font-weight:500;font-size:13px">${l.studentName}</div>
        <div style="font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace">${l.studentIdStr}</div></div>
    </div></td>
    <td><span class="badge badge-blue">${l.type}</span></td>
    <td style="font-size:13px">${fmtDate(l.fromDate)} → ${fmtDate(l.toDate)}</td>
    <td class="font-mono" style="text-align:center">${l.days}</td>
    <td style="font-size:13px;color:var(--slate);max-width:160px">${l.reason}</td>
    <td style="font-size:12px;color:var(--muted)">${fmtDate(l.appliedOn)}</td>
    <td id="al-status-${l.id}"><span class="badge ${badgeCls(l.status)}">${badgeIcon(l.status)} ${l.status}</span></td>
    <td id="al-actions-${l.id}">
      ${l.status==='pending'
        ?`<div style="display:flex;gap:6px">
            <button class="btn-approve" onclick="handleAdminLeave(${l.id},'approved')">✓ Approve</button>
            <button class="btn-reject"  onclick="handleAdminLeave(${l.id},'rejected')">✕ Reject</button>
          </div>`
        :'<span style="font-size:12px;color:var(--muted)">—</span>'}
    </td>
  </tr>`).join('');
}

function filterLeavesAdmin(status){
  document.querySelectorAll('#admin-leaves-tbody tr').forEach(row=>{
    row.style.display=(!status||row.dataset.status===status)?'':'none';
  });
}

async function handleAdminLeave(leaveId,status){
  await api('PUT',`/api/leaves/${leaveId}`,{status});
  document.getElementById(`al-status-${leaveId}`).innerHTML=`<span class="badge ${badgeCls(status)}">${badgeIcon(status)} ${status}</span>`;
  document.getElementById(`al-actions-${leaveId}`).innerHTML='<span style="font-size:12px;color:var(--muted)">—</span>';
  document.getElementById(`al-row-${leaveId}`)?.setAttribute('data-status',status);
  showToast(status==='approved'?'✅ Leave approved':'❌ Leave rejected',status==='approved'?'success':'error');
  invalidatePage('admin-dashboard','admin-reports','admin-attendance','student-dashboard','student-attendance','student-history');
  loadNotifications();
}

// ══════════════════════════════════════════════
//  ADMIN — STUDENTS
// ══════════════════════════════════════════════
async function buildAdminStudents(el){
  el.innerHTML='<div class="loading-state">Loading students…</div>';
  const students=await api('GET','/api/students');
  window._allStudents=students;
  window._studentView=window._studentView||'grid';
  const sections=[...new Set(students.map(s=>s.section))];
  const semesters=[...new Set(students.map(s=>s.semester))].sort((a,b)=>a-b);
  el.innerHTML=`
  <div class="card mb-20">
    <div class="card-body" style="padding:16px 24px">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <input class="form-input" style="max-width:260px;margin:0" placeholder="🔍 Search by name or ID…" id="stu-search" oninput="searchStudentsAdmin()">
        <select class="select-input" style="max-width:150px" id="stu-section-filter" onchange="searchStudentsAdmin()">
          <option value="">All Sections</option>
          ${sections.map(c=>`<option value="${c}">${c}</option>`).join('')}
        </select>
        <select class="select-input" style="max-width:150px" id="stu-semester-filter" onchange="searchStudentsAdmin()">
          <option value="">All Semesters</option>
          ${semesters.map(i=>`<option value="${i}">Semester ${i}</option>`).join('')}
        </select>
        <select class="select-input" style="max-width:150px" id="stu-status-filter" onchange="searchStudentsAdmin()">
          <option value="">All Status</option><option value="safe">Above 75%</option><option value="risk">Below 75%</option>
        </select>
        <div style="display:flex;gap:6px;margin-left:auto;align-items:center">
          <button id="view-grid-btn" onclick="setStudentView('grid')"
            style="padding:8px 14px;font-size:13px;border:1.5px solid var(--border);border-radius:8px;cursor:pointer;background:${window._studentView==='grid'?'var(--teal)':'transparent'};color:${window._studentView==='grid'?'#fff':'var(--ink)'};font-family:inherit;transition:all .15s">⊞ Grid</button>
          <button id="view-list-btn" onclick="setStudentView('list')"
            style="padding:8px 14px;font-size:13px;border:1.5px solid var(--border);border-radius:8px;cursor:pointer;background:${window._studentView==='list'?'var(--teal)':'transparent'};color:${window._studentView==='list'?'#fff':'var(--ink)'};font-family:inherit;transition:all .15s">≡ List</button>
          <button class="btn-submit" style="padding:8px 20px;margin-left:4px" onclick="openAddStudentModal()">+ Add Student</button>
        </div>
      </div>
    </div>
  </div>
  <div id="student-view-container"></div>`;
  renderStudentView(students);
}

function studentCardHTML(s){
  return `
  <div class="student-card" id="scard-${s.studentId}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
      <div class="student-avatar" style="background:${s.avatar}">${ini(s.name)}</div>
      <span class="badge ${s.percentage>=75?'badge-green':'badge-red'}">${s.percentage>=75?'On Track':'At Risk'}</span>
    </div>
    <div class="student-name">${s.name}</div>
    <div class="student-id" style="font-size:10px;opacity:.75">${s.studentId}</div>
    <div style="font-size:11px;color:var(--muted);margin-top:2px">${s.section} · Sem ${s.semester}</div>
    <div style="font-size:12px;color:var(--muted);margin-top:4px">${s.email||'—'}</div>
    <div style="margin:12px 0">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:4px">
        <span>Attendance</span><span>${s.present}/${s.total} classes</span>
      </div>
      <div class="progress-bar" style="margin-top:0">
        <div class="progress-fill" style="width:${s.percentage}%;background:${s.percentage>=75?'#22c55e':'var(--danger)'}"></div>
      </div>
      <div style="text-align:right;margin-top:4px;font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:600;color:${s.percentage>=75?'#22c55e':'var(--danger)'}">${s.percentage}%</div>
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn-secondary" style="flex:1;padding:8px;font-size:12px" onclick="openEditStudentModal('${s.studentId}')">✏️ Edit</button>
      <button class="btn-icon" onclick="deleteStudentAdmin('${s.studentId}','${s.name}')" title="Delete">🗑️</button>
    </div>
  </div>`;
}

function setStudentView(v){
  window._studentView=v;
  const gb=document.getElementById('view-grid-btn');
  const lb=document.getElementById('view-list-btn');
  if(gb){gb.style.background=v==='grid'?'var(--teal)':'transparent';gb.style.color=v==='grid'?'#fff':'var(--ink)';}
  if(lb){lb.style.background=v==='list'?'var(--teal)':'transparent';lb.style.color=v==='list'?'#fff':'var(--ink)';}
  searchStudentsAdmin();
}

function renderStudentView(students){
  const container=document.getElementById('student-view-container');
  if(!container) return;
  if(!students||students.length===0){
    container.innerHTML='<div style="text-align:center;padding:48px;color:var(--muted)">No students match your filters</div>';
    return;
  }
  if(window._studentView==='list'){
    container.innerHTML=`
    <div class="card">
      <table class="data-table">
        <thead><tr><th>Student</th><th>ID</th><th>Section</th><th>Semester</th><th>Email</th><th>Attendance</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${students.map(s=>studentListRowHTML(s)).join('')}</tbody>
      </table>
    </div>`;
  } else {
    container.innerHTML=`<div id="student-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px">${students.map(s=>studentCardHTML(s)).join('')}</div>`;
  }
}

function studentListRowHTML(s){
  return `
  <tr id="scard-${s.studentId}">
    <td><div style="display:flex;align-items:center;gap:10px">
      <div style="width:34px;height:34px;border-radius:9px;background:${s.avatar};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">${ini(s.name)}</div>
      <div>
        <div style="font-size:14px;font-weight:500">${s.name}</div>
        <div style="font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-top:1px">${s.studentId}</div>
      </div>
    </div></td>
    <td class="font-mono" style="font-size:12px">${s.studentId}</td>
    <td><span class="badge badge-blue">${s.section}</span></td>
    <td style="font-size:13px">Sem ${s.semester}</td>
    <td style="font-size:12px;color:var(--muted)">${s.email||'—'}</td>
    <td style="min-width:130px">
      <div style="display:flex;align-items:center;gap:8px">
        <div class="progress-bar" style="margin:0;flex:1"><div class="progress-fill" style="width:${s.percentage}%;background:${s.percentage>=75?'#22c55e':'var(--danger)'}"></div></div>
        <span class="font-mono" style="font-size:12px;font-weight:600;color:${s.percentage>=75?'#22c55e':'var(--danger)'};min-width:36px;text-align:right">${s.percentage}%</span>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">${s.present}/${s.total} classes</div>
    </td>
    <td><span class="badge ${s.percentage>=75?'badge-green':'badge-red'}">${s.percentage>=75?'On Track':'At Risk'}</span></td>
    <td><div style="display:flex;gap:6px">
      <button class="btn-secondary" style="padding:5px 10px;font-size:12px" onclick="openEditStudentModal('${s.studentId}')">✏️ Edit</button>
      <button class="btn-icon" onclick="deleteStudentAdmin('${s.studentId}','${s.name}')" title="Delete">🗑️</button>
    </div></td>
  </tr>`;
}

function searchStudentsAdmin(){
  const q=(document.getElementById('stu-search')?.value||'').toLowerCase();
  const sec=document.getElementById('stu-section-filter')?.value||'';
  const sem=document.getElementById('stu-semester-filter')?.value||'';
  const status=document.getElementById('stu-status-filter')?.value||'';
  const filtered=(window._allStudents||[]).filter(s=>{
    const mq=!q||s.name.toLowerCase().includes(q)||s.studentId.includes(q);
    const ms=!sec||s.section===sec;
    const mm=!sem||String(s.semester)===String(sem);
    const mt=!status||(status==='safe'?s.percentage>=75:s.percentage<75);
    return mq&&ms&&mm&&mt;
  });
  renderStudentView(filtered);
}

function openAddStudentModal(){
  const ov=document.createElement('div'); ov.className='modal-overlay'; ov.id='student-modal';
  ov.innerHTML=`
  <div class="modal-box">
    <div class="modal-title">Add New Student</div>
    <div class="modal-grid">
      <div class="form-group"><label class="form-label">Full Name *</label><input class="form-input" id="m-name" placeholder="Ajeet Singh"></div>
      <div class="form-group"><label class="form-label">Student ID *</label><input class="form-input" id="m-sid" placeholder="04614004425"></div>
      <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="m-email" type="email" placeholder="student@jims.edu"></div>
      <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="m-phone" placeholder="9876543210"></div>
      <div class="form-group"><label class="form-label">Section</label>
        <select class="select-input" id="m-section"><option>MCA Sec-A</option><option>MCA Sec-B</option><option>MCA Sec-C</option></select></div>
      <div class="form-group"><label class="form-label">Semester</label>
        <select class="select-input" id="m-sem">${[1,2,3,4,5,6].map(i=>`<option value="${i}">Semester ${i}</option>`).join('')}</select></div>
      <div class="form-group" style="grid-column:1/-1"><label class="form-label">Password</label><input class="form-input" id="m-pwd" type="password" placeholder="Default: password123"></div>
    </div>
    <div id="modal-error" style="display:none;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:10px 14px;border-radius:8px;font-size:13px;margin-top:12px;"></div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-submit" id="modal-btn" onclick="saveNewStudent()">Add Student</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)closeModal();});
}

async function saveNewStudent(){
  const name=document.getElementById('m-name').value.trim();
  const sid=document.getElementById('m-sid').value.trim();
  const errEl=document.getElementById('modal-error');
  errEl.style.display='none';
  if(!name||!sid){errEl.textContent='⚠️ Name and Student ID are required.';errEl.style.display='block';return;}
  const btn=document.getElementById('modal-btn');
  btn.textContent='Saving…'; btn.disabled=true;
  try{
    const stu=await api('POST','/api/students',{
      name,studentId:sid,email:document.getElementById('m-email').value,
      phone:document.getElementById('m-phone').value,section:document.getElementById('m-section').value,
      semester:document.getElementById('m-sem').value,password:document.getElementById('m-pwd').value||'password123'
    });
    closeModal(); showToast('✅ Student added successfully','success');
    window._allStudents=[stu,...(window._allStudents||[])];
    renderStudentView(window._allStudents);
    invalidatePage('admin-dashboard','admin-reports');
  } catch(e){errEl.textContent='❌ '+e.message;errEl.style.display='block';}
  finally{btn.textContent='Add Student';btn.disabled=false;}
}

function openEditStudentModal(studentId){
  const stu=(window._allStudents||[]).find(s=>s.studentId===studentId);
  if(!stu) return;
  const ov=document.createElement('div'); ov.className='modal-overlay'; ov.id='student-modal';
  ov.innerHTML=`
  <div class="modal-box">
    <div class="modal-title">Edit Student</div>
    <div class="modal-grid">
      <div class="form-group"><label class="form-label">Full Name</label><input class="form-input" id="em-name" value="${stu.name}"></div>
      <div class="form-group"><label class="form-label">Student ID</label><input class="form-input" value="${stu.studentId}" disabled style="opacity:.5"></div>
      <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="em-email" value="${stu.email||''}"></div>
      <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="em-phone" value="${stu.phone||''}"></div>
      <div class="form-group"><label class="form-label">Section</label>
        <select class="select-input" id="em-section">
          ${['MCA Sec-A','MCA Sec-B','MCA Sec-C'].map(s=>`<option ${s===stu.section?'selected':''}>${s}</option>`).join('')}
        </select></div>
      <div class="form-group"><label class="form-label">Semester</label>
        <select class="select-input" id="em-sem">
          ${[1,2,3,4,5,6].map(i=>`<option value="${i}" ${i===stu.semester?'selected':''}>Semester ${i}</option>`).join('')}
        </select></div>
      <div class="form-group" style="grid-column:1/-1"><label class="form-label">New Password <span style="color:var(--muted);font-weight:400">(leave blank to keep)</span></label>
        <input class="form-input" id="em-pwd" type="password" placeholder="••••••••"></div>
    </div>
    <div id="modal-error" style="display:none;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:10px 14px;border-radius:8px;font-size:13px;margin-top:12px;"></div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-submit" id="modal-btn" onclick="saveEditStudent('${studentId}')">Save Changes</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)closeModal();});
}

async function saveEditStudent(studentId){
  const errEl=document.getElementById('modal-error'); errEl.style.display='none';
  const name=document.getElementById('em-name').value.trim();
  if(!name){errEl.textContent='⚠️ Name is required.';errEl.style.display='block';return;}
  const btn=document.getElementById('modal-btn');
  btn.textContent='Saving…'; btn.disabled=true;
  try{
    const updated=await api('PUT',`/api/students/${studentId}`,{
      name,email:document.getElementById('em-email').value,phone:document.getElementById('em-phone').value,
      section:document.getElementById('em-section').value,semester:parseInt(document.getElementById('em-sem').value),
      password:document.getElementById('em-pwd').value
    });
    closeModal(); showToast('✅ Student updated','success');
    const idx=(window._allStudents||[]).findIndex(s=>s.studentId===studentId);
    if(idx>=0) window._allStudents[idx]=updated;
    renderStudentView(window._allStudents);
    invalidatePage('admin-dashboard','admin-reports','admin-attendance');
  } finally{btn.textContent='Save Changes';btn.disabled=false;}
}

async function deleteStudentAdmin(studentId,name){
  if(!confirm(`Delete student "${name}"?\n\nThis will permanently remove all their attendance and leave records.`)) return;
  await api('DELETE',`/api/students/${studentId}`);
  document.getElementById(`scard-${studentId}`)?.remove();
  window._allStudents=(window._allStudents||[]).filter(s=>s.studentId!==studentId);
  renderStudentView(window._allStudents);
  showToast('🗑 Student deleted','info');
  invalidatePage('admin-dashboard','admin-reports','admin-attendance');
}

// ══════════════════════════════════════════════
//  ADMIN — SUBJECTS
// ══════════════════════════════════════════════
async function buildAdminSubjects(el){
  el.innerHTML='<div class="loading-state">Loading subjects…</div>';
  const subjects=await api('GET','/api/subjects');
  window._allSubjects=subjects;
  const sections=[...new Set(subjects.map(s=>s.section))].sort();
  // Build semester options from students if available
  const stuList=window._allStudents||[];
  const sectionSemMap={};
  stuList.forEach(s=>{if(!sectionSemMap[s.section]) sectionSemMap[s.section]=new Set(); sectionSemMap[s.section].add(s.semester);});
  const allSems=[...new Set(stuList.map(s=>s.semester))].sort((a,b)=>a-b);
  el.innerHTML=`
  <div class="card mb-20">
    <div class="card-body" style="padding:16px 24px">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <input class="form-input" style="max-width:260px;margin:0" placeholder="🔍 Search by name or code…" id="sub-search" oninput="filterSubjectsAdmin()">
        <select class="select-input" style="max-width:160px" id="sub-section-filter" onchange="filterSubjectsAdmin()">
          <option value="">All Sections</option>
          ${sections.map(c=>`<option value="${c}">${c}</option>`).join('')}
        </select>
        <select class="select-input" style="max-width:160px" id="sub-semester-filter" onchange="filterSubjectsAdmin()">
          <option value="">All Semesters</option>
          ${allSems.length>0?allSems.map(i=>`<option value="${i}">Semester ${i}</option>`).join(''):[1,2,3,4,5,6].map(i=>`<option value="${i}">Semester ${i}</option>`).join('')}
        </select>
        <button class="btn-submit" style="padding:10px 20px;margin-left:auto" onclick="openAddSubjectModal()">+ Add Subject</button>
      </div>
    </div>
  </div>
  <div id="subjects-sections-container"></div>`;
  renderSubjectsSections(subjects);
}

function filterSubjectsAdmin(){
  const q=(document.getElementById('sub-search')?.value||'').toLowerCase();
  const sec=document.getElementById('sub-section-filter')?.value||'';
  const sem=document.getElementById('sub-semester-filter')?.value||'';
  // Build section→semester map from student data
  const stuList=window._allStudents||[];
  const sectionSemMap={};
  stuList.forEach(s=>{if(!sectionSemMap[s.section]) sectionSemMap[s.section]=new Set(); sectionSemMap[s.section].add(String(s.semester));});
  const filtered=(window._allSubjects||[]).filter(s=>{
    const mq=!q||s.name.toLowerCase().includes(q)||s.code.toLowerCase().includes(q);
    const ms=!sec||s.section===sec;
    const mm=!sem||(sectionSemMap[s.section]&&sectionSemMap[s.section].has(sem));
    return mq&&ms&&mm;
  });
  renderSubjectsSections(filtered);
}

function renderSubjectsSections(subjects){
  const container=document.getElementById('subjects-sections-container');
  if(!container) return;
  if(!subjects||subjects.length===0){
    container.innerHTML='<div class="card"><div class="empty-state" style="padding:48px"><div class="empty-state-icon">📚</div><div class="empty-state-text">No subjects found</div></div></div>';
    return;
  }
  const grouped={};
  const order=[];
  subjects.forEach(s=>{
    if(!grouped[s.section]){grouped[s.section]=[];order.push(s.section);}
    grouped[s.section].push(s);
  });
  container.innerHTML=order.map(sec=>`
  <div class="card mb-20">
    <div class="card-header">
      <div class="card-title">📚 ${sec}</div>
      <div class="text-muted">${grouped[sec].length} subject${grouped[sec].length!==1?'s':''}</div>
    </div>
    <table class="data-table">
      <thead><tr><th>Code</th><th>Subject Name</th><th>Color</th><th>Actions</th></tr></thead>
      <tbody>${grouped[sec].map(s=>renderSubjectRow(s)).join('')}</tbody>
    </table>
  </div>`).join('');
}

function renderSubjectRow(s){
  const cname=colorName(s.color);
  return `
  <tr id="sub-row-${s.id}">
    <td class="font-mono" style="font-weight:600">${s.code}</td>
    <td style="font-size:14px;font-weight:500">${s.name}</td>
    <td><div style="display:flex;align-items:center;gap:10px">
      <div style="width:22px;height:22px;border-radius:6px;background:${s.color};border:1px solid rgba(0,0,0,.1);flex-shrink:0"></div>
      <span style="font-size:13px;font-weight:500;color:var(--slate)">${cname}</span>
    </div></td>
    <td><div style="display:flex;gap:8px">
      <button class="btn-secondary" style="padding:6px 12px;font-size:12px" onclick="openEditSubjectModal(${s.id})">✏️ Edit</button>
      <button class="btn-danger"    style="padding:6px 12px;font-size:12px" onclick="deleteSubjectAdmin(${s.id},'${s.name.replace(/'/g,"\\'")}')">🗑</button>
    </div></td>
  </tr>`;
}

function openAddSubjectModal(){
  const ov=document.createElement('div'); ov.className='modal-overlay'; ov.id='student-modal';
  ov.innerHTML=`
  <div class="modal-box" style="max-width:480px">
    <div class="modal-title">Add New Subject</div>
    <div style="display:grid;gap:16px">
      <div class="form-group"><label class="form-label">Subject Code *</label><input class="form-input" id="sub-code" placeholder="e.g. AI101" style="text-transform:uppercase"></div>
      <div class="form-group"><label class="form-label">Subject Name *</label><input class="form-input" id="sub-name" placeholder="e.g. Artificial Intelligence"></div>
      <div class="form-group"><label class="form-label">Section *</label>
        <select class="select-input" id="sub-section">
          <option>MCA Sec-A</option><option>MCA Sec-B</option><option>MCA Sec-C</option>
        </select></div>
      <div class="form-group"><label class="form-label">Color</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px" id="color-picker">
          ${SUBJECT_COLORS.map((c,i)=>`<div data-color="${c.hex}" title="${c.name}" onclick="selectColor(this,'${c.hex}')"
            style="width:28px;height:28px;border-radius:8px;background:${c.hex};cursor:pointer;border:2px solid ${i===0?'var(--ink)':'transparent'};transition:border .15s"></div>`).join('')}
        </div>
        <div id="selected-color-name" style="font-size:13px;color:var(--slate);font-weight:500">Selected: ${SUBJECT_COLORS[0].name}</div>
        <input type="hidden" id="sub-color" value="${SUBJECT_COLORS[0].hex}">
      </div>
    </div>
    <div id="modal-error" style="display:none;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:10px 14px;border-radius:8px;font-size:13px;margin-top:12px;"></div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-submit" id="modal-btn" onclick="saveNewSubject()">Add Subject</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)closeModal();});
}

function selectColor(el,color){
  document.querySelectorAll('#color-picker div').forEach(d=>d.style.border='2px solid transparent');
  el.style.border='2px solid var(--ink)';
  document.getElementById('sub-color').value=color;
  const nameEl=document.getElementById('selected-color-name');
  if(nameEl) nameEl.textContent='Selected: '+colorName(color);
}

async function saveNewSubject(){
  const code=document.getElementById('sub-code').value.trim().toUpperCase();
  const name=document.getElementById('sub-name').value.trim();
  const section=document.getElementById('sub-section').value;
  const color=document.getElementById('sub-color').value;
  const errEl=document.getElementById('modal-error'); errEl.style.display='none';
  if(!code||!name){errEl.textContent='⚠️ Code and Name are required.';errEl.style.display='block';return;}
  const btn=document.getElementById('modal-btn');
  btn.textContent='Saving…'; btn.disabled=true;
  try{
    const sub=await api('POST','/api/subjects',{code,name,section,color});
    closeModal(); showToast('✅ Subject added','success');
    window._allSubjects=[...(window._allSubjects||[]),sub];
    renderSubjectsSections(window._allSubjects);
    invalidatePage('admin-attendance');
  } catch(e){errEl.textContent='❌ '+e.message;errEl.style.display='block';}
  finally{btn.textContent='Add Subject';btn.disabled=false;}
}

function openEditSubjectModal(id){
  const sub=(window._allSubjects||[]).find(s=>s.id===id);
  if(!sub) return;
  const ov=document.createElement('div'); ov.className='modal-overlay'; ov.id='student-modal';
  ov.innerHTML=`
  <div class="modal-box" style="max-width:480px">
    <div class="modal-title">Edit Subject</div>
    <div style="display:grid;gap:16px">
      <div class="form-group"><label class="form-label">Subject Code</label><input class="form-input" value="${sub.code}" disabled style="opacity:.5"></div>
      <div class="form-group"><label class="form-label">Subject Name *</label><input class="form-input" id="sub-name" value="${sub.name}"></div>
      <div class="form-group"><label class="form-label">Section *</label>
        <select class="select-input" id="sub-section">
          ${['MCA Sec-A','MCA Sec-B','MCA Sec-C'].map(s=>`<option ${s===sub.section?'selected':''}>${s}</option>`).join('')}
        </select></div>
      <div class="form-group"><label class="form-label">Color</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px" id="color-picker">
          ${SUBJECT_COLORS.map(c=>`<div data-color="${c.hex}" title="${c.name}" onclick="selectColor(this,'${c.hex}')"
            style="width:28px;height:28px;border-radius:8px;background:${c.hex};cursor:pointer;border:2px solid ${c.hex===sub.color?'var(--ink)':'transparent'};transition:border .15s"></div>`).join('')}
        </div>
        <div id="selected-color-name" style="font-size:13px;color:var(--slate);font-weight:500">Selected: ${colorName(sub.color)}</div>
        <input type="hidden" id="sub-color" value="${sub.color}">
      </div>
    </div>
    <div id="modal-error" style="display:none;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;padding:10px 14px;border-radius:8px;font-size:13px;margin-top:12px;"></div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-submit" id="modal-btn" onclick="saveEditSubject(${id})">Save Changes</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)closeModal();});
}

async function saveEditSubject(id){
  const name=document.getElementById('sub-name').value.trim();
  const section=document.getElementById('sub-section').value;
  const color=document.getElementById('sub-color').value;
  const errEl=document.getElementById('modal-error'); errEl.style.display='none';
  if(!name){errEl.textContent='⚠️ Name is required.';errEl.style.display='block';return;}
  const btn=document.getElementById('modal-btn');
  btn.textContent='Saving…'; btn.disabled=true;
  try{
    const updated=await api('PUT',`/api/subjects/${id}`,{name,section,color});
    closeModal(); showToast('✅ Subject updated','success');
    const idx=(window._allSubjects||[]).findIndex(s=>s.id===id);
    if(idx>=0) window._allSubjects[idx]=updated;
    renderSubjectsSections(window._allSubjects);
    invalidatePage('admin-attendance','admin-reports');
  } finally{btn.textContent='Save Changes';btn.disabled=false;}
}

async function deleteSubjectAdmin(id,name){
  if(!confirm(`Delete subject "${name}"?\n\nAll related attendance records will also be deleted.`)) return;
  await api('DELETE',`/api/subjects/${id}`);
  window._allSubjects=(window._allSubjects||[]).filter(s=>s.id!==id);
  renderSubjectsSections(window._allSubjects);
  showToast('🗑 Subject deleted','info');
  invalidatePage('admin-dashboard','admin-reports','admin-attendance','student-dashboard','student-attendance');
}

// ══════════════════════════════════════════════
//  ADMIN — REPORTS
// ══════════════════════════════════════════════
async function buildAdminReports(el){
  el.innerHTML='<div class="loading-state">Generating reports…</div>';
  const rep=await api('GET','/api/stats/admin');
  const {allStudents,months,leaveStats,leaveDistribution}=rep;
  const distColors=['#1a7a6e','#9333ea','#d97706','#c94040','#1e40af','#be185d'];
  const maxPct=Math.max(...months.map(m=>m.pct),1);
  const total=leaveStats.total||1;
  el.innerHTML=`
  <div class="stats-grid">
    <div class="stat-card teal"><div class="stat-icon">👥</div><div class="stat-label">Total Students</div><div class="stat-value" style="color:var(--teal)">${rep.totalStudents}</div></div>
    <div class="stat-card gold"><div class="stat-icon">📊</div><div class="stat-label">Monthly Attendance</div><div class="stat-value" style="color:var(--gold)">${rep.monthlyAttendance}%</div></div>
    <div class="stat-card rose"><div class="stat-icon">⚠️</div><div class="stat-label">At Risk Students</div><div class="stat-value" style="color:var(--danger)">${rep.atRiskStudents}</div></div>
    <div class="stat-card amber"><div class="stat-icon">📝</div><div class="stat-label">Total Leave Requests</div><div class="stat-value" style="color:var(--warn)">${leaveStats.total}</div></div>
  </div>
  <div class="grid-2 mb-20">
    <div class="card">
      <div class="card-header"><div class="card-title">6-Month Attendance Trend</div></div>
      <div class="card-body">
        <div style="display:flex;gap:8px;align-items:flex-end;height:130px;margin-bottom:8px">
          ${months.map((m,i)=>`
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px">
              <div style="font-size:11px;font-family:'JetBrains Mono',monospace;color:var(--slate)">${m.pct}%</div>
              <div style="width:100%;border-radius:6px 6px 0 0;background:${i===months.length-1?'var(--teal)':'var(--teal-light)'};height:${Math.round(m.pct/maxPct*110)+5}px;transition:height .5s"></div>
              <div style="font-size:11px;color:var(--muted)">${m.label}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">Leave Status Breakdown</div></div>
      <div class="card-body">
        ${[{label:'Approved',val:leaveStats.approved,color:'#22c55e'},
           {label:'Pending', val:leaveStats.pending, color:'var(--warn)'},
           {label:'Rejected',val:leaveStats.rejected,color:'var(--danger)'}].map(r=>`
          <div style="margin-bottom:18px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="font-size:14px;font-weight:500">${r.label}</span>
              <span class="font-mono" style="font-weight:600;color:${r.color}">${r.val} (${Math.round(r.val/total*100)}%)</span>
            </div>
            <div class="progress-bar" style="margin-top:0">
              <div class="progress-fill" style="width:${Math.round(r.val/total*100)}%;background:${r.color}"></div>
            </div>
          </div>`).join('')}
      </div>
    </div>
  </div>
  <div class="grid-2 mb-20">
    <div class="card">
      <div class="card-header"><div class="card-title">Leave Type Distribution</div></div>
      <div class="card-body">
        <div class="donut-container">
          <svg width="110" height="110" viewBox="0 0 110 110">
            ${(()=>{
              const t2=leaveDistribution.reduce((a,b)=>a+b.count,0)||1;
              let off=0;const circ=2*Math.PI*40;
              return leaveDistribution.map((d,i)=>{
                const pct=d.count/t2,dash=circ*pct;
                const e=`<circle cx="55" cy="55" r="40" fill="none" stroke="${distColors[i%distColors.length]}" stroke-width="18" stroke-dasharray="${dash} ${circ-dash}" stroke-dashoffset="${-off}" transform="rotate(-90 55 55)"/>`;
                off+=dash; return e;
              }).join('');
            })()}
            <text x="55" y="60" text-anchor="middle" font-size="16" font-weight="700" fill="var(--ink)">${leaveDistribution.reduce((a,b)=>a+b.count,0)}</text>
          </svg>
          <div class="donut-legend">
            ${leaveDistribution.map((d,i)=>`
              <div class="legend-item">
                <div class="legend-dot" style="background:${distColors[i%distColors.length]}"></div>
                <span>${d.type}</span>
                <span class="font-mono" style="margin-left:auto;font-size:13px;font-weight:600">${d.count}</span>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">At-Risk Students</div></div>
      ${allStudents.filter(s=>s.percentage<75).length===0
        ?`<div class="empty-state"><div class="empty-state-icon">🎉</div><div class="empty-state-text">All students above 75%</div></div>`
        :`<table class="data-table">
            <thead><tr><th>Student</th><th>Section</th><th>Attendance</th><th>Missed</th></tr></thead>
            <tbody>
              ${allStudents.filter(s=>s.percentage<75).map(s=>`
                <tr>
                  <td><div style="display:flex;align-items:center;gap:8px">
                    <div style="width:30px;height:30px;border-radius:6px;background:${s.avatar};color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0">${ini(s.name)}</div>
                    <div>
                      <div style="font-size:13px;font-weight:600">${s.name}</div>
                      <div style="font-size:10px;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-top:1px">${s.studentId||'—'}</div>
                    </div>
                  </div></td>
                  <td style="font-size:12px;color:var(--muted)">${s.section}</td>
                  <td><span class="badge badge-red">${s.percentage}%</span></td>
                  <td class="font-mono" style="font-size:13px">${s.absent}</td>
                </tr>`).join('')}
            </tbody>
          </table>`}
    </div>
  </div>
  <div class="card">
    <div class="card-header">
      <div class="card-title">Export Reports</div>
      <span class="text-muted" style="font-size:12px">Downloads as CSV — opens in Excel / Google Sheets</span>
    </div>
    <div class="card-body">
      <input id="export-date-from" type="hidden">
      <input id="export-date-to"   type="hidden">
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
        ${[{icon:'📊',title:'Attendance Report',desc:'Per-student merged: all subjects + overall %',endpoint:'attendance'},
           {icon:'📝',title:'Leave Report',     desc:'All leave applications with applied date',endpoint:'leaves'},
           {icon:'⚠️',title:'At Risk Students', desc:'Students below 75% + classes needed',  endpoint:'at-risk'},
           {icon:'👥',title:'Student List',     desc:'All students with full attendance stats',endpoint:'students'}].map(r=>`
          <div id="export-card-${r.endpoint}"
            style="border:1.5px solid var(--border);border-radius:12px;padding:20px;cursor:pointer;transition:all .2s;position:relative"
            onmouseenter="this.style.borderColor='var(--teal)';this.style.background='var(--teal-light)'"
            onmouseleave="this.style.borderColor='var(--border)';this.style.background='transparent'"
            onclick="downloadReport('${r.endpoint}','${r.title}',this)">
            <div style="font-size:28px;margin-bottom:10px">${r.icon}</div>
            <div style="font-size:14px;font-weight:600;margin-bottom:4px">${r.title}</div>
            <div style="font-size:12px;color:var(--muted)">${r.desc}</div>
            <div style="margin-top:12px;display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--teal)">
              <span>⬇ Download CSV</span>
            </div>
          </div>`).join('')}
      </div>
    </div>
  </div>`;
}

// ── EXPORT ─────────────────────────────────────────────────────────────────
async function downloadReport(endpoint,title,cardEl){
  const origHTML=cardEl.innerHTML;
  cardEl.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100px;gap:10px">
    <div style="width:28px;height:28px;border:3px solid var(--teal-light);border-top-color:var(--teal);border-radius:50%;animation:spin .7s linear infinite"></div>
    <div style="font-size:13px;color:var(--teal);font-weight:600">Generating…</div></div>`;
  try{
    const df=document.getElementById('export-date-from')?.value||'';    const dt=document.getElementById('export-date-to')?.value||'';    const qs=new URLSearchParams();    if(df) qs.set('dateFrom',df);    if(dt) qs.set('dateTo',dt);    const qStr=qs.toString();    const res=await fetch(`/api/export/${endpoint}${qStr?'?'+qStr:''}`);
    if(!res.ok) throw new Error('Export failed');
    const blob=await res.blob();
    const cd=res.headers.get('Content-Disposition')||'';
    const match=cd.match(/filename=(.+)/);
    const filename=match?match[1]:`${endpoint}_report.csv`;
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`✅ ${title} downloaded!`,'success');
  } catch(e){ showToast(`❌ Failed to generate ${title}`,'error'); }
  finally{ cardEl.innerHTML=origHTML; }
}

// ── MODAL HELPER ───────────────────────────────────────────────────────────
function closeModal(){
  document.getElementById('student-modal')?.remove();
  document.getElementById('att-modal')?.remove();
}

// ── INIT ───────────────────────────────────────────────────────────────────
updateTopbarDate();
setInterval(updateTopbarDate,60000);
