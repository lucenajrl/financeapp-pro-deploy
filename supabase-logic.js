// FinanceApp Pro — Supabase Logic
const { createClient } = supabase;

let _currentUser = null;
let _isSyncing = false;

// ── AUTH ──
async function initAuth() {
    try {
        const { data: { session } } = await _supabase.auth.getSession();
        if (session?.user) {
            _currentUser = session.user;
            await loadUserData();
            showApp();
        } else {
            _currentUser = null;
            localStorage.clear();
            showAuth();
        }
    } catch(err) {
        console.error('Erro auth:', err);
        showAuth();
    }

    _supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
            _currentUser = session.user;
            localStorage.clear();
            await loadUserData();
            showApp();
        } else if (event === 'SIGNED_OUT') {
            _currentUser = null;
            localStorage.clear();
            showAuth();
        }
    });
}

function showAuth() {
    const s = document.getElementById('authScreen');
    if (s) s.classList.remove('hide');
}

function showApp() {
    const s = document.getElementById('authScreen');
    if (s) s.classList.add('hide');
    CF.nome = _currentUser.user_metadata?.nome || _currentUser.email;
    updUser();
    setTimeout(() => {
        checkAdmin();
        if (typeof checkAdminUI === 'function') checkAdminUI();
    }, 150);
    initTrialTimer();
    go('dashboard');
    setTimeout(() => {
        if (typeof rDash === 'function') rDash();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }, 350);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && typeof rDash === 'function') setTimeout(rDash, 150);
    }, { once: true });
    toast('Bem-vindo de volta! 👋');
}

// ── FUNÇÕES DE AUTH ──
async function authLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPass').value;
    if (!email || !password) { authShowErr('Preencha todos os campos.'); return; }
    const { error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) authShowErr('E-mail ou senha incorretos.');
}

async function authCadastro() {
    const nome = document.getElementById('cadNome').value.trim();
    const email = document.getElementById('cadEmail').value.trim();
    const password = document.getElementById('cadPass').value;
    const pass2 = document.getElementById('cadPass2').value;
    if (!nome || !email || !password) { authShowErr('Preencha todos os campos.'); return; }
    if (password !== pass2) { authShowErr('As senhas não coincidem.'); return; }
    const { error } = await _supabase.auth.signUp({
        email, password,
        options: { data: { nome } }
    });
    if (error) authShowErr('Erro: ' + error.message);
    else { toast('Cadastro realizado! Faça login para entrar.'); authToggle('login'); }
}

async function authSair() {
    if (!confirm('Deseja sair da sua conta?')) return;
    localStorage.clear();
    sessionStorage.clear();
    V = []; M = []; C = []; P = []; CF = {};
    _currentUser = null;
    await _supabase.auth.signOut();
    location.reload();
}

// ── DADOS ──
async function saveUserData() {
    if (!_currentUser || _isSyncing) return;
    _isSyncing = true;
    const { error } = await _supabase.from('user_data').upsert({
        user_id: _currentUser.id,
        vendas: V, movimentacoes: M, clientes: C, produtos: P, config: CF,
        updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
    if (error) console.error('Erro ao salvar:', error);
    _isSyncing = false;
}

async function loadUserData() {
    if (!_currentUser) return;
    const { data } = await _supabase.from('user_data').select('*').eq('user_id', _currentUser.id).single();
    if (data) {
        V = data.vendas || [];
        M = data.movimentacoes || [];
        C = data.clientes || [];
        P = data.produtos || [];
        Object.assign(CF, data.config || {});
        updUser();
        if (typeof rDash === 'function') setTimeout(rDash, 100);
    } else {
        V = []; M = []; C = []; P = []; CF = {};
        await _supabase.from('user_data').insert({
            user_id: _currentUser.id,
            vendas: [], movimentacoes: [], clientes: [], produtos: [], config: {}
        });
    }
}

// Interceptar saves locais para sincronizar com Supabase
const _origSave = S.s.bind(S);
S.s = function(key, val) {
    _origSave(key, val);
    if (key === 'fa_v') V = val;
    if (key === 'fa_m') M = val;
    if (key === 'fa_c') C = val;
    if (key === 'fa_p') P = val;
    if (key === 'fa_cf') Object.assign(CF, val);
    saveUserData();
};

// Auto-save a cada 2 minutos
setInterval(saveUserData, 2 * 60 * 1000);
window.addEventListener('beforeunload', saveUserData);

// ── PAINEL ADM ──
function checkAdmin() {
    const adminEmail = 'jardsonlucena97@gmail.com';
    const btn = document.getElementById('adminBtn');
    if (_currentUser?.email === adminEmail) {
        if (btn) { btn.style.display = 'flex'; btn.style.visibility = 'visible'; btn.style.opacity = '1'; }
    } else {
        if (btn) btn.style.display = 'none';
    }
}

// ── TRIAL ──
const ADMIN_EMAIL = 'jardsonlucena97@gmail.com';
const TRIAL_DURATION_MS = 30 * 60 * 1000;
let _trialStartTime = null;

function initTrialTimer() {
    if (_currentUser?.email === ADMIN_EMAIL) return;
    const key = `trial_start_${_currentUser.id}`;
    const saved = localStorage.getItem(key);
    _trialStartTime = saved ? parseInt(saved) : Date.now();
    if (!saved) localStorage.setItem(key, _trialStartTime.toString());
    setInterval(checkTrialExpiration, 5000);
}

function checkTrialExpiration() {
    if (!_currentUser || _currentUser.email === ADMIN_EMAIL) return;
    if (Date.now() - _trialStartTime >= TRIAL_DURATION_MS) showPaymentScreen();
}

function showPaymentScreen() {
    const main = document.querySelector('main');
    if (main) main.style.display = 'none';
    const div = document.createElement('div');
    div.id = 'paymentScreen';
    div.style.cssText = 'position:fixed;inset:0;background:linear-gradient(135deg,rgba(59,130,246,.15),rgba(139,92,246,.1));display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;font-family:Inter,sans-serif;';
    div.innerHTML = `<div style="background:#0D1526;border:1px solid rgba(59,130,246,.3);border-radius:20px;padding:40px;max-width:500px;width:100%;text-align:center;box-shadow:0 24px 80px rgba(0,0,0,.6)">
      <div style="font-size:48px;margin-bottom:20px">⏱️</div>
      <h2 style="font-family:Syne,sans-serif;font-size:24px;font-weight:800;color:#F1F5F9;margin-bottom:12px">Período de Degustação Expirado</h2>
      <p style="color:#94A3B8;font-size:14px;margin-bottom:28px;line-height:1.6">Você utilizou 30 minutos de acesso gratuito. Para continuar, entre em contato para assinar.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <button onclick="window.open('mailto:financeapp.pro.app@gmail.com','_blank')" style="padding:12px;border-radius:10px;border:none;background:rgba(59,130,246,.15);color:#3B82F6;font-weight:600;cursor:pointer;font-size:13px">📧 Contato</button>
        <button onclick="authSair()" style="padding:12px;border-radius:10px;border:1px solid #EF4444;background:transparent;color:#EF4444;font-weight:600;cursor:pointer;font-size:13px">Sair</button>
      </div>
    </div>`;
    document.body.appendChild(div);
}

// Inicializar
window.addEventListener('load', () => { initAuth(); });
