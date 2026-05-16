(function(){
  const TASK_KEYS=['mzj_created_tasks_from_templates_v1','mzj_dashboard_tasks_v2','mzj_campaign_records_v1'];
  const displayGroups = [
    ['photography','عرض التصوير','مرفقات قسم التصوير من تفاصيل التاسك'],['content','عرض المحتوى','مرفقات قسم المحتوى من تفاصيل التاسك'],['design','عرض التصميم','مرفقات قسم التصميم من تفاصيل التاسك'],['video','عرض الفيديو','مرفقات قسم المونتاج / الفيديو من تفاصيل التاسك'],['schedule','عرض جدول النشر','Template جدول النشر المرفوع من مدير التسويق'],['budget','عرض الميزانية','Template الميزانية المرفوع من مدير التسويق'],['results','عرض نتائج الحملة','Template تقرير النتائج المرفوع من مدير التسويق']
  ];
  function loadRecords(){
    const all=[]; TASK_KEYS.forEach(k=>{try{const v=JSON.parse(localStorage.getItem(k)||'[]'); if(Array.isArray(v)) all.push(...v)}catch(e){}}); return all;
  }
  function esc(v){return String(v??'').replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))}
  function calcDelay(required,delivered){
    if(!required) return '--'; const end = delivered ? new Date(delivered) : new Date(); const req = new Date(required); const d=Math.ceil((end-req)/86400000); return d>0? d+' يوم تأخير':'لا يوجد تأخير';
  }
  function render(){
    const holder=document.getElementById('campaignRecordsLive'); if(!holder) return;
    const records=loadRecords();
    if(!records.length){holder.innerHTML='<article class="empty-database-state"><div class="empty-icon">DB</div><div><span class="eyebrow">قاعدة البيانات جاهزة</span><h4>لا توجد حملات أو أجندات مضافة حالياً</h4><p>أي حملة أو أجندة يتم إنشاؤها هتظهر هنا بتواريخها، وقت التأخير، مرفقات الأقسام، وTemplates جدول النشر والميزانية والنتائج.</p></div></article>';return;}
    holder.innerHTML=records.map((r,idx)=>{
      const code=r.code||r.campaignCode||('TASK-'+(idx+1)); const name=r.name||r.campaignName||'حملة / أجندة';
      const req=r.requiredDate||r.launchDate||r.deadline; const del=r.deliveryDate||r.completedAt;
      return `<article class="campaign-live-card"><div class="campaign-live-head"><div><strong>${esc(name)}</strong><small>${esc(r.type||r.taskType||'حملة')} · كود: ${esc(code)}</small></div><span>${esc(calcDelay(req,del))}</span></div>
      <div class="campaign-live-dates"><span>تاريخ الإنشاء: ${esc(r.createdAt||'--')}</span><span>تاريخ النزول: ${esc(r.launchDate||'--')}</span><span>التاريخ المطلوب: ${esc(req||'--')}</span><span>تاريخ التسليم: ${esc(del||'--')}</span></div>
      <div class="campaign-live-actions">${displayGroups.map(g=>`<button class="view-btn" data-title="${g[1]} - ${esc(name)}" data-content="${g[2]} | سيتم عرض الملفات أو بيانات الـ Template المحفوظة داخل سجل الحملة: ${esc(code)}">${g[1]}</button>`).join('')}</div></article>`;
    }).join('');
  }
  document.addEventListener('DOMContentLoaded',render);
})();
