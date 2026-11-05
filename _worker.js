const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' }
});
const normalizeDigits = s => String(s).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776)).replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632));
const subjects = { consult:'درخواست مشاوره',visit:'رزرو وقت',family:'مشاوره خانواده',other:'سایر' };
export default {
 async fetch(request, env) {
   const url = new URL(request.url);
   if (url.pathname.startsWith('/api/account/')) return accountApi(request,env,url);
   if (url.pathname.startsWith('/api/admin/')) return adminApi(request,env,url);
   if (url.pathname === '/admin.html') {
     const response=await env.ASSETS.fetch(request);
     const headers=new Headers(response.headers);
     headers.set('Cache-Control','no-store');
     headers.set('X-Robots-Tag','noindex, nofollow');
     headers.set('X-Frame-Options','DENY');
     return new Response(response.body,{status:response.status,headers});
   }
   if (url.pathname === '/api/appointments/track') return trackAppointment(request,env);
   if (url.pathname === '/api/appointments/slots') return appointmentSlots(request,env);
   if (url.pathname === '/api/appointments') return createAppointment(request,env);
   if (url.pathname !== '/api/contact') return env.ASSETS.fetch(request);
   if (request.method !== 'POST') return json({ok:false,message:'روش درخواست معتبر نیست.'},405);
   if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return json({ok:false,message:'فرمت درخواست نامعتبر است.'},415);
   if (Number(request.headers.get('content-length') || '0') > 12000) return json({ok:false,message:'متن درخواست بیش از حد طولانی است.'},413);
   let data;
   try { data = await request.json(); } catch {return json({ok:false,message:'اطلاعات فرم قابل خواندن نیست.'},400);}
   if (!data || typeof data !== 'object' || Array.isArray(data)) return json({ok:false,message:'داده معتبر نیست.'},400);
   if (data.website) return json({ok:true}); // honeypot
   const name=String(data.name||'').trim(),phone=normalizeDigits(data.phone||'').trim(),subject=String(data.subject||''),message=String(data.message||'').trim();
   if (name.length<3 || name.length>120 || !/^\+?[0-9]{10,13}$/.test(phone) || !subjects[subject] || message.length<10 || message.length>1500) return json({ok:false,message:'لطفاً اطلاعات فرم را به‌درستی وارد کنید.'},400);
   if (!env.RESEND_API_KEY || !env.CONTACT_TO_EMAIL) return json({ok:false,message:'فرم هنوز توسط مدیر سایت فعال نشده است. لطفاً تلفنی تماس بگیرید.'},503);
   const body=['درخواست جدید تماس از سایت پنجره روشنایی',`نام: ${name}`,`شماره تماس: ${phone}`,`موضوع: ${subjects[subject]}`,`پیام: ${message}`].join('\n');
   try {
     const result = await fetch('https://api.resend.com/emails', {
       method:'POST', headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},
       body:JSON.stringify({from:env.CONTACT_FROM_EMAIL || 'پنجره روشنایی <onboarding@resend.dev>',to:[env.CONTACT_TO_EMAIL],subject:`پنجره روشنایی | ${subjects[subject]}`,text:body})
     });
     if (!result.ok) { console.error('Resend rejected request',result.status);return json({ok:false,message:'ارسال انجام نشد. لطفاً با کلینیک تماس بگیرید.'},502); }
     return json({ok:true});
   } catch(e) {console.error('Mail service unavailable');return json({ok:false,message:'ارتباط با سرویس ارسال برقرار نشد؛ لطفاً تلفنی تماس بگیرید.'},502);}
 }
};

