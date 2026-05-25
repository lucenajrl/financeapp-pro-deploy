// FinanceApp Pro — Supabase Logic (Ultra-Resilient Version)
const { createClient } = supabase;

let _currentUser = null;
let _isSyncing = false;

// ── AUXILIARES SEGUROS ──
const safeCall = (fnName, ...args) => {
    try {
        if (typeof window[fnName] === 'function') return window[fnName](...args);
    } catch (e) { console.warn(`Erro ao chamar ${fnName}:`, e); }
};

const safeToast = (msg, type) => safeCall('toast', msg, type);

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
            showAuth();
        }
    } catch(err) {
        console.error('Erro initAuth:', err);
        showAuth();
    }

    _supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
            _currentUser = session.user;
            await loadUserData();
            showApp();
        } else if (event === 'SIGNED_OUT') {
            _currentUser = null;
            showAuth();
        }
    });
}

function showAuth() {
    const s = document.getElementById('authScreen');
    if (s) {
        s.classList.remove('hide');
        s.style.display = 'flex';
        s.style.zIndex = '9999';
    }
}

function showApp() {
    const s = document.getElementById('authScreen');
    if (s) {
        s.classList.add('hide');
        s.style.display = 'none';
    }
    
    // Configurar usuário global
    if (_currentUser && typeof CF !== 'undefined') {
        CF.nome = _currentUser.user_metadata?.nome || _currentUser.email;
    }
    
    // Inicializar UI do app original
    safeCall('updUser');
    safeCall('updDashAvatar');
    safeCall('go', 'dashboard');
    
    setTimeout(() => {
        safeCall('checkAdminUI');
        safeCall('rDash');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }, 300);
    
    safeToast('Bem-vindo de volta! 👋');
    initTrialTimer();
}

// ── FUNÇÕES DE AUTH (EXPORTADAS PARA O WINDOW) ──
async function authLogin() {
    const email = document.getElementById('loginEmail')?.value.trim();
    const password = document.getElementById('loginPass')?.value;
    if (!email || !password) { safeCall('authShowErr', 'Preencha todos os campos.'); return; }
    
    const btn = document.querySelector('#viewLogin .auth-btn') || document.querySelector('#authScreen button');
    const originalText = btn ? btn.textContent : 'Entrar';
    if (btn) btn.textContent = 'Entrando...';
    
    try {
        const { error } = await _supabase.auth.signInWithPassword({ email, password });
        if (error) {
            safeCall('authShowErr', 'E-mail ou senha incorretos.');
            if (btn) btn.textContent = originalText;
        }
    } catch (e) {
        safeCall('authShowErr', 'Erro ao conectar ao servidor.');
        if (btn) btn.textContent = originalText;
    }
}

async function authCadastro() {
    const nome = document.getElementById('cadNome')?.value.trim();
    const email = document.getElementById('cadEmail')?.value.trim();
    const password = document.getElementById('cadPass')?.value;
    const pass2 = document.getElementById('cadPass2')?.value;
    
    if (!nome || !email || !password) { safeCall('authShowErr', 'Preencha todos os campos.'); return; }
    if (password !== pass2) { safeCall('authShowErr', 'As senhas não coincidem.'); return; }
    
    const btn = document.querySelector('#viewCadastro .auth-btn');
    if (btn) btn.textContent = 'Criando conta...';
    
    try {
        const { error } = await _supabase.auth.signUp({
            email, password,
            options: { data: { nome } }
        });
        
        if (error) {
            safeCall('authShowErr', 'Erro: ' + error.message);
            if (btn) btn.textContent = 'Cadastrar';
        } else {
            safeToast('Cadastro realizado! Faça login.');
            safeCall('authToggle', 'login');
        }
    } catch (e) {
        safeCall('authShowErr', 'Erro ao processar cadastro.');
        if (btn) btn.textContent = 'Cadastrar';
    }
}

async function authSair() {
    if (!confirm('Deseja sair da sua conta?')) return;
    try {
        localStorage.clear();
        sessionStorage.clear();
        await _supabase.auth.signOut();
        location.reload();
    } catch (e) { location.reload(); }
}

