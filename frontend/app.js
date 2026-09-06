(() => {
  const API = (window.PIPSGOX_API_BASE || '').replace(/\/$/, '');
  const state = { user: null, tab: 'dashboard', accounts: [], trades: [], journal: [], summaries: {}, authMode: 'login', loading: false };
  const app = document.getElementById('app');

  const esc = (v) => String(v ?? '').replace(/[&<>\"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const money = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const date = (v) => v ? new Date(v).toLocaleString() : '—';
  const initials = (name) => (name || 'T').trim().split(/\s+/).slice(0,2).map(x => x[0]).join('').toUpperCase();

  async function api(path, options = {}) {
    const res = await fetch(`${API}${path}`, { credentials: 'include', ...options, headers: { ...(options.body ? {'Content-Type':'application/json'} : {}), ...(options.headers || {}) } });
    if (res.status === 204) return {};
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `REQUEST_${res.status}`);
    return body;
  }
  const json = (method, body) => ({ method, body: JSON.stringify(body) });

  async function boot() {
    try { state.user = (await api('/auth/me')).user; await loadData(); } catch { state.user = null; }
    render();
  }

  async function loadData() {
    if (!state.user) return;
    const [a, t, j] = await Promise.all([api('/accounts'), api('/trades'), api('/journal')]);
    state.accounts = a.accounts || []; state.trades = t.trades || []; state.journal = j.entries || [];
    await Promise.all(state.trades.map(async (trade) => { try { state.summaries[trade.id] = (await api(`/trades/${trade.id}/summary`)).summary; } catch {} }));
  }

  function authView() {
    const signup = state.authMode === 'signup';
    app.innerHTML = `<main class="auth-page"><section class="auth-card">
      <div class="auth-logo">Pipsgox <span>Journal</span></div><p class="auth-sub">A focused workspace for recording, reviewing and improving your trades.</p>
      <form class="form" id="authForm">
        ${signup ? `<div class="field"><label>Display name</label><input name="display_name" required maxlength="100" autocomplete="name" /></div>` : ''}
        <div class="field"><label>Email</label><input name="email" type="email" required autocomplete="email" /></div>
        <div class="field"><label>Password</label><input name="password" type="password" minlength="8" required autocomplete="${signup ? 'new-password':'current-password'}" /></div>
        ${!signup ? `<label class="muted"><input type="checkbox" name="remember_device" /> Remember this device</label>` : ''}
        <div id="authError"></div><button class="btn primary" type="submit">${signup ? 'Create account':'Sign in'}</button>
      </form>
      <div class="auth-switch">${signup ? 'Already have an account?':'New to Pipsgox Journal?'} <button class="link" id="authSwitch">${signup ? 'Sign in':'Create account'}</button></div>
    </section></main>`;
    document.getElementById('authSwitch').onclick = () => { state.authMode = signup ? 'login':'signup'; authView(); };
    document.getElementById('authForm').onsubmit = async (e) => {
      e.preventDefault(); const fd = new FormData(e.currentTarget); const payload = Object.fromEntries(fd.entries());
      if (!signup) payload.remember_device = fd.get('remember_device') === 'on';
      const error = document.getElementById('authError'); error.innerHTML = '';
      try { const r = await api(signup ? '/auth/signup':'/auth/login', json('POST', payload)); state.user = r.user; await loadData(); render(); }
      catch (err) { error.innerHTML = `<div class="error">${esc(err.message.replaceAll('_',' '))}</div>`; }
    };
  }

  function layout(content) {
    const tabs = [['dashboard','Dashboard'],['trades','Trades'],['accounts','Accounts'],['journal','Journal']];
    app.innerHTML = `<div class="shell"><aside class="sidebar"><div class="brand">Pipsgox <span>Journal</span></div><nav class="nav">${tabs.map(([id,label]) => `<button data-tab="${id}" class="${state.tab===id?'active':''}">${label}</button>`).join('')}</nav><div class="sidebar-footer">Private trading workspace</div></aside><div class="main"><header class="topbar"><h1>${tabs.find(x=>x[0]===state.tab)?.[1] || 'Dashboard'}</h1><div class="user-menu"><span>${esc(state.user.display_name)}</span><span class="avatar">${esc(initials(state.user.display_name))}</span><button class="btn" id="logout">Logout</button></div></header><main class="content">${content}</main></div><nav class="mobile-nav">${tabs.map(([id,label]) => `<button data-tab="${id}" class="${state.tab===id?'active':''}">${label}</button>`).join('')}</nav></div>`;
    document.querySelectorAll('[data-tab]').forEach(b => b.onclick = async () => { state.tab=b.dataset.tab; render(); });
    document.getElementById('logout').onclick = async () => { await api('/auth/logout',{method:'POST'}).catch(()=>{}); state.user=null; state.accounts=[]; state.trades=[]; state.journal=[]; authView(); };
  }

  function dashboard() {
    const closed = state.trades.map(t=>state.summaries[t.id]).filter(s=>s?.status==='CLOSED');
    const net = closed.reduce((n,s)=>n+Number(s.net_realized_pnl||0),0);
    const wins = closed.filter(s=>Number(s.net_realized_pnl)>0).length;
    const winRate = closed.length ? `${Math.round(wins/closed.length*100)}%` : '—';
    const open = state.trades.filter(t=>state.summaries[t.id]?.status==='OPEN').length;
    return `<div class="grid"><div class="card"><div class="metric-label">Net realized P&L</div><div class="metric-value ${net>=0?'positive':'negative'}">₹${money(net)}</div></div><div class="card"><div class="metric-label">Closed trades</div><div class="metric-value">${closed.length}</div></div><div class="card"><div class="metric-label">Win rate</div><div class="metric-value">${winRate}</div></div><div class="card"><div class="metric-label">Open trades</div><div class="metric-value">${open}</div></div>
    </div><div class="section-head"><h2>Recent trades</h2><button class="btn primary" id="newTrade">+ New trade</button></div>${tradeTable(state.trades.slice(0,8))}`;
  }

  function tradeTable(trades) {
    if (!trades.length) return `<div class="card empty">No trades yet. Create your first trading idea.</div>`;
    return `<div class="table-wrap"><table class="table"><thead><tr><th>Symbol</th><th>Direction</th><th>Status</th><th>Qty</th><th>Net P&L</th><th>Executions</th></tr></thead><tbody>${trades.map(t=>{const s=state.summaries[t.id]||{};const pnl=Number(s.net_realized_pnl||0);return `<tr><td><strong>${esc(t.symbol)}</strong></td><td>${esc(t.direction)}</td><td>${esc(s.status||'OPEN')}</td><td>${money(s.remaining_quantity||0)}</td><td class="${pnl>=0?'positive':'negative'}">₹${money(pnl)}</td><td>${s.execution_count||0}</td></tr>`}).join('')}</tbody></table></div>`;
  }

  function accountsView() { return `<div class="section-head"><h2>Trading accounts</h2><button class="btn primary" id="newAccount">+ Add account</button></div>${state.accounts.length ? `<div class="grid">${state.accounts.map(a=>`<div class="card"><strong>${esc(a.name)}</strong><div class="muted">${esc(a.broker||'Broker not set')} · ${esc(a.base_currency)}</div><div style="margin-top:12px" class="muted">${a.is_active?'Active':'Inactive'}</div></div>`).join('')}</div>` : `<div class="card empty">No trading accounts yet.</div>`}`; }

  function tradesView() { return `<div class="section-head"><h2>Trade log</h2><div class="toolbar"><button class="btn" id="refresh">Refresh</button><button class="btn primary" id="newTrade">+ New trade</button></div></div>${tradeTable(state.trades)}`; }

  function journalView() { return `<div class="section-head"><h2>Journal</h2><button class="btn primary" id="newJournal">+ New entry</button></div>${state.journal.length ? state.journal.map(e=>`<article class="card" style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;gap:12px"><strong>${esc(e.title||'Untitled entry')}</strong><span class="muted">${date(e.entry_at)}</span></div><p style="white-space:pre-wrap;line-height:1.6">${esc(e.content)}</p></article>`).join('') : `<div class="card empty">No journal entries yet.</div>`}`; }

  function modal(title, form) { const node=document.createElement('div'); node.innerHTML=`<div class="auth-page" style="position:fixed;inset:0;z-index:50;background:#000b"><section class="auth-card"><div class="section-head" style="margin:0 0 18px"><h2>${title}</h2><button class="btn" id="close">Close</button></div>${form}</section></div>`; document.body.appendChild(node.firstElementChild); return document.body.lastElementChild; }

  function bindForms() {
    const accountBtn=document.getElementById('newAccount'); if(accountBtn) accountBtn.onclick=()=>{
      const m=modal('Add trading account',`<form class="form" id="accountForm"><div class="field"><label>Account name</label><input name="name" required maxlength="100" placeholder="My trading account" /></div><div class="field"><label>Broker</label><input name="broker" maxlength="100" placeholder="Optional" /></div><div class="field"><label>Base currency</label><select name="base_currency"><option>INR</option><option>USD</option><option>EUR</option></select></div><div id="formError"></div><button class="btn primary">Create account</button></form>`); m.querySelector('#close').onclick=()=>m.remove(); m.querySelector('#accountForm').onsubmit=async e=>{e.preventDefault();try{await api('/accounts',json('POST',Object.fromEntries(new FormData(e.currentTarget).entries())));m.remove();await loadData();render()}catch(x){m.querySelector('#formError').innerHTML=`<div class="error">${esc(x.message)}</div>`}};
    };
    document.querySelectorAll('#newTrade').forEach(btn=>btn.onclick=()=>{
      if(!state.accounts.length){state.tab='accounts';render();return;}
      const options=state.accounts.filter(a=>a.is_active).map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');
      const m=modal('New trade',`<form class="form" id="tradeForm"><div class="form-row"><div class="field"><label>Symbol</label><input name="symbol" required placeholder="RELIANCE" /></div><div class="field"><label>Direction</label><select name="direction"><option value="long">Long</option><option value="short">Short</option></select></div></div><div class="field"><label>Trading account</label><select name="trading_account_id">${options}</select></div><div class="form-row"><div class="field"><label>Setup</label><input name="setup" placeholder="Optional" /></div><div class="field"><label>Strategy</label><input name="strategy" placeholder="Optional" /></div></div><div class="field"><label>Notes</label><textarea name="notes"></textarea></div><div id="formError"></div><button class="btn primary">Create trade</button></form>`); m.querySelector('#close').onclick=()=>m.remove();m.querySelector('#tradeForm').onsubmit=async e=>{e.preventDefault();try{const r=await api('/trades',json('POST',Object.fromEntries(new FormData(e.currentTarget).entries())));m.remove();await loadData();state.tab='trades';render();openExecution(r.trade)}catch(x){m.querySelector('#formError').innerHTML=`<div class="error">${esc(x.message)}</div>`}};
    });
    const journal=document.getElementById('newJournal');if(journal)journal.onclick=()=>{const m=modal('New journal entry',`<form class="form" id="journalForm"><div class="field"><label>Title</label><input name="title" maxlength="200" placeholder="What did I learn?" /></div><div class="field"><label>Entry</label><textarea name="content" required placeholder="Record the setup, execution, emotions and lesson..."></textarea></div><div class="field"><label>Date</label><input name="entry_at" type="datetime-local" required /></div><div id="formError"></div><button class="btn primary">Save entry</button></form>`);m.querySelector('#close').onclick=()=>m.remove();m.querySelector('[name=entry_at]').value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);m.querySelector('#journalForm').onsubmit=async e=>{e.preventDefault();const p=Object.fromEntries(new FormData(e.currentTarget).entries());p.entry_at=new Date(p.entry_at).toISOString();try{await api('/journal',json('POST',p));m.remove();await loadData();render()}catch(x){m.querySelector('#formError').innerHTML=`<div class="error">${esc(x.message)}</div>`}}};
    const refresh=document.getElementById('refresh');if(refresh)refresh.onclick=async()=>{refresh.disabled=true;await loadData();render()};
  }

  function openExecution(trade){
    const m=modal('Add execution',`<form class="form" id="execForm"><div class="form-row"><div class="field"><label>Side</label><select name="side"><option value="buy">Buy</option><option value="sell">Sell</option></select></div><div class="field"><label>Quantity</label><input name="quantity" type="number" min="0.000001" step="any" required /></div></div><div class="form-row"><div class="field"><label>Price</label><input name="price" type="number" min="0.00000001" step="any" required /></div><div class="field"><label>Total Charges</label><input name="total_charges" type="number" min="0" step="any" value="0" /></div></div><div class="field"><label>Executed at</label><input name="executed_at" type="datetime-local" required /></div><div class="field"><label>Notes</label><textarea name="notes"></textarea></div><div id="formError"></div><div class="toolbar"><button class="btn">Skip for now</button><button class="btn primary">Save execution</button></div></form>`);m.querySelector('#close').onclick=()=>m.remove();m.querySelector('[name=executed_at]').value=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);m.querySelector('#execForm').onsubmit=async e=>{e.preventDefault();const p=Object.fromEntries(new FormData(e.currentTarget).entries());p.executed_at=new Date(p.executed_at).toISOString();try{await api(`/trades/${trade.id}/executions`,json('POST',p));m.remove();await loadData();render()}catch(x){m.querySelector('#formError').innerHTML=`<div class="error">${esc(x.message)}</div>`}};
  }

  function render() {
    if (!state.user) return authView();
    let content=state.tab==='accounts'?accountsView():state.tab==='trades'?tradesView():state.tab==='journal'?journalView():dashboard();
    layout(content);bindForms();
  }
  boot();
})();