const HOURS=['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00'];
function nowTehran(){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
 return {date:p.year+'-'+p.month+'-'+p.day,hour:Number(p.hour)};
}
function validDate(date){
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
 const d=new Date(date+'T00:00:00Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date||d.getUTCDay()===5)return false;
 const today=nowTehran().date,days=(d.getTime()-new Date(today+'T00:00:00Z').getTime())/86400000;
 return days>=0&&days<=60;
}
function futureSlot(date,time){const n=nowTehran();return date>n.date||(date===n.date&&Number(time.slice(0,2))>n.hour);}
async function appointmentSlots(request,env){
 if(request.method!=='GET')return json({ok:false,message:'روش درخواست معتبر نیست.'},405);
 if(!env.DB)return json({ok:false,message:'سامانه نوبت‌دهی هنوز فعال نشده است.'},503);
 const date=new URL(request.url).searchParams.get('date');
 if(!validDate(date))return json({ok:false,message:'تاریخ معتبر در ۶۰ روز آینده، به‌جز جمعه، انتخاب کنید.'},400);
 try{
  const r=await env.DB.prepare("SELECT appointment_time FROM appointments WHERE appointment_date=? AND status IN ('pending','confirmed')").bind(date).all();
  const used=new Set((r.results||[]).map(x=>x.appointment_time));
  return json({ok:true,available:HOURS.filter(t=>!used.has(t)&&futureSlot(date,t))});
 }catch(e){console.error('slots query failed');return json({ok:false,message:'بررسی ساعت‌ها ممکن نشد.'},500);}
}
async function createAppointment(request,env){
 if(request.method!=='POST')return json({ok:false,message:'روش درخواست معتبر نیست.'},405);
 if(!env.DB)return json({ok:false,message:'سامانه نوبت‌دهی هنوز فعال نشده است.'},503);
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return json({ok:false,message:'مبدأ درخواست مجاز نیست.'},403);
 if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return json({ok:false,message:'فرمت درخواست معتبر نیست.'},415);
 if(Number(request.headers.get('content-length')||'0')>3000)return json({ok:false,message:'درخواست طولانی است.'},413);
 let d;try{d=await request.json();}catch{return json({ok:false,message:'داده‌ها قابل خواندن نیستند.'},400);}
 if(!d||typeof d!=='object'||Array.isArray(d))return json({ok:false,message:'داده نامعتبر است.'},400);
 if(d.website)return json({ok:true,reference:'DEMO'});
 const fullName=String(d.fullName||'').trim(),phone=normalizeDigits(d.phone||'').trim(),date=d.date,time=d.time;
 if(fullName.length<3||fullName.length>100||!/^09[0-9]{9}$/.test(phone)||!validDate(date)||!HOURS.includes(time)||!futureSlot(date,time))
 return json({ok:false,message:'نام، موبایل، تاریخ یا ساعت معتبر نیست.'},400);
 try{
  const hasAccountCookie=/(?:^|;\s*)__Host-pr_user=/.test(request.headers.get('cookie')||'');
  let user=null;
  if(hasAccountCookie){
   user=await userSession(request,env.DB);
   if(!user)return json({ok:false,message:'نشست حساب کاربری منقضی شده است. دوباره وارد شوید.'},401);
   if(phone!==user.phone||fullName!==user.full_name)
    return json({ok:false,message:'نام و شماره موبایل باید با حساب کاربری شما مطابقت داشته باشند.'},400);
  }
  const id=crypto.randomUUID();
  if(user){
   await env.DB.prepare('INSERT INTO appointments(id,appointment_date,appointment_time,full_name,phone,user_id) VALUES(?,?,?,?,?,?)')
    .bind(id,date,time,fullName,phone,user.id).run();
  }else{
   await env.DB.prepare('INSERT INTO appointments(id,appointment_date,appointment_time,full_name,phone) VALUES(?,?,?,?,?)')
    .bind(id,date,time,fullName,phone).run();
  }
  return json({ok:true,reference:id.slice(0,8).toUpperCase()},201);
 }catch(e){
  if(/UNIQUE constraint failed/i.test(String(e)))return json({ok:false,message:'این ساعت قبلاً رزرو شده است؛ ساعت دیگری انتخاب کنید.'},409);
  console.error('appointment insert failed');return json({ok:false,message:'خطای ثبت درخواست؛ لطفاً تلفنی تماس بگیرید.'},500);
 }
}


// Admin API: password is a Cloudflare secret, never stored in source control.
// Sessions are random, revocable and stored only as SHA-256 hashes in D1.
const ADMIN_COOKIE='__Host-pr_admin';
const ADMIN_TTL=8*60*60;
const adminJson=(data,status=200,extra={})=>new Response(JSON.stringify(data),{
 status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',...extra}
});
const adminCookie=(token,maxAge)=>ADMIN_COOKIE+'='+token+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+maxAge;
async function sha256(value){
 const bytes=new TextEncoder().encode(value);
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function secureEqual(a,b){
 const x=new TextEncoder().encode(a),y=new TextEncoder().encode(b);
 let diff=x.length^y.length;
 for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]||0)^(y[i]||0);
 return diff===0;
}
function adminToken(){
 const bytes=crypto.getRandomValues(new Uint8Array(32));
 return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
async function ensureAdminTables(db){
 await db.prepare('CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL)').run();
 await db.prepare('CREATE TABLE IF NOT EXISTS admin_login_attempts (ip_hash TEXT PRIMARY KEY, failures INTEGER NOT NULL, window_start INTEGER NOT NULL, blocked_until INTEGER NOT NULL DEFAULT 0)').run();
}
async function adminSession(request,db){
 const cookie=request.headers.get('cookie')||'';
 const match=cookie.match(/(?:^|;\s*)__Host-pr_admin=([A-Za-z0-9_-]{43})(?:;|$)/);
 if(!match)return null;
 const tokenHash=await sha256(match[1]);
 const session=await db.prepare('SELECT expires_at FROM admin_sessions WHERE token_hash=?').bind(tokenHash).first();
 return session&&Number(session.expires_at)>Math.floor(Date.now()/1000)?tokenHash:null;
}
async function adminLogin(request,env){
 if(!env.ADMIN_PASSWORD||String(env.ADMIN_PASSWORD).length<16)
  return adminJson({ok:false,message:'رمز مدیر هنوز در تنظیمات امن Cloudflare تعریف نشده است (حداقل ۱۶ نویسه).'},503);
 if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')
  return adminJson({ok:false,message:'فرمت درخواست نامعتبر است.'},415);
 if(Number(request.headers.get('content-length')||0)>2048)
  return adminJson({ok:false,message:'درخواست بیش از حد طولانی است.'},413);
 let body;
 try{body=await request.json();}catch{return adminJson({ok:false,message:'درخواست نامعتبر است.'},400);}
 if(!body||typeof body.password!=='string'||body.password.length>256)
  return adminJson({ok:false,message:'رمز عبور معتبر نیست.'},400);
 await ensureAdminTables(env.DB);
 const now=Math.floor(Date.now()/1000);
 const ipHash=await sha256(request.headers.get('CF-Connecting-IP')||'unknown');
 const row=await env.DB.prepare('SELECT failures,window_start,blocked_until FROM admin_login_attempts WHERE ip_hash=?').bind(ipHash).first();
 if(row&&Number(row.blocked_until)>now)
  return adminJson({ok:false,message:'تلاش‌های ورود زیاد بوده است. ۱۵ دقیقه دیگر دوباره امتحان کنید.'},429,{'Retry-After':String(Number(row.blocked_until)-now)});
 const correct=secureEqual(await sha256(body.password),await sha256(String(env.ADMIN_PASSWORD)));
 if(!correct){
  const failures=row&&Number(row.window_start)>now-900?Number(row.failures)+1:1;
  const start=row&&Number(row.window_start)>now-900?Number(row.window_start):now;
  const blocked=failures>=5?now+900:0;
  await env.DB.prepare('INSERT INTO admin_login_attempts(ip_hash,failures,window_start,blocked_until) VALUES(?,?,?,?) ON CONFLICT(ip_hash) DO UPDATE SET failures=excluded.failures,window_start=excluded.window_start,blocked_until=excluded.blocked_until')
   .bind(ipHash,failures,start,blocked).run();
  return adminJson({ok:false,message:'رمز عبور اشتباه است.'},401);
 }
 await env.DB.prepare('DELETE FROM admin_login_attempts WHERE ip_hash=?').bind(ipHash).run();
 const token=adminToken();
 await env.DB.prepare('INSERT INTO admin_sessions(token_hash,expires_at) VALUES(?,?)').bind(await sha256(token),now+ADMIN_TTL).run();
 return adminJson({ok:true},200,{'Set-Cookie':adminCookie(token,ADMIN_TTL)});
}
async function adminApi(request,env,url){
 if(!env.DB)return adminJson({ok:false,message:'دیتابیس در دسترس نیست.'},503);
 const path=url.pathname;
 if(['POST','PATCH','PUT','DELETE'].includes(request.method)){
  if(request.headers.get('origin')!==url.origin||request.headers.get('x-requested-with')!=='XMLHttpRequest')
   return adminJson({ok:false,message:'درخواست از مبدأ مجاز نیست.'},403);
 }
 try{
  if(path==='/api/admin/login'){
   if(request.method!=='POST')return adminJson({ok:false},405);
   return await adminLogin(request,env);
  }
  const session=await adminSession(request,env.DB);
  if(!session)return adminJson({ok:false,message:'برای ادامه وارد حساب مدیر شوید.'},401);
  if(path==='/api/admin/session'){
   return request.method==='GET'?adminJson({ok:true}):adminJson({ok:false},405);
  }
  if(path==='/api/admin/logout'){
   if(request.method!=='POST')return adminJson({ok:false},405);
   await env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(session).run();
   return adminJson({ok:true},200,{'Set-Cookie':adminCookie('',0)});
  }
  if(path==='/api/admin/appointments'){
   if(request.method!=='GET')return adminJson({ok:false},405);
   const date=url.searchParams.get('date')||'';
   const status=url.searchParams.get('status')||'';
   if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))return adminJson({ok:false,message:'تاریخ نامعتبر است.'},400);
   if(status&&!['pending','confirmed','cancelled'].includes(status))return adminJson({ok:false,message:'وضعیت نامعتبر است.'},400);
   const conditions=[],params=[];
   if(date){conditions.push('appointment_date=?');params.push(date);}
   if(status){conditions.push('status=?');params.push(status);}
   const sql='SELECT id,appointment_date,appointment_time,full_name,phone,created_at,status FROM appointments'
     +(conditions.length?' WHERE '+conditions.join(' AND '):'')
     +' ORDER BY appointment_date DESC,appointment_time ASC,created_at DESC LIMIT 100';
   const prepared=env.DB.prepare(sql);
   const result=await (params.length?prepared.bind(...params):prepared).all();
   return adminJson({ok:true,appointments:result.results||[]});
  }
  const match=path.match(/^\/api\/admin\/appointments\/([a-f0-9-]{36})$/i);
  if(match){
   if(request.method!=='PATCH')return adminJson({ok:false},405);
   if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')
    return adminJson({ok:false,message:'فرمت درخواست نامعتبر است.'},415);
   if(Number(request.headers.get('content-length')||0)>512)return adminJson({ok:false},413);
   let body;try{body=await request.json();}catch{return adminJson({ok:false,message:'درخواست نامعتبر است.'},400);}
   if(!body||!['confirmed','cancelled'].includes(body.status))
    return adminJson({ok:false,message:'وضعیت انتخاب‌شده معتبر نیست.'},400);
   const sql=body.status==='confirmed'
     ?"UPDATE appointments SET status='confirmed' WHERE id=? AND status='pending'"
     :"UPDATE appointments SET status='cancelled' WHERE id=? AND status IN ('pending','confirmed')";
   const result=await env.DB.prepare(sql).bind(match[1]).run();
   if(!result.meta?.changes)return adminJson({ok:false,message:'نوبت یافت نشد یا وضعیت آن قبلاً تغییر کرده است.'},409);
   return adminJson({ok:true,status:body.status});
  }
  return adminJson({ok:false,message:'مسیر یافت نشد.'},404);
 }catch(e){
  console.error('admin api failure',String(e).slice(0,100));
  return adminJson({ok:false,message:'خطای سرور؛ لطفاً دوباره تلاش کنید.'},500);
 }
}


