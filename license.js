/* =====================================================================
   license.js — controle de acesso por código (sem banco de dados)
   - Cada aparelho tem um ID. Você gera um código para aquele ID no painel.
   - O código é assinado (ECDSA P-256). Aqui fica só a chave PÚBLICA:
     ela confere códigos, mas não consegue criar nenhum.
   ===================================================================== */
(function(){
"use strict";

/* ---------- CONFIGURAÇÃO (pode editar) ---------- */
var CFG = {
  // Seu WhatsApp com DDI+DDD (ex.: "5588999999999"). Vazio = esconde o botão.
  whatsapp: "5588996328842",
  // Nomes dos módulos
  modules: (function(){ var o={}; (window.FF_MODULOS||[]).forEach(function(m){ o[m.id]=m.nome; }); return o; })(),
  // Chave pública (NÃO é segredo)
  pub: {"kty":"EC","crv":"P-256","x":"L09CJ5-QFUQzgksQXTV7YVtDyPaGMknyH2GyfWk-PQc","y":"yQZ23yHNte2ISSEjCAqaRf57amqfgzfD5rBU1LrTgCw"}
};

var LS = { dev:"ff_dev", lic:"ff_lics", seen:"ff_seen" };
var ALPHA = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // sem 0/O/1/I/L

/* ---------- utilitários ---------- */
function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k,v); return true; }catch(e){ return false; } }
function b64uToBytes(s){
  s = s.replace(/-/g,"+").replace(/_/g,"/"); while(s.length%4) s+="=";
  var bin = atob(s), a = new Uint8Array(bin.length);
  for(var i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i);
  return a;
}
function bytesToStr(a){ return new TextDecoder().decode(a); }
function fmtId(id){ return id.slice(0,4)+"-"+id.slice(4); }
function normId(s){ return String(s||"").toUpperCase().replace(/[^A-Z0-9]/g,""); }
function ymd(ts){ var d=new Date(ts); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function brDate(s){ var p=s.split("-"); return p[2]+"/"+p[1]+"/"+p[0]; }
function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }

/* ---------- ID do aparelho ---------- */
var persisted = true;
function deviceId(){
  var id = normId(lsGet(LS.dev));
  if(id.length===8) return id;
  var r = new Uint8Array(8); (window.crypto||window.msCrypto).getRandomValues(r);
  id = ""; for(var i=0;i<8;i++) id += ALPHA[r[i]%ALPHA.length];
  persisted = lsSet(LS.dev,id);
  return id;
}

/* ---------- data de hoje (com proteção contra relógio voltado) ---------- */
function today(){
  var now = Date.now(), seen = parseInt(lsGet(LS.seen)||"0",10)||0;
  var use = now < seen - 86400000 ? seen : Math.max(now,seen);
  lsSet(LS.seen,String(use));
  return ymd(use);
}

/* ---------- verificação do código ---------- */
var keyPromise = null;
function pubKey(){
  if(!keyPromise) keyPromise = crypto.subtle.importKey("jwk",CFG.pub,{name:"ECDSA",namedCurve:"P-256"},false,["verify"]);
  return keyPromise;
}
// retorna {ok:true,p:payload} ou {ok:false,err:"..."}
async function parse(code){
  try{
    code = String(code||"").replace(/\s+/g,"");
    var m = /^FF1\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(code);
    if(!m) return {ok:false,err:"Código inválido. Copie o código completo."};
    var key = await pubKey();
    var good = await crypto.subtle.verify({name:"ECDSA",hash:"SHA-256"},key,b64uToBytes(m[2]),new TextEncoder().encode(m[1]));
    if(!good) return {ok:false,err:"Código inválido (assinatura não confere)."};
    var p = JSON.parse(bytesToStr(b64uToBytes(m[1])));
    if(!p||!p.d||!p.e||!p.m) return {ok:false,err:"Código inválido."};
    return {ok:true,p:p};
  }catch(e){ return {ok:false,err:"Não foi possível validar o código neste navegador."}; }
}
function allows(p,mod){ return p.m==="*" || (Array.isArray(p.m) && p.m.indexOf(mod)>=0); }

function stored(){ try{ var a=JSON.parse(lsGet(LS.lic)||"[]"); return Array.isArray(a)?a:[]; }catch(e){ return []; } }

// Situação de um módulo: {state:"ok"|"expired"|"none", exp:"YYYY-MM-DD"}
async function status(mod){
  var dev = deviceId(), td = today(), best = null, expired = null;
  var codes = stored();
  for(var i=0;i<codes.length;i++){
    var r = await parse(codes[i]);
    if(!r.ok || normId(r.p.d)!==dev || !allows(r.p,mod)) continue;
    if(r.p.e >= td){ if(!best || r.p.e>best) best = r.p.e; }
    else if(!expired || r.p.e>expired) expired = r.p.e;
  }
  if(best) return {state:"ok",exp:best};
  if(expired) return {state:"expired",exp:expired};
  return {state:"none"};
}

