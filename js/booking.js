(function () {
'use strict';
const form=document.getElementById('bookingForm');if(!form)return;
const dateEl=document.getElementById('appointmentDate'),timeEl=document.getElementById('appointmentTime'),statusEl=document.getElementById('bookingStatus'),submitEl=document.getElementById('bookingSubmit');
const demo=location.hostname.endsWith('github.io')||location.protocol==='file:';
function message(t,type){statusEl.textContent=t;statusEl.className='booking-status '+(type||'');statusEl.hidden=false;}
function iranDate(offset){const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(Date.now()+offset*86400000)).map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;}
function friday(d){return new Date(d+'T00:00:00Z').getUTCDay()===5;}
function times(a){timeEl.replaceChildren(new Option('انتخاب ساعت',''));a.forEach(t=>timeEl.add(new Option(t,t)));timeEl.disabled=!a.length||demo;}
dateEl.min=iranDate(0);dateEl.max=iranDate(60);
if(demo){document.getElementById('demoNotice').hidden=false;submitEl.disabled=true;message('این نسخه نمایشی است؛ نوبت واقعی در GitHub Pages ثبت نمی‌شود.','notice');}
dateEl.addEventListener('change',async()=>{
times([]);const date=dateEl.value;if(!date)return;
if(friday(date)){message('جمعه تعطیل است؛ روز دیگری انتخاب کنید.','error');return;}
if(demo){message('برای ثبت واقعی نوبت، بک‌اند باید فعال شود.','notice');return;}
message('در حال بررسی ساعت‌های آزاد…','notice');
try{const r=await fetch('/api/appointments/slots?date='+encodeURIComponent(date),{cache:'no-store'});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.message||'دریافت ساعت‌ها ممکن نشد.');times(d.available);message(d.available.length?'ساعت‌های آزاد نمایش داده شدند.':'برای این روز ساعت آزادی وجود ندارد.','notice');}catch(e){message(e.message||'خطای ارتباط با سامانه.','error');}
});
function latin(s){return String(s).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776)).replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632));}
form.addEventListener('submit',async e=>{
e.preventDefault();if(demo)return;
const fullName=document.getElementById('bookingName').value.trim(),phone=latin(document.getElementById('bookingPhone').value.trim());
if(fullName.length<3||fullName.length>100||!/^09[0-9]{9}$/.test(phone)||!dateEl.value||!timeEl.value||!document.getElementById('bookingConsent').checked){message('لطفاً همه اطلاعات را درست وارد کنید.','error');return;}
submitEl.disabled=true;message('در حال ثبت درخواست…','notice');
try{const r=await fetch('/api/appointments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fullName,phone,date:dateEl.value,time:timeEl.value,website:document.getElementById('bookingWebsite').value})});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.message||'ثبت انجام نشد.');message('درخواست ثبت شد. کد پیگیری: '+d.reference+' — در انتظار تأیید کلینیک.','success');form.reset();times([]);}
catch(err){message(err.message||'ثبت انجام نشد؛ تلفنی تماس بگیرید.','error');if(dateEl.value)dateEl.dispatchEvent(new Event('change'));}finally{submitEl.disabled=false;}
});
})();