// ── DADOS ──
async function saveUserData() {
    if (!_currentUser || _isSyncing) return;
    _isSyncing = true;
    try {
        // Obter variáveis globais com fallback
        const data = {
            user_id: _currentUser.id,
            vendas: typeof V !== 'undefined' ? V : [],
            movimentacoes: typeof M !== 'undefined' ? M : [],
            clientes: typeof C !== 'undefined' ? C : [],
            produtos: typeof P !== 'undefined' ? P : [],
            config: typeof CF !== 'undefined' ? CF : {},
            updated_at: new Date().toISOString()
        };
        
        const { error } = await _supabase.from('user_data').upsert(data, { onConflict: 'user_id' });
        if (error) console.error('Erro ao sincronizar:', error);
    } catch (e) { console.error('Exception saveUserData:', e); }
    _isSyncing = false;
}

async function loadUserData() {
    if (!_currentUser) return;
    try {
        const { data, error } = await _supabase.from('user_data').select('*').eq('user_id', _currentUser.id).single();
        if (data) {
            if (typeof V !== 'undefined') window.V = data.vendas || [];
            if (typeof M !== 'undefined') window.M = data.movimentacoes || [];
            if (typeof C !== 'undefined') window.C = data.clientes || [];
            if (typeof P !== 'undefined') window.P = data.produtos || [];
            if (typeof CF !== 'undefined') Object.assign(window.CF, data.config || {});
            
            safeCall('updUser');
            setTimeout(() => safeCall('rDash'), 100);
        }
    } catch (e) { console.error('Erro loadUserData:', e); }
}

// Interceptar saves locais para sincronizar com Supabase
function hookStorage() {
    if (typeof S !== 'undefined' && S.s) {
        const _origS = S.s.bind(S);
        S.s = function(k, v) {
            _origS(k, v);
            saveUserData();
        };
    }
    if (typeof S !== 'undefined' && S.so) {
        const _origSo = S.so.bind(S);
        S.so = function(k, v) {
            _origSo(k, v);
            saveUserData();
        };
    }
}

// ── TRIAL ──
const ADMIN_EMAIL = 'jardsonlucena97@gmail.com';
const TRIAL_DURATION_MS = 30 * 60 * 1000;

function initTrialTimer() {
    if (!_currentUser || _currentUser.email === ADMIN_EMAIL) return;
    const key = `trial_start_${_currentUser.id}`;
    const saved = localStorage.getItem(key);
    const start = saved ? parseInt(saved) : Date.now();
    if (!saved) localStorage.setItem(key, start.toString());
    
    setInterval(() => {
        if (Date.now() - start >= TRIAL_DURATION_MS) {
            if (!document.getElementById('paymentScreen')) {
                document.body.innerHTML = `<div id="paymentScreen" style="position:fixed;inset:0;background:#060C18;display:flex;align-items:center;justify-content:center;z-index:99999;color:#fff;font-family:sans-serif;text-align:center;padding:20px;">
                    <div>
                        <h2 style="font-size:24px;margin-bottom:10px;">Degustação Expirada ⏱️</h2>
                        <p style="color:#94A3B8;margin-bottom:20px;">Seu tempo de teste de 30 minutos acabou.</p>
                        <button onclick="location.reload()" style="padding:10px 20px;background:#3B82F6;border:none;border-radius:8px;color:#fff;font-weight:bold;cursor:pointer;">Voltar</button>
                    </div>
                </div>`;
            }
        }
    }, 10000);
}

// ── BOOTSTRAP ──
window.addEventListener('load', () => {
    // Sobrescrever funções globais para usar as versões do Supabase
    window.authLogin = authLogin;
    window.authCadastro = authCadastro;
    window.authSair = authSair;
    
    hookStorage();
    initAuth();
});

// Auto-save periódico
setInterval(saveUserData, 60000);
window.addEventListener('beforeunload', saveUserData);
