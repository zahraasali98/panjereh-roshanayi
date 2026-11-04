(function () {
'use strict';
const form=document.getElementById('bookingForm');if(!form)return;
const dateEl=document.getElementById('appointmentDate'),timeEl=document.getElementById('appointmentTime'),statusEl=document.getElementById('bookingStatus'),submitEl=document.getElementById('bookingSubmit');
const demo=location.hostname.endsWith('github.io')||location.protocol==='file:';
function message(t,type){statusEl.textContent=t;statusEl.className='booking-status '+(type||'');statusEl.hidden=false;}
function iranDate(offset){const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(Date.now()+offset*86400000)).map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;}
function friday(d){return new Date(d+'T00:00:00Z').getUTCDay()===5;}
function times(a){timeEl.replaceChildren(new Option('انتخاب ساعت',''));a.forEach(t=>timeEl.add(new Option(t,t)));timeEl.disabled=!a.length;}
// تاریخ‌های شمسی با Intl نمایش داده می‌شوند؛ تاریخ استاندارد فقط برای API است.
const persianFormatter=new Intl.DateTimeFormat('fa-IR-u-ca-persian',{
 timeZone:'Asia/Tehran',weekday:'long',year:'numeric',month:'long',day:'numeric'
});
const monthFormatter=new Intl.DateTimeFormat('fa-IR-u-ca-persian',{
 timeZone:'Asia/Tehran',year:'numeric',month:'long'
});
const dayFormatter=new Intl.DateTimeFormat('fa-IR-u-ca-persian',{
 timeZone:'Asia/Tehran',day:'numeric'
});
const firstDate=new Date(iranDate(0)+'T12:00:00Z');
const months=[],daysByMonth=new Map();
for(let offset=0;offset<=60;offset++){
 const day=new Date(firstDate.getTime()+offset*86400000);
 const iso=day.toISOString().slice(0,10);
 const month=monthFormatter.format(day);
 if(!daysByMonth.has(month)){daysByMonth.set(month,[]);months.push(month);}
 const num=Number(dayFormatter.format(day).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776)).replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632)));
 daysByMonth.get(month).push({iso,num,day,closed:friday(iso)});
}
let monthIndex=0;
const monthEl=document.getElementById('calendarMonth'),daysEl=document.getElementById('calendarDays');
const selectedEl=document.getElementById('selectedPersianDate');
const prevEl=document.getElementById('calendarPrev'),nextEl=document.getElementById('calendarNext');
const calendarEl=document.getElementById('jalaliCalendar'),triggerEl=document.getElementById('dateTrigger');
function setCalendarOpen(open){
 calendarEl.hidden=!open;
 triggerEl.setAttribute('aria-expanded',String(open));
 if(open)renderCalendar();
}
triggerEl.addEventListener('click',()=>setCalendarOpen(calendarEl.hidden));
document.addEventListener('click',e=>{if(!calendarEl.hidden&&!calendarEl.contains(e.target)&&!triggerEl.contains(e.target))setCalendarOpen(false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!calendarEl.hidden){setCalendarOpen(false);triggerEl.focus();}});
function renderCalendar(){
 const entries=daysByMonth.get(months[monthIndex]);
 monthEl.textContent=months[monthIndex];
 prevEl.disabled=monthIndex===0;nextEl.disabled=monthIndex===months.length-1;
 daysEl.replaceChildren();
 const first=entries[0];
 const firstDayIndex=(((first.day.getUTCDay()+1)%7)-(first.num-1)%7+7)%7;
 for(let i=0;i<firstDayIndex;i++){const blank=document.createElement('span');blank.setAttribute('aria-hidden','true');daysEl.appendChild(blank);}
 for(const item of entries){
  const b=document.createElement('button');b.type='button';b.textContent=dayFormatter.format(item.day);
  b.disabled=item.closed;
  b.setAttribute('aria-label',persianFormatter.format(item.day)+(item.closed?'، تعطیل':''));
  b.setAttribute('aria-pressed',String(dateEl.value===item.iso));
  b.addEventListener('click',()=>{dateEl.value=item.iso;selectedEl.textContent=persianFormatter.format(item.day);triggerEl.classList.add('has-date');setCalendarOpen(false);dateEl.dispatchEvent(new Event('change'));});
  daysEl.appendChild(b);
 }
}
prevEl.addEventListener('click',()=>{if(monthIndex>0){monthIndex--;renderCalendar();}});
nextEl.addEventListener('click',()=>{if(monthIndex<months.length-1){monthIndex++;renderCalendar();}});
renderCalendar();
if(demo){document.getElementById('demoNotice').hidden=false;submitEl.disabled=true;}
dateEl.addEventListener('change',async()=>{
times([]);const date=dateEl.value;if(!date)return;
if(friday(date)){message('جمعه تعطیل است؛ روز دیگری انتخاب کنید.','error');return;}
if(demo){times(['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00']);return;}
message('در حال بررسی ساعت‌های آزاد…','notice');
try{const r=await fetch('/api/appointments/slots?date='+encodeURIComponent(date),{cache:'no-store'});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.message||'دریافت ساعت‌ها ممکن نشد.');times(d.available);message(d.available.length?'ساعت‌های آزاد نمایش داده شدند.':'برای این روز ساعت آزادی وجود ندارد.','notice');}catch(e){message(e.message||'خطای ارتباط با سامانه.','error');}
});
function latin(s){return String(s).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776)).replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632));}
form.addEventListener('submit',async e=>{
e.preventDefault();if(demo)return;
const fullName=document.getElementById('bookingName').value.trim(),phone=latin(document.getElementById('bookingPhone').value.trim());
if(fullName.length<3||fullName.length>100||!/^09[0-9]{9}$/.test(phone)||!dateEl.value||!timeEl.value||!document.getElementById('bookingConsent').checked){message('لطفاً همه اطلاعات را درست وارد کنید.','error');return;}
submitEl.disabled=true;message('در حال ثبت درخواست…','notice');
try{const r=await fetch('/api/appointments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fullName,phone,date:dateEl.value,time:timeEl.value,website:document.getElementById('bookingWebsite').value})});const d=await r.json();if(!r.ok||!d.ok)throw Error(d.message||'ثبت انجام نشد.');message('درخواست ثبت شد. کد پیگیری: '+d.reference+' — در انتظار تأیید کلینیک.','success');form.reset();times([]);selectedEl.textContent="انتخاب تاریخ";triggerEl.classList.remove("has-date");renderCalendar();}
catch(err){message(err.message||'ثبت انجام نشد؛ تلفنی تماس بگیرید.','error');if(dateEl.value)dateEl.dispatchEvent(new Event('change'));}finally{submitEl.disabled=false;}
});
})();