// Public status lookup: the 8-character booking reference is never sufficient on its own.
// Require the exact booking phone as a second factor and rate-limit requests per IP.
async function trackAppointment(request,env){
 if(request.method!=='POST')return json({ok:false,message:'روش درخواست معتبر نیست.'},405);
 if(!env.DB)return json({ok:false,message:'سامانه پیگیری موقتاً در دسترس نیست.'},503);
 const url=new URL(request.url);
 if(request.headers.get('origin')!==url.origin)return json({ok:false,message:'مبدأ درخواست مجاز نیست.'},403);
 if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')
  return json({ok:false,message:'فرمت درخواست نامعتبر است.'},415);
 if(Number(request.headers.get('content-length')||0)>1024)
  return json({ok:false,message:'درخواست بیش از حد طولانی است.'},413);
 let body;
 try{body=await request.json();}catch{return json({ok:false,message:'اطلاعات درخواست معتبر نیست.'},400);}
 if(!body||typeof body!=='object'||Array.isArray(body))return json({ok:false,message:'اطلاعات درخواست معتبر نیست.'},400);
 const reference=normalizeDigits(body.reference||'').trim().toUpperCase();
 const phone=normalizeDigits(body.phone||'').replace(/[\s-]/g,'').trim();
 if(!/^[A-F0-9]{8}$/.test(reference)||!/^09[0-9]{9}$/.test(phone))
  return json({ok:false,message:'کد پیگیری ۸ کاراکتری و شماره موبایل ۱۱ رقمی معتبر وارد کنید.'},400);
 try{
  const now=Math.floor(Date.now()/1000);
  const ipHash=await sha256(request.headers.get('CF-Connecting-IP')||'unknown');
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS tracking_attempts (ip_hash TEXT PRIMARY KEY, window_start INTEGER NOT NULL, attempts INTEGER NOT NULL)').run();
  // Atomic upsert limits the lookup to 10 requests in a rolling-ish 15-minute window.
  await env.DB.prepare(
   'INSERT INTO tracking_attempts(ip_hash,window_start,attempts) VALUES(?,?,1) '+
   'ON CONFLICT(ip_hash) DO UPDATE SET '+
   'attempts=CASE WHEN window_start<=? THEN 1 ELSE attempts+1 END, '+
   'window_start=CASE WHEN window_start<=? THEN excluded.window_start ELSE window_start END'
  ).bind(ipHash,now,now-900,now-900).run();
  const throttle=await env.DB.prepare('SELECT attempts,window_start FROM tracking_attempts WHERE ip_hash=?').bind(ipHash).first();
  if(Number(throttle?.attempts)>10)
   return json({ok:false,message:'تعداد درخواست‌ها زیاد است. لطفاً کمی بعد دوباره تلاش کنید.'},429);
  const appointment=await env.DB.prepare(
   'SELECT appointment_date,appointment_time,status FROM appointments '+
   'WHERE UPPER(SUBSTR(id,1,8))=? AND phone=? LIMIT 1'
  ).bind(reference,phone).first();
  if(!appointment)return json({ok:false,message:'نوبتی با این کد و شماره موبایل پیدا نشد. اطلاعات را بررسی کنید.'},404);
  return json({ok:true,appointment:{
   date:appointment.appointment_date,
   time:appointment.appointment_time,
   status:appointment.status
  }});
 }catch(e){
  console.error('tracking lookup failed');
  return json({ok:false,message:'پیگیری نوبت در حال حاضر ممکن نیست؛ لطفاً دوباره تلاش کنید.'},500);
 }
}


