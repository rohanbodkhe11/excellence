'use strict';
// Admin interface (HTML + CSS + client JS). Served by index.js at /admin.
// All authorization is enforced server-side on /api/admin/*; this file is only the UI.
module.exports = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Admin – Excellence Coaching Classes</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Crect width='8' height='8' rx='2' fill='%23A78BFA'/%3E%3C/svg%3E">
<style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,'Segoe UI',sans-serif;background:#F7F5FF;color:#202A44}
.clay{background:linear-gradient(145deg,#fff,#efeaff);border-radius:26px;box-shadow:10px 10px 22px rgba(167,139,250,.25),-7px -7px 16px #fff,inset 3px 3px 7px #fff,inset -4px -4px 9px rgba(167,139,250,.15)}
.btn{border:0;border-radius:999px;padding:.6rem 1.2rem;font-weight:800;color:#fff;cursor:pointer;background:linear-gradient(145deg,#b9a3ff,#8b6cf0);box-shadow:4px 4px 10px rgba(139,108,240,.4),inset 2px 2px 5px rgba(255,255,255,.5);text-decoration:none;display:inline-block;font-size:.95rem}
.btn:active{transform:translateY(2px)}.btn.red{background:linear-gradient(145deg,#ff9fb0,#fb7185)}.btn.sm{padding:.3rem .8rem;font-size:.8rem}
:focus-visible{outline:3px solid #202A44;outline-offset:2px}
input,select,textarea{font:inherit;padding:.6rem .9rem;border:0;border-radius:14px;background:#f3f0ff;box-shadow:inset 3px 3px 6px rgba(167,139,250,.25),inset -3px -3px 6px #fff;width:100%}
label{display:grid;gap:.25rem;font-weight:700;margin-bottom:.7rem}.err{color:#be123c;font-size:.85rem}
#login{max-width:380px;margin:12vh auto;padding:2rem}
#app{display:none;grid-template-columns:230px 1fr;min-height:100vh}
aside{padding:1.2rem;margin:.8rem;display:flex;flex-direction:column;gap:.5rem;height:calc(100vh - 1.6rem);position:sticky;top:.8rem}
aside button.nav{background:none;border:0;text-align:left;padding:.7rem 1rem;border-radius:16px;font:700 1rem inherit;cursor:pointer;color:inherit}
aside button.nav.on{background:#e6defe}main{padding:1rem;min-width:0}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:1rem;margin-bottom:1rem}.cards div{padding:1.2rem}.cards b{font-size:2rem;display:block}
.wrap{overflow-x:auto;padding:1rem}table{width:100%;border-collapse:collapse;min-width:640px}th,td{text-align:left;padding:.6rem;border-bottom:1px solid #e3dcfb;font-size:.92rem}
.bar{display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:1rem;align-items:center}.bar input,.bar select{width:auto;flex:1;min-width:140px}
dialog{border:0;border-radius:26px;padding:1.5rem;max-width:480px;width:92%}dialog::backdrop{background:rgba(32,42,68,.5)}
#toast{position:fixed;bottom:1rem;right:1rem;padding:1rem 1.3rem;display:none;z-index:99}
#menu{display:none;position:fixed;top:.6rem;left:.6rem;z-index:20}
@media(max-width:800px){#app{grid-template-columns:1fr}aside{position:fixed;left:0;top:0;z-index:15;transform:translateX(-120%);transition:transform .25s;width:230px;height:calc(100vh - 1.6rem)}aside.open{transform:none}#menu{display:block}main{padding-top:3.5rem}}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style></head><body>
<button id="menu" class="btn" aria-label="Open menu">☰</button>
<form id="login" class="clay"><h1>Admin sign in</h1><label>Email<input name="identifier" type="email" required autocomplete="username"></label>
<label>Password<input name="password" type="password" required autocomplete="current-password"></label><div class="err" id="lerr" role="alert"></div><button class="btn">Sign in</button></form>
<div id="app"><aside class="clay"><b>🎓 Admin</b>
<button class="nav on" data-v="dash">Dashboard</button><button class="nav" data-v="enq">Enquiries</button><button class="nav" data-v="crs">Courses</button>
<a class="btn" href="/">View site</a><button class="btn red" id="out">Log out</button></aside>
<main id="view" aria-live="polite"></main></div>
<dialog id="dlg" class="clay"></dialog><div id="toast" class="clay" role="status"></div>
<script nonce="__N__">
var $=function(s){return document.querySelector(s)};
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return '&#'+c.charCodeAt(0)+';'})}
function toast(m){var t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(function(){t.style.display='none'},4000)}
function api(path,opt){
  opt=opt||{};opt.headers={'Content-Type':'application/json','X-Requested-With':'fetch'};
  if(opt.body&&typeof opt.body!=='string')opt.body=JSON.stringify(opt.body);
  return fetch(path,opt).then(function(r){return r.json().catch(function(){return{}}).then(function(j){
    if(r.status===401&&path!=='/api/admin/login'){showLogin();throw new Error('Session expired. Please sign in again.')}
    if(!r.ok){var e=new Error(j.error||'Request failed');e.fields=j.fields;throw e}return j})})
}
function showLogin(){$('#app').style.display='none';$('#login').style.display='block'}
function showApp(){$('#login').style.display='none';$('#app').style.display='grid';go('dash')}
$('#login').onsubmit=function(e){e.preventDefault();$('#lerr').textContent='';
  api('/api/admin/login',{method:'POST',body:Object.fromEntries(new FormData(e.target))}).then(showApp).catch(function(x){$('#lerr').textContent=x.message})};
$('#out').onclick=function(){api('/api/admin/logout',{method:'POST'}).then(showLogin)};
$('#menu').onclick=function(){document.querySelector('aside').classList.toggle('open')};
document.querySelectorAll('.nav').forEach(function(b){b.onclick=function(){go(b.dataset.v);document.querySelector('aside').classList.remove('open')}});
function go(v){
  document.querySelectorAll('.nav').forEach(function(b){b.classList.toggle('on',b.dataset.v===v)});
  $('#view').innerHTML='<div class="clay wrap">Loading…</div>';
  ({dash:dash,enq:function(){enq(1)},crs:crs})[v]();
}
function fail(x){$('#view').innerHTML='<div class="clay wrap err">'+esc(x.message)+' <button class="btn sm" onclick="location.reload()">Retry</button></div>'}
function dash(){api('/api/admin/dashboard').then(function(d){
  var c=[['Student accounts',d.students],['New enquiries',d.newEnquiries],['Pending applications',d.pendingApplications],['Published courses',d.publishedCourses]];
  $('#view').innerHTML='<h1>Dashboard</h1><div class="cards">'+c.map(function(x){return '<div class="clay">'+esc(x[0])+'<b>'+esc(x[1])+'</b></div>'}).join('')+'</div><div class="clay wrap"><h2>Recent enquiries</h2>'+
  (d.recentEnquiries.length?'<table><tr><th>Ref</th><th>Student</th><th>Status</th><th>Date</th></tr>'+d.recentEnquiries.map(function(r){return '<tr><td>'+esc(r.referenceNumber)+'</td><td>'+esc(r.studentName)+'</td><td>'+esc(r.status)+'</td><td>'+new Date(r.createdAt).toLocaleDateString()+'</td></tr>'}).join('')+'</table>':'<p>No enquiries yet.</p>')+'</div>'}).catch(fail)}
var q='',st='';
function enq(p){
  api('/api/admin/enquiries?page='+p+'&q='+encodeURIComponent(q)+'&status='+st).then(function(d){
    $('#view').innerHTML='<h1>Enquiries</h1><div class="bar"><input id="sq" placeholder="Search name, phone, reference" aria-label="Search" value="'+esc(q)+'"><select id="ss" aria-label="Status filter">'+
    ['','new','contacted','admitted','closed'].map(function(s){return '<option value="'+s+'"'+(s===st?' selected':'')+'>'+(s||'All statuses')+'</option>'}).join('')+'</select><button class="btn sm" id="go">Search</button><a class="btn sm" href="/api/admin/export/enquiries">Export CSV</a></div><div class="clay wrap">'+
    (d.items.length?'<table><tr><th>Ref</th><th>Student</th><th>Phone</th><th>Class</th><th>Status</th><th></th></tr>'+d.items.map(function(r){return '<tr><td>'+esc(r.referenceNumber)+'</td><td>'+esc(r.studentName)+'<br><small>'+esc(r.parentName)+'</small></td><td><a href="tel:'+esc(r.phone)+'">'+esc(r.phone)+'</a></td><td>'+esc(r.currentClass)+'</td><td>'+esc(r.status)+'</td><td><button class="btn sm" data-id="'+esc(r._id)+'">Open</button></td></tr>'}).join('')+'</table>':'<p>No enquiries match.</p>')+
    '<p>Page '+d.page+' of '+Math.max(d.pages,1)+' ('+d.total+' total) <button class="btn sm" id="pv"'+(p<=1?' disabled':'')+'>Prev</button> <button class="btn sm" id="nx"'+(p>=d.pages?' disabled':'')+'>Next</button></p></div>';
    $('#go').onclick=function(){q=$('#sq').value;st=$('#ss').value;enq(1)};
    $('#pv').onclick=function(){enq(p-1)};$('#nx').onclick=function(){enq(p+1)};
    document.querySelectorAll('[data-id]').forEach(function(b){b.onclick=function(){
      var r=d.items.filter(function(x){return x._id===b.dataset.id})[0],dl=$('#dlg');
      dl.innerHTML='<h2>'+esc(r.referenceNumber)+'</h2><p>'+esc(r.studentName)+' · '+esc(r.phone)+'<br>'+esc(r.email)+'<br>Batch: '+esc(r.preferredBatch)+'<br>'+esc(r.message)+'</p><form><label>Status<select name="status">'+
      ['new','contacted','admitted','closed'].map(function(s){return '<option'+(s===r.status?' selected':'')+'>'+s+'</option>'}).join('')+'</select></label><label>Follow-up date<input type="date" name="followUpAt" value="'+(r.followUpAt?r.followUpAt.slice(0,10):'')+'"></label><label>Internal notes<textarea name="internalNotes" rows="3" maxlength="2000">'+esc(r.internalNotes)+'</textarea></label><div class="err" id="derr"></div><button class="btn">Save</button> <button class="btn red" type="button" id="cl">Close</button></form>';
      dl.showModal();$('#cl').onclick=function(){dl.close()};
      dl.querySelector('form').onsubmit=function(e){e.preventDefault();
        api('/api/admin/enquiries/'+r._id,{method:'PATCH',body:Object.fromEntries(new FormData(e.target))}).then(function(){dl.close();toast('Saved');enq(p)}).catch(function(x){$('#derr').textContent=x.message})}}});
  }).catch(fail)}
function crs(){api('/api/admin/courses').then(function(list){
  $('#view').innerHTML='<h1>Courses</h1><div class="bar"><button class="btn" id="add">Add course</button></div><div class="clay wrap">'+
  (list.length?'<table><tr><th>Title</th><th>Class</th><th>Fee (₹)</th><th>Published</th><th></th></tr>'+list.map(function(c){return '<tr><td>'+esc(c.title)+'</td><td>'+esc(c.targetClass)+'</td><td>'+esc(c.fee)+'</td><td>'+(c.isPublished?'Yes':'No')+'</td><td><button class="btn sm" data-e="'+esc(c._id)+'">Edit</button> <button class="btn sm red" data-d="'+esc(c._id)+'">Delete</button></td></tr>'}).join('')+'</table>':'<p>No courses yet. Add your first course.</p>')+'</div>';
  $('#add').onclick=function(){form()};
  document.querySelectorAll('[data-e]').forEach(function(b){b.onclick=function(){form(list.filter(function(c){return c._id===b.dataset.e})[0])}});
  document.querySelectorAll('[data-d]').forEach(function(b){b.onclick=function(){if(confirm('Delete this course permanently?'))
    api('/api/admin/courses/'+b.dataset.d,{method:'DELETE'}).then(function(){toast('Deleted');crs()}).catch(function(x){toast(x.message)})}});
}).catch(fail)}
function form(c){
  c=c||{};var dl=$('#dlg');
  dl.innerHTML='<h2>'+(c._id?'Edit':'Add')+' course</h2><form><label>Title<input name="title" required maxlength="120" value="'+esc(c.title)+'"></label><label>Description<textarea name="description" rows="3" maxlength="600">'+esc(c.description)+'</textarea></label>'+
  '<label>Subjects (comma separated)<input name="subjects" value="'+esc((c.subjects||[]).join(', '))+'"></label><label>Target class<input name="targetClass" value="'+esc(c.targetClass)+'"></label><label>Duration<input name="duration" value="'+esc(c.duration)+'"></label>'+
  '<label>Indicative fee (₹)<input name="fee" type="number" min="0" value="'+esc(c.fee||0)+'"></label><label>Image URL (https)<input name="imageUrl" value="'+esc(c.imageUrl)+'"></label><label style="display:flex;gap:.5rem"><input type="checkbox" name="isPublished" style="width:auto"'+(c.isPublished?' checked':'')+'> Published</label><div class="err" id="derr"></div><button class="btn">Save</button> <button class="btn red" type="button" id="cl">Cancel</button></form>';
  dl.showModal();$('#cl').onclick=function(){dl.close()};
  dl.querySelector('form').onsubmit=function(e){e.preventDefault();
    var f=e.target,b=Object.fromEntries(new FormData(f));b.isPublished=f.isPublished.checked;
    api(c._id?'/api/admin/courses/'+c._id:'/api/admin/courses',{method:c._id?'PATCH':'POST',body:b}).then(function(){dl.close();toast('Saved');crs()}).catch(function(x){$('#derr').textContent=x.message})}
}
api('/api/admin/me').then(showApp).catch(showLogin);
</script></body></html>`;
