const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' }
});
const normalizeDigits = s => String(s).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776)).replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632));
const subjects = { consult:'درخواست مشاوره',visit:'رزرو وقت',family:'مشاوره خانواده',other:'سایر' };
export default {
 async fetch(request, env) {
   const url = new URL(request.url);
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
  const id=crypto.randomUUID();
  await env.DB.prepare('INSERT INTO appointments(id,appointment_date,appointment_time,full_name,phone) VALUES(?,?,?,?,?)').bind(id,date,time,fullName,phone).run();
  return json({ok:true,reference:id.slice(0,8).toUpperCase()},201);
 }catch(e){
  if(/UNIQUE constraint failed/i.test(String(e)))return json({ok:false,message:'این ساعت قبلاً رزرو شده است؛ ساعت دیگری انتخاب کنید.'},409);
  console.error('appointment insert failed');return json({ok:false,message:'خطای ثبت درخواست؛ لطفاً تلفنی تماس بگیرید.'},500);
 }
}