// Demo visitor accounts: account ownership is scoped to appointments created while signed in.
// Existing guest appointments are intentionally NOT linked by phone alone (unverified phone).
const USER_COOKIE='__Host-pr_user';
const USER_TTL=24*60*60;
const USER_ITERATIONS=210000;
const userJson=(data,status=200,extra={})=>new Response(JSON.stringify(data),{
 status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY',...extra}
});
const userCookie=(token,maxAge)=>USER_COOKIE+'='+token+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+maxAge;
const hex=bytes=>Array.from(bytes).map(b=>b.toString(16).padStart(2,'0')).join('');
let userSchemaPromise;
async function ensureUserSchema(db){
 if(!userSchemaPromise){
  userSchemaPromise=(async()=>{
   await db.prepare('CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, full_name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime(\'now\')))').run();
   await db.prepare('CREATE TABLE IF NOT EXISTS user_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL)').run();
   await db.prepare('CREATE TABLE IF NOT EXISTS user_auth_attempts (key_hash TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window_start INTEGER NOT NULL)').run();
   const columns=await db.prepare('PRAGMA table_info(appointments)').all();
   if(!(columns.results||[]).some(c=>c.name==='user_id')){
    try{await db.prepare('ALTER TABLE appointments ADD COLUMN user_id TEXT').run();}
    catch(e){if(!/duplicate column name/i.test(String(e)))throw e;}
   }
   await db.prepare('CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id,appointment_date)').run();
  })().catch(e=>{userSchemaPromise=null;throw e;});
 }
 return userSchemaPromise;
}
function userTokenFromCookie(request){
 const match=(request.headers.get('cookie')||'').match(/(?:^|;\s*)__Host-pr_user=([A-Za-z0-9_-]{43})(?:;|$)/);
 return match?match[1]:null;
}
async function userSession(request,db){
 const token=userTokenFromCookie(request);
 if(!token)return null;
 await ensureUserSchema(db);
 const row=await db.prepare(
  'SELECT u.id,u.full_name,u.phone,s.token_hash FROM user_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? LIMIT 1'
 ).bind(await sha256(token),Math.floor(Date.now()/1000)).first();
 return row||null;
}
async function passwordHash(password,saltHex){
 const salt=Uint8Array.from(saltHex.match(/.{2}/g).map(h=>parseInt(h,16)));
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:USER_ITERATIONS},key,256);
 return hex(new Uint8Array(bits));
}
async function authThrottle(db,request,action){
 const now=Math.floor(Date.now()/1000);
 const period=action==='register'?3600:900;
 const max=action==='register'?5:10;
 const ip=request.headers.get('CF-Connecting-IP')||'unknown';
 const key=await sha256(action+':'+ip);
 await db.prepare(
  'INSERT INTO user_auth_attempts(key_hash,attempts,window_start) VALUES(?,1,?) '+
  'ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN window_start<=? THEN 1 ELSE attempts+1 END,'+
  'window_start=CASE WHEN window_start<=? THEN excluded.window_start ELSE window_start END'
 ).bind(key,now,now-period,now-period).run();
 const result=await db.prepare('SELECT attempts FROM user_auth_attempts WHERE key_hash=?').bind(key).first();
 return Number(result?.attempts)<=max;
}
async function issueUserSession(db,userId){
 const token=adminToken();
 const now=Math.floor(Date.now()/1000);
 await db.prepare('INSERT INTO user_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)')
  .bind(await sha256(token),userId,now+USER_TTL).run();
 return userCookie(token,USER_TTL);
}
async function accountApi(request,env,url){
 if(!env.DB)return userJson({ok:false,message:'سامانه حساب کاربری موقتاً در دسترس نیست.'},503);
 const path=url.pathname;
 if(['POST','PUT','PATCH','DELETE'].includes(request.method)){
  if(request.headers.get('origin')!==url.origin||request.headers.get('x-requested-with')!=='XMLHttpRequest')
   return userJson({ok:false,message:'درخواست از مبدأ مجاز نیست.'},403);
  if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')
   return userJson({ok:false,message:'فرمت درخواست معتبر نیست.'},415);
  if(Number(request.headers.get('content-length')||0)>2048)
   return userJson({ok:false,message:'درخواست بیش از حد طولانی است.'},413);
 }
 try{
  await ensureUserSchema(env.DB);
  if(path==='/api/account/register'||path==='/api/account/login'){
   if(request.method!=='POST')return userJson({ok:false,message:'روش درخواست معتبر نیست.'},405);
   const isRegister=path.endsWith('/register');
   if(!await authThrottle(env.DB,request,isRegister?'register':'login'))
    return userJson({ok:false,message:'تلاش‌های زیادی انجام شده است. لطفاً بعداً دوباره امتحان کنید.'},429);
   let d;try{d=await request.json();}catch{return userJson({ok:false,message:'اطلاعات فرم نامعتبر است.'},400);}
   if(!d||typeof d!=='object'||Array.isArray(d))return userJson({ok:false,message:'اطلاعات فرم نامعتبر است.'},400);
   const phone=normalizeDigits(d.phone||'').replace(/[\s-]/g,'').trim();
   const password=d.password;
   const fullName=String(d.fullName||'').trim();
   if(!/^09[0-9]{9}$/.test(phone)||typeof password!=='string'||password.length<12||password.length>128)
    return userJson({ok:false,message:'موبایل ۱۱ رقمی و رمز عبور ۱۲ تا ۱۲۸ کاراکتری معتبر وارد کنید.'},400);
   if(isRegister){
    if(fullName.length<3||fullName.length>100)
     return userJson({ok:false,message:'نام و نام خانوادگی باید بین ۳ تا ۱۰۰ کاراکتر باشد.'},400);
    const salt=hex(crypto.getRandomValues(new Uint8Array(16)));
    const hashed=await passwordHash(password,salt);
    const userId=crypto.randomUUID();
    try{
     await env.DB.prepare('INSERT INTO users(id,full_name,phone,password_salt,password_hash) VALUES(?,?,?,?,?)')
      .bind(userId,fullName,phone,salt,hashed).run();
    }catch(e){
     if(/UNIQUE constraint failed/i.test(String(e)))
      return userJson({ok:false,message:'با این شماره موبایل قبلاً حسابی ساخته شده است.'},409);
     throw e;
    }
    return userJson({ok:true,user:{fullName,phone}},201,{'Set-Cookie':await issueUserSession(env.DB,userId)});
   }
   const user=await env.DB.prepare('SELECT id,full_name,phone,password_salt,password_hash FROM users WHERE phone=?').bind(phone).first();
   // Keep a similar amount of password hashing work for unknown and known phones.
   const salt=user?.password_salt||'00000000000000000000000000000000';
   const hashed=await passwordHash(password,salt);
   if(!user||!secureEqual(hashed,user.password_hash))
    return userJson({ok:false,message:'شماره موبایل یا رمز عبور اشتباه است.'},401);
   return userJson({ok:true,user:{fullName:user.full_name,phone:user.phone}},200,
    {'Set-Cookie':await issueUserSession(env.DB,user.id)});
  }
  const user=await userSession(request,env.DB);
  if(!user)return userJson({ok:false,message:'ابتدا وارد حساب کاربری خود شوید.'},401);
  if(path==='/api/account/session'){
   return request.method==='GET'?userJson({ok:true,user:{fullName:user.full_name,phone:user.phone}}):userJson({ok:false},405);
  }
  if(path==='/api/account/logout'){
   if(request.method!=='POST')return userJson({ok:false},405);
   await env.DB.prepare('DELETE FROM user_sessions WHERE token_hash=?').bind(user.token_hash).run();
   return userJson({ok:true},200,{'Set-Cookie':userCookie('',0)});
  }
  if(path==='/api/account/appointments'){
   if(request.method!=='GET')return userJson({ok:false},405);
   const data=await env.DB.prepare(
    'SELECT id,appointment_date,appointment_time,status FROM appointments WHERE user_id=? ORDER BY appointment_date DESC,appointment_time DESC LIMIT 100'
   ).bind(user.id).all();
   return userJson({ok:true,appointments:(data.results||[]).map(a=>({
    reference:a.id.slice(0,8).toUpperCase(),date:a.appointment_date,time:a.appointment_time,status:a.status
   }))});
  }
  return userJson({ok:false,message:'مسیر پیدا نشد.'},404);
 }catch(e){
  console.error('account api failed',String(e).slice(0,100));
  return userJson({ok:false,message:'خطای سامانه؛ لطفاً دوباره تلاش کنید.'},500);
 }
}
