// @ts-nocheck
import { dbFirestore } from "./firebase-config.js";
import { 
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, getDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let db = {
  companies: [],
  procuradores: [],
  sales: [],
  users: {
    'admin': { pass: 'admin', role: 'admin', name: 'Administrador' },
    'lector': { pass: 'lector', role: 'lector', name: 'Solo Lectura' }
  },
  settings: { ads: 0, secretary: 0, managers: 1 }
};

let currentUser = null;

const $ = id => document.getElementById(id);

const money = n => new Intl.NumberFormat('es-AR',{
  style:'currency',
  currency:'ARS',
  maximumFractionDigits:2
}).format(Number(n)||0);

const today = () => new Date().toISOString().slice(0,10);

function esc(s){
  return String(s??'').replace(/[&<>"']/g,m=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[m]));
}

function isAdmin(){
  return currentUser && currentUser.role==='admin';
}

// 🔄 Sincronización con Firebase Firestore
async function loadDatabaseFromFirebase(){
  try {
    // 1. Cargar Empresas
    const compSnap = await getDocs(collection(dbFirestore, "companies"));
    db.companies = compSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 2. Cargar Procuradores
    const procSnap = await getDocs(collection(dbFirestore, "procuradores"));
    db.procuradores = procSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 3. Cargar Ventas
    const salesSnap = await getDocs(collection(dbFirestore, "sales"));
    db.sales = salesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 4. Cargar Configuración y Usuarios
    const cfgDoc = await getDoc(doc(dbFirestore, "settings", "general"));
    if(cfgDoc.exists()){
      const data = cfgDoc.data();
      if(data.settings) db.settings = data.settings;
      if(data.users) db.users = data.users;
    } else {
      // Inicializar en Firestore si no existe
      await setDoc(doc(dbFirestore, "settings", "general"), { settings: db.settings, users: db.users });
    }

    renderAll();
  } catch (error) {
    console.error("Error al conectar con Firebase:", error);
    alert("Error al cargar los datos desde Firebase. Revisa tu configuración.");
  }
}

async function saveSettingsToFirebase(){
  await setDoc(doc(dbFirestore, "settings", "general"), { settings: db.settings, users: db.users });
}

// --- AUTENTICACIÓN ---
function handleLogin(e){
  if(e) e.preventDefault();
  const u=$('loginUser').value.trim().toLowerCase();
  const p=$('loginPass').value.trim();

  if(!db.users[u] || db.users[u].pass!==p){
    alert('Usuario o contraseña incorrectos.');
    return;
  }

  currentUser={username:u,...db.users[u]};
  $('loginModal').classList.remove('show');
  $('loginUser').value=''; $('loginPass').value='';
  updateInterfaceByRole();
  renderAll();
}

function logout(){
  currentUser=null;
  $('loginModal').classList.add('show');
}

async function saveUserAccess(){
  if(!isAdmin()) return;
  const username=$('newUsername').value.trim().toLowerCase();
  const pass=$('newUserPass').value.trim();
  const role=$('newUserRole').value;

  if(!username || !pass){
    alert('Ingresa usuario y contraseña.');
    return;
  }

  db.users[username] = { pass, role, name: role==='admin' ? 'Administrador' : 'Solo Lectura' };
  await saveSettingsToFirebase();
  $('newUsername').value=''; $('newUserPass').value='';
  renderUsersList();
  alert('Usuario actualizado correctamente.');
}

async function deleteUser(username){
  if(!isAdmin()) return;
  if(username===currentUser.username){
    alert('No puedes eliminar tu propio usuario activo.');
    return;
  }
  if(confirm(`¿Eliminar al usuario ${username}?`)){
    delete db.users[username];
    await saveSettingsToFirebase();
    renderUsersList();
  }
}

function renderUsersList(){
  const box=$('usersList');
  if(!box) return;
  const usersArr=Object.entries(db.users);
  box.innerHTML=`
    <h3>Usuarios Registrados</h3>
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Usuario</th><th>Rol</th><th>Acción</th></tr></thead>
        <tbody>
          ${usersArr.map(([u,data])=>`
            <tr>
              <td><b>${esc(u)}</b></td>
              <td><span class="badge ${data.role==='admin'?'':'badge-pending'}">${data.role.toUpperCase()}</span></td>
              <td>${u!==currentUser.username?`<button class="btn danger small" onclick="window.delUser('${u}')">Eliminar</button>`:'<span class="muted">(Actual)</span>'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}
window.delUser = deleteUser;

function updateInterfaceByRole(){
  const headerSection=$('userHeaderSection');
  if(!currentUser){ headerSection.innerHTML=''; return; }

  headerSection.innerHTML=`
    <div class="user-badge">
      <span>👤 ${esc(currentUser.username)} (${currentUser.role})</span>
      <button id="btnLogout">Salir</button>
    </div>
  `;
  $('btnLogout').addEventListener('click', logout);

  document.querySelectorAll('.admin-only').forEach(el=>el.style.display=isAdmin()?'block':'none');
  const navConfigBtn=$('navConfigBtn');
  if(navConfigBtn) navConfigBtn.style.display=isAdmin()?'block':'none';

  if(!isAdmin() && $('config').classList.contains('active')){
    document.querySelectorAll('.nav button').forEach(item=>item.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(item=>item.classList.remove('active'));
    document.querySelector('[data-tab="dashboard"]').classList.add('active');
    $('dashboard').classList.add('active');
  }

  ['managerCount','adsAmount','secretaryAmount'].forEach(id=>{
    const el=$(id); if(el) el.disabled=!isAdmin();
  });
}

function getSortedProcs(){
  return [...db.procuradores].sort((a,b)=>a.name.localeCompare(b.name,'es',{sensitivity:'accent'}));
}

// Navegación de pestañas
document.querySelectorAll('.nav button').forEach(button=>{
  button.addEventListener('click',()=>{
    document.querySelectorAll('.nav button').forEach(item=>item.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(item=>item.classList.remove('active'));
    button.classList.add('active');
    const tab=$(button.dataset.tab);
    if(tab) tab.classList.add('active');
    renderAll();
  });
});

const company = id => db.companies.find(item=>item.id===id);
const proc = id => db.procuradores.find(item=>item.id===id);

function getSaleShares(amount, isCuentaPropia){
  const amt = Number(amount)||0;
  if(isCuentaPropia){
    return { procShare: 0, companyShare: amt * 0.50, managementShare: amt * 0.50 };
  } else {
    return { procShare: amt * 0.25, companyShare: amt * 0.375, managementShare: amt * 0.375 };
  }
}

function totals(date){
  const sales = db.sales.filter(sale=>(!date||sale.date===date)&&sale.checked);
  let total=0, procTot=0, compTot=0, mgmtTot=0;
  sales.forEach(s=>{
    const shares = getSaleShares(s.amount, s.isCuentaPropia);
    total += Number(s.amount||0);
    procTot += shares.procShare;
    compTot += shares.companyShare;
    mgmtTot += shares.managementShare;
  });
  return { sales, total, proc: procTot, company: compTot, management: mgmtTot };
}

// --- EMPRESAS ---
async function addCompany(){
  if(!isAdmin()){alert('Acceso restringido.');return;}
  const name=$('companyName').value.trim();
  const members=Math.max(1,Math.min(100,Number($('companyMembers').value)||1));
  if(!name){alert('Ingresa el nombre de la empresa.');return;}

  const newComp = { name, members };
  const docRef = await addDoc(collection(dbFirestore, "companies"), newComp);
  db.companies.push({ id: docRef.id, ...newComp });

  $('companyName').value=''; $('companyMembers').value=3;
  renderAll();
}

async function deleteCompany(id){
  if(!isAdmin()){alert('Acceso restringido.');return;}
  if(db.sales.some(sale=>sale.companyId===id)){alert('No se puede borrar: tiene ventas.');return;}
  if(confirm('¿Eliminar esta empresa?')){
    await deleteDoc(doc(dbFirestore, "companies", id));
    db.companies = db.companies.filter(item=>item.id!==id);
    renderAll();
  }
}
window.deleteCompany = deleteCompany;

// --- PROCURADORES ---
async function addProc(){
  if(!isAdmin()){alert('Acceso restringido.');return;}
  const name=$('procName').value.trim();
  const bank=$('procBank').value.trim();
  const account=$('procAccount').value.trim();
  if(!name){alert('Ingresa el nombre.');return;}

  const newProc = { name, bank, account };
  const docRef = await addDoc(collection(dbFirestore, "procuradores"), newProc);
  db.procuradores.push({ id: docRef.id, ...newProc });

  $('procName').value=''; $('procBank').value=''; $('procAccount').value='';
  renderAll();
}

async function deleteProc(id){
  if(!isAdmin()){alert('Acceso restringido.');return;}
  if(db.sales.some(sale=>sale.procId===id)){alert('Tiene ventas registradas.');return;}
  if(confirm('¿Eliminar procurador?')){
    await deleteDoc(doc(dbFirestore, "procuradores", id));
    db.procuradores = db.procuradores.filter(item=>item.id!==id);
    renderAll();
  }
}
window.deleteProc = deleteProc;

// --- VENTAS ---
async function addSale(){
  if(!isAdmin()){alert('Acceso restringido.');return;}
  const date=$('saleDate').value;
  const cid=$('saleCompany').value;
  const amount=Number($('saleAmount').value);
  const pid=$('saleProc').value;
  const isCuentaPropia=$('saleIsCuentaPropia').checked;

  if(!date||!cid||!pid||!(amount>0)){alert('Completa los campos.');return;}

  const newSale = { date, companyId: cid, amount, procId: pid, isCuentaPropia, checked: false };
  const docRef = await addDoc(collection(dbFirestore, "sales"), newSale);
  db.sales.push({ id: docRef.id, ...newSale });

  $('saleAmount').value=''; $('saleIsCuentaPropia').checked=false;
  renderAll();
}

async function toggleSaleCheck(id){
  if(!isAdmin()){alert('Acceso restringido.');return;}
  const sale=db.sales.find(s=>s.id===id);
  if(sale){
    sale.checked=!sale.checked;
    await updateDoc(doc(dbFirestore, "sales", id), { checked: sale.checked });
    renderAll();
  }
}
window.toggleSaleCheck = toggleSaleCheck;

async function deleteSale(id){
  if(!isAdmin()){alert('Acceso restringido.');return;}
  if(confirm('¿Eliminar esta venta?')){
    await deleteDoc(doc(dbFirestore, "sales", id));
    db.sales = db.sales.filter(sale=>sale.id!==id);
    renderAll();
  }
}
window.deleteSale = deleteSale;

function companyBreakdown(c,date){
  const allSales = db.sales.filter(s => s.companyId === c.id && (!date || s.date === date));
  const checkedSales = allSales.filter(s => s.checked);
  const pendingSales = allSales.filter(s => !s.checked);

  let total=0, procPool=0, companyPool=0, managementPool=0;
  const procTotals={};

  checkedSales.forEach(s=>{
    const shares = getSaleShares(s.amount, s.isCuentaPropia);
    const amt = Number(s.amount||0);
    total += amt;
    procPool += shares.procShare;
    companyPool += shares.companyShare;
    managementPool += shares.managementShare;
    procTotals[s.procId] = (procTotals[s.procId]||0) + amt;
  });

  const perMember = c.members ? companyPool / c.members : 0;
  return { allSales, checkedSales, pendingSales, total, procTotals, procPool, companyPool, managementPool, perMember };
}

function renderCompanies(){
  const box=$('companiesList');
  if(!db.companies.length){ box.innerHTML='<div class="card empty">Todavía no hay empresas creadas.</div>'; return; }
  const date = $('dashDate').value || today();

  box.innerHTML = db.companies.map(c=>{
    const b = companyBreakdown(c, date);
    const rows = Object.entries(b.procTotals).map(([pid,total])=>{
      const p = proc(pid);
      return `<tr><td>${esc(p?.name||'Eliminado')}</td><td>${money(total)}</td><td>${money(b.procPool)}</td><td>${money(b.companyPool)}</td><td>${money(b.managementPool)}</td></tr>`;
    }).join('');

    const memberRows = Array.from({length:c.members},(_,i)=>`<tr><td>Integrante ${i+1}</td><td>${money(b.perMember)}</td><td>Asignar desde procurador</td></tr>`).join('');

    const pendingHTML = b.pendingSales.length ? `
      <div style="margin-top:14px">
        <h4 style="margin:0 0 6px;color:var(--orange)">Ventas pendientes de validación</h4>
        ${b.pendingSales.map(s=>{
          const p = proc(s.procId);
          return `<div class="sale pending-sale"><div class="sale-top"><div><span class="badge badge-pending">PENDIENTE</span> ${s.isCuentaPropia?'<span class="badge badge-cp">CUENTA PROPIA</span>':''} <span style="font-weight:700">${s.date}</span><div class="muted">Procurador: ${esc(p?.name||'')}</div></div><div style="display:flex;gap:8px"><b class="money">${money(s.amount)}</b>${isAdmin()?`<button class="btn green small" onclick="window.toggleSaleCheck('${s.id}')">✓ Check</button>`:''}</div></div></div>`;
        }).join('')}
      </div>
    `:'';

    return `
      <div class="card">
        <div class="company-head">
          <div><span class="badge">EMPRESA</span><h2 style="margin-top:7px">${esc(c.name)}</h2><div class="muted">${c.members} integrante(s) · ${b.checkedSales.length} venta(s) aprobada(s)</div></div>
          ${isAdmin()?`<div class="actions"><button class="btn danger small" onclick="window.deleteCompany('${c.id}')">Eliminar</button></div>`:''}
        </div>
        <div class="breakdown">
          <div class="break"><span>Total vendido</span><strong>${money(b.total)}</strong></div>
          <div class="break"><span>Procuradores</span><strong>${money(b.procPool)}</strong></div>
          <div class="break"><span>Empresa</span><strong>${money(b.companyPool)}</strong></div>
        </div>
        ${pendingHTML}
        <h3 style="margin-top:18px">Detalle por procurador</h3>
        ${rows?`<div class="table-wrap"><table class="table"><thead><tr><th>Procurador</th><th>Ventas</th><th>Procurador</th><th>Empresa</th><th>Gerencia</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty">Sin ventas aprobadas.</div>'}
        <h3 style="margin-top:18px">Distribución parte empresa</h3>
        <div class="table-wrap"><table class="table"><thead><tr><th>Integrante</th><th>Debe recibir</th><th>Procurador</th></tr></thead><tbody>${memberRows}</tbody></table></div>
      </div>
    `;
  }).join('');
}

function populateSelects(){
  const saleCompany = $('saleCompany'), salesFilterCompany = $('salesFilterCompany'), saleProc = $('saleProc'), managerCount = $('managerCount');
  const compOpts = '<option value="">Seleccionar...</option>' + db.companies.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  if(saleCompany) saleCompany.innerHTML = compOpts;
  if(salesFilterCompany) salesFilterCompany.innerHTML = '<option value="">Todas</option>' + compOpts;

  const sortedProcs = getSortedProcs();
  if(saleProc) saleProc.innerHTML = '<option value="">Seleccionar...</option>' + sortedProcs.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
  if(managerCount && !managerCount.options.length){
    for(let i=1;i<=10;i++){ managerCount.innerHTML += `<option value="${i}">${i}</option>`; }
  }
  if(managerCount) managerCount.value = db.settings.managers || 1;
}

function renderSales(){
  const date = $('salesFilterDate').value, cid = $('salesFilterCompany').value;
  const sales = db.sales.filter(sale => (!date || sale.date === date) && (!cid || sale.companyId === cid));
  const box = $('salesList');
  if(!sales.length){ box.innerHTML='<div class="card empty">No hay ventas.</div>'; return; }

  box.innerHTML = [...sales].sort((a,b)=>b.date.localeCompare(a.date)).map(sale=>{
    const c = company(sale.companyId), p = proc(sale.procId), shares = getSaleShares(sale.amount, sale.isCuentaPropia);
    return `
      <div class="card sale ${sale.checked?'':'pending-sale'}">
        <div class="sale-top">
          <div>
            <div style="display:flex;gap:6px">${sale.checked?'<span class="badge badge-ok">APROBADA</span>':'<span class="badge badge-pending">PENDIENTE</span>'}${sale.isCuentaPropia?'<span class="badge badge-cp">CUENTA PROPIA</span>':''}<b>${esc(c?.name||'')}</b></div>
            <div class="muted">${sale.date} · Procurador: ${esc(p?.name||'')}</div>
          </div>
          <b class="money">${money(sale.amount)}</b>
        </div>
        ${isAdmin()?`<div class="actions"><button class="btn ${sale.checked?'orange':'green'} small" onclick="window.toggleSaleCheck('${sale.id}')">${sale.checked?'Quitar Check':'Dar Check'}</button><button class="btn danger small" onclick="window.deleteSale('${sale.id}')">Eliminar</button></div>`:''}
      </div>
    `;
  }).join('');
}

async function saveSettings(){
  if(!isAdmin()) return;
  db.settings.ads = Number($('adsAmount').value)||0;
  db.settings.secretary = Number($('secretaryAmount').value)||0;
  db.settings.managers = Math.max(1, Math.min(10, Number($('managerCount').value)||1));
  await saveSettingsToFirebase();
  renderManagement();
  renderDashboard();
}

function renderManagement(){
  const date = $('gerDate').value || today();
  const t = totals(date);
  const ads = Number(db.settings.ads)||0, sec = Number(db.settings.secretary)||0, managers = Math.max(1, Number(db.settings.managers)||1);

  if($('adsAmount')) $('adsAmount').value = ads;
  if($('secretaryAmount')) $('secretaryAmount').value = sec;
  if($('managerCount')) $('managerCount').value = managers;

  const net = t.management - ads - sec, per = net / managers;
  $('managementResult').innerHTML=`
    <div class="grid">
      <div class="stat"><div class="label">Ventas Aprobadas</div><div class="value">${money(t.total)}</div></div>
      <div class="stat"><div class="label">Fondo Gerencia</div><div class="value">${money(t.management)}</div></div>
      <div class="stat"><div class="label">ADS + Secretaría</div><div class="value">${money(ads+sec)}</div></div>
      <div class="stat"><div class="label">Neto por gerente</div><div class="value">${money(per)}</div></div>
    </div>
  `;
}

function renderDashboard(){
  const date = $('dashDate').value || today();
  const t = totals(date);
  $('dashStats').innerHTML=`
    <div class="stat"><div class="label">Ventas Aprobadas</div><div class="value">${money(t.total)}</div></div>
    <div class="stat"><div class="label">Procuradores</div><div class="value">${money(t.proc)}</div></div>
    <div class="stat"><div class="label">Empresas</div><div class="value">${money(t.company)}</div></div>
    <div class="stat"><div class="label">Gerencia</div><div class="value">${money(t.management)}</div></div>
  `;
  $('dashContent').innerHTML=`<div class="card"><h2>Resumen — ${date}</h2>${db.companies.map(c=>{const b=companyBreakdown(c,date); return `<div class="sale"><div class="sale-top"><b>${esc(c.name)}</b><b>${money(b.total)}</b></div></div>`;}).join('')}</div>`;
}

function renderProcList(){
  const box=$('procList'); if(!box) return;
  box.innerHTML=`<div class="card"><h2>Procuradores</h2><div class="table-wrap"><table class="table"><thead><tr><th>Nombre</th><th>Banco</th><th>Cuenta</th><th></th></tr></thead><tbody>${getSortedProcs().map(p=>`<tr><td><b>${esc(p.name)}</b></td><td>${esc(p.bank||'-')}</td><td>${esc(p.account||'-')}</td><td>${isAdmin()?`<button class="btn danger small" onclick="window.deleteProc('${p.id}')">×</button>`:''}</td></tr>`).join('')}</tbody></table></div></div>`;
}

function renderAll(){
  if(!currentUser) return;
  updateInterfaceByRole();
  populateSelects();
  renderDashboard();
  renderCompanies();
  renderSales();
  renderManagement();
  renderProcList();
  renderUsersList();
}

// Event Listeners principales
$('dashDate').value = today(); $('saleDate').value = today(); $('salesFilterDate').value = today(); $('gerDate').value = today();
$('loginForm').addEventListener('submit', handleLogin);
$('btnAddCompany').addEventListener('click', addCompany);
$('btnAddProc').addEventListener('click', addProc);
$('btnAddSale').addEventListener('click', addSale);
$('btnSaveUser').addEventListener('click', saveUserAccess);
$('btnUpdateCalc').addEventListener('click', renderAll);
$('managerCount').addEventListener('change', saveSettings);
$('adsAmount').addEventListener('change', saveSettings);
$('secretaryAmount').addEventListener('change', saveSettings);

$('loginModal').classList.add('show');
loadDatabaseFromFirebase();