// Ativa um código digitado/colado. Retorna {ok,msg}
async function activate(code){
  if(!window.crypto||!crypto.subtle) return {ok:false,msg:"Este navegador não suporta a validação. Abra o app pelo endereço https."};
  var r = await parse(code);
  if(!r.ok) return {ok:false,msg:r.err};
  if(normId(r.p.d)!==deviceId()) return {ok:false,msg:"Este código foi gerado para outro aparelho. Envie o ID mostrado nesta tela para receber o código certo."};
  if(r.p.e < today()) return {ok:false,msg:"Este código expirou em "+brDate(r.p.e)+". Peça um novo código."};
  var list = stored(), c = String(code).replace(/\s+/g,"");
  if(list.indexOf(c)<0) list.push(c);
  if(!lsSet(LS.lic,JSON.stringify(list))) return {ok:false,msg:"Não foi possível salvar a ativação (navegador em modo privado?)."};
  var names = (r.p.m==="*"?Object.keys(CFG.modules):r.p.m).map(function(k){return CFG.modules[k]||k;}).join(" e ");
  return {ok:true,msg:"Acesso liberado a "+names+" até "+brDate(r.p.e)+"."};
}

/* ---------- código vindo por link (#ativar=...) ---------- */
async function fromHash(){
  var m = /[#&]ativar=([^&]+)/.exec(location.hash||"");
  if(!m) return null;
  var res = await activate(decodeURIComponent(m[1]));
  try{ history.replaceState(null,"",location.pathname+location.search); }catch(e){}
  return res;
}

/* ---------- tela de bloqueio ---------- */
var CSS = ".ffl{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:18px;overflow:auto;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:linear-gradient(160deg,#0f766e,#134e4a 60%,#0b1220);color:#0f172a}"
+".ffl *{box-sizing:border-box}"
+".ffl-card{width:100%;max-width:440px;background:#fff;border-radius:24px;padding:22px;box-shadow:0 20px 50px rgba(0,0,0,.35)}"
+".ffl h1{font-size:21px;margin:6px 0 4px}.ffl p{margin:6px 0;color:#475569;font-size:14.5px;line-height:1.45}"
+".ffl-ic{width:54px;height:54px;border-radius:16px;background:#ccfbf1;display:grid;place-items:center;font-size:28px}"
+".ffl-id{margin:12px 0;background:#f1f5f9;border:2px dashed #94a3b8;border-radius:16px;padding:12px;text-align:center}"
+".ffl-id small{display:block;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#64748b}"
+".ffl-id b{display:block;font-size:30px;letter-spacing:.12em;font-family:ui-monospace,Menlo,monospace;color:#0f766e;margin:2px 0 6px}"
+".ffl button,.ffl a.b{font:inherit;cursor:pointer;border:0;border-radius:13px;padding:12px 14px;font-weight:800;font-size:15px;width:100%;margin-top:8px;display:block;text-align:center;text-decoration:none}"
+".ffl .pri{background:#0f766e;color:#fff}.ffl .sec{background:#f1f5f9;color:#0f172a;border:1px solid #e2e8f0}.ffl .wa{background:#16a34a;color:#fff}"
+".ffl textarea{width:100%;min-height:82px;border:2px solid #e2e8f0;border-radius:13px;padding:11px;font:inherit;font-size:13px;font-family:ui-monospace,Menlo,monospace;resize:vertical;outline:none;margin-top:6px}"
+".ffl textarea:focus{border-color:#0f766e}"
+".ffl-msg{margin-top:8px;font-size:13.5px;font-weight:700;border-radius:11px;padding:9px 11px}"
+".ffl-msg.err{background:#ffe4e6;color:#be123c}.ffl-msg.ok{background:#d1fae5;color:#047857}"
+".ffl-warn{background:#fef3c7;color:#92400e;border-radius:11px;padding:9px 11px;font-size:13px;font-weight:600;margin-top:8px}"
+".ffl-step{font-size:12.5px;color:#64748b;margin-top:12px;border-top:1px solid #e2e8f0;padding-top:10px}";

function addCss(){
  if(document.getElementById("ffl-css")) return;
  var s=document.createElement("style"); s.id="ffl-css"; s.textContent=CSS; document.head.appendChild(s);
}
function waLink(mod){
  if(!CFG.whatsapp) return "";
  var msg = "Olá! Quero liberar o acesso"+(mod?" ao "+(CFG.modules[mod]||mod):"")+". Meu ID: "+fmtId(deviceId());
  return "https://wa.me/"+CFG.whatsapp+"?text="+encodeURIComponent(msg);
}
function copy(text,btn){
  var done=function(){ var o=btn.textContent; btn.textContent="✓ Copiado!"; setTimeout(function(){btn.textContent=o;},1600); };
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done,function(){ fallback(); });
  else fallback();
  function fallback(){ var t=document.createElement("textarea"); t.value=text; document.body.appendChild(t); t.select(); try{document.execCommand("copy");done();}catch(e){} document.body.removeChild(t); }
}

