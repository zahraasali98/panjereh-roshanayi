const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' }
});
const normalizeDigits = s => String(s).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776)).replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632));
const subjects = { consult:'درخواست مشاوره',visit:'رزرو وقت',family:'مشاوره خانواده',other:'سایر' };
export default {
 async fetch(request, env) {
   const url = new URL(request.url);
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