function lockScreen(mod,st,onOk,notice){
  addCss();
  var old=document.getElementById("ffl"); if(old) old.remove();
  var id=fmtId(deviceId()), name=CFG.modules[mod]||mod;
  var title = st.state==="expired" ? "Seu acesso expirou" : "Acesso restrito";
  var sub = st.state==="expired"
    ? "O acesso ao <b>"+esc(name)+"</b> terminou em <b>"+brDate(st.exp)+"</b>. Para continuar, ative novamente: envie o ID abaixo e cole o novo código."
    : "Para usar o <b>"+esc(name)+"</b>, envie o ID abaixo para quem administra o app e cole aqui o código de liberação que você receber.";
  var wa = waLink(mod);
  var el=document.createElement("div"); el.id="ffl"; el.className="ffl";
  el.innerHTML='<div class="ffl-card"><div class="ffl-ic">'+(st.state==="expired"?"⏰":"🔒")+'</div><h1>'+title+'</h1><p>'+sub+'</p>'
   +'<div class="ffl-id"><small>Seu ID de acesso</small><b>'+id+'</b><button class="sec" id="ffl-copyid" style="margin:0;padding:8px">Copiar ID</button></div>'
   +(wa?'<a class="b wa" href="'+wa+'" target="_blank" rel="noopener">💬 Pedir liberação no WhatsApp</a>':"")
   +(persisted?"":'<div class="ffl-warn">⚠️ Este navegador não está guardando dados (modo privado?). O ID pode mudar. Use uma aba normal.</div>')
   +'<div class="ffl-step"><b>Já tem o código?</b> Cole abaixo:</div>'
   +'<textarea id="ffl-code" placeholder="FF1.xxxxx.yyyyy" spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>'
   +'<button class="pri" id="ffl-go">Ativar acesso</button>'
   +'<div class="ffl-msg '+(notice&&notice.ok?"ok":"err")+'" id="ffl-msg" '+(notice?"":'style="display:none"')+'>'+(notice?esc(notice.msg):"")+'</div>'
   +'<a class="b sec" href="'+(mod==="hub"?"#":"../index.html")+'" id="ffl-back" style="'+(mod==="hub"?"display:none":"")+'">← Voltar ao portal</a></div>';
  document.body.appendChild(el);
  document.getElementById("ffl-copyid").onclick=function(){ copy(id,this); };
  document.getElementById("ffl-go").onclick=async function(){
    var msg=document.getElementById("ffl-msg"); var v=document.getElementById("ffl-code").value;
    if(!v.trim()){ msg.className="ffl-msg err"; msg.style.display="block"; msg.textContent="Cole o código recebido."; return; }
    var r=await activate(v);
    msg.style.display="block"; msg.className="ffl-msg "+(r.ok?"ok":"err"); msg.textContent=r.msg;
    if(r.ok){ var s=await status(mod); if(s.state==="ok"){ setTimeout(function(){ el.remove(); onOk(); },900); } else { msg.className="ffl-msg err"; msg.textContent="Esse código não libera o "+name+". Peça um código que inclua este módulo."; } }
  };
}

/* ---------- API pública ---------- */
async function gate(mod,onOk){
  if(!window.crypto||!crypto.subtle){
    addCss(); var e=document.createElement("div"); e.className="ffl";
    e.innerHTML='<div class="ffl-card"><div class="ffl-ic">⚠️</div><h1>Navegador sem suporte</h1><p>Abra este app pelo endereço <b>https</b> (o link do site) em um navegador atualizado, como o Chrome.</p></div>';
    document.body.appendChild(e); return;
  }
  var notice = await fromHash();
  var st = await status(mod);
  if(st.state==="ok"){ onOk(); return; }
  lockScreen(mod,st,onOk,notice);
}

// Link de ativação aberto com a página já aberta (só muda o #): recarrega para processar
window.addEventListener("hashchange",function(){ if(/[#&]ativar=/.test(location.hash||"")) location.reload(); });

window.FFLicense = {
  gate:gate, status:status, activate:activate, fromHash:fromHash,
  deviceId:function(){ return fmtId(deviceId()); },
  modules:CFG.modules, brDate:brDate, copy:copy, waLink:waLink, isPersisted:function(){ deviceId(); return persisted; }
};
})();
