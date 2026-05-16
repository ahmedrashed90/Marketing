(function(){
  const TASK_KEYS=['mzj_created_tasks_from_templates_v1','workspace_tasks','mzj_workspace_tasks','mzj_dashboard_tasks_v2','mzj_campaign_records_v1'];
  const FIRESTORE_TASK_COLLECTIONS=['workspace_tasks'];
  let firestoreRecords=[];
  const displayGroups = [
    ['photography','عرض التصوير','مرفقات قسم التصوير من تفاصيل التاسك'],['content','عرض المحتوى','مرفقات قسم المحتوى من تفاصيل التاسك'],['design','عرض التصميم','مرفقات قسم التصميم من تفاصيل التاسك'],['video','عرض الفيديو','مرفقات قسم المونتاج / الفيديو من تفاصيل التاسك'],['schedule','عرض جدول النشر','Template جدول النشر المرفوع من مدير التسويق'],['budget','عرض الميزانية','Template الميزانية المرفوع من مدير التسويق'],['results','عرض نتائج الحملة','Template تقرير النتائج المرفوع من مدير التسويق']
  ];
  function normalizeRecord(r, fallbackId){
    if(!r || typeof r !== 'object') return null;
    const labelRaw = r.taskTypeLabel || r.taskType || r.type || r.kind || 'حملة';
    const label = String(labelRaw).includes('أج') || String(labelRaw).toLowerCase().includes('agenda') ? 'أجندة' : (String(labelRaw).includes('تاسك') ? 'تاسك' : 'حملة');
    return {
      ...r,
      id: r.id || r.firestoreId || r.docId || fallbackId,
      type: label,
      name: r.name || r.campaignName || r.title || r.agendaName || r.taskName || 'حملة / أجندة',
      code: r.code || r.campaignCode || r.taskCode || '',
      launchDate: r.launchDate || r.campaignLaunchDate || r.publishDate || r.date || r.dueDate || '',
      requiredDate: r.requiredDate || r.deadline || r.launchDate || r.dueDate || '',
      deliveryDate: r.deliveryDate || r.completedAt || r.deliveredAt || '',
      createdAt: r.createdAt || r.created || '',
      sourceFirestoreCollection: r.sourceFirestoreCollection || 'workspace_tasks'
    };
  }
  function loadRecords(){
    const all=[];
    TASK_KEYS.forEach(k=>{try{const v=JSON.parse(localStorage.getItem(k)||'[]'); if(Array.isArray(v)) v.forEach((item,idx)=>all.push(normalizeRecord(item,k+'_'+idx)))}catch(e){}});
    firestoreRecords.forEach((item,idx)=>all.push(normalizeRecord(item,'firestore_'+idx)));
    const map=new Map();
    all.filter(Boolean).forEach(item=>map.set(String(item.id), {...(map.get(String(item.id))||{}), ...item}));
    return Array.from(map.values());
  }
  async function loadFirestoreRecords(){
    if(!window.firebase || !window.MZJ_FIREBASE_CONFIG || !firebase.firestore) return;
    try{
      if(!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
      const loaded=[];
      for(const col of FIRESTORE_TASK_COLLECTIONS){
        const snap=await firebase.firestore().collection(col).get();
        snap.forEach(doc=>loaded.push({id:doc.id, firestoreId:doc.id, sourceFirestoreCollection:col, ...(doc.data()||{})}));
      }
      firestoreRecords=loaded;
      render();
    }catch(err){console.warn('workspace_tasks database load fallback:',err)}
  }
  function esc(v){return String(v??'').replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]))}
  function calcDelay(required,delivered){
    if(!required) return '--'; const end = delivered ? new Date(delivered) : new Date(); const req = new Date(required); const d=Math.ceil((end-req)/86400000); return d>0? d+' يوم تأخير':'لا يوجد تأخير';
  }
  async function deleteRecord(recordId){
    const records=loadRecords();
    const target=records.find(r=>String(r.id)===String(recordId));
    TASK_KEYS.forEach(k=>{try{const v=JSON.parse(localStorage.getItem(k)||'[]'); if(Array.isArray(v)) localStorage.setItem(k,JSON.stringify(v.filter(item=>String(item.id||item.firestoreId||item.docId)!==String(recordId))))}catch(e){}});
    if(window.firebase && window.MZJ_FIREBASE_CONFIG && firebase.firestore){
      try{
        if(!firebase.apps.length) firebase.initializeApp(window.MZJ_FIREBASE_CONFIG);
        const col=target?.sourceFirestoreCollection || 'workspace_tasks';
        const docId=target?.firestoreId || target?.docId || target?.id;
        if(docId) await firebase.firestore().collection(col).doc(String(docId)).delete();
      }catch(err){console.warn('workspace_tasks delete fallback:',err)}
    }
    firestoreRecords=firestoreRecords.filter(r=>String(r.id||r.firestoreId)!==String(recordId));
    render();
  }
  function render(){
    const holder=document.getElementById('campaignRecordsLive'); if(!holder) return;
    const records=loadRecords();
    if(!records.length){holder.innerHTML='<article class="empty-database-state"><div class="empty-icon">DB</div><div><span class="eyebrow">قاعدة البيانات جاهزة</span><h4>لا توجد حملات أو أجندات مضافة حالياً</h4><p>أي حملة أو أجندة يتم إنشاؤها أو موجودة في مسار workspace_tasks هتظهر هنا بتواريخها، وقت التأخير، مرفقات الأقسام، وTemplates جدول النشر والميزانية والنتائج.</p></div></article>';return;}
    holder.innerHTML=records.map((r,idx)=>{
      const code=r.code||('TASK-'+(idx+1)); const name=r.name||'حملة / أجندة';
      const req=r.requiredDate||r.launchDate||r.deadline; const del=r.deliveryDate||r.completedAt;
      return `<article class="campaign-live-card" data-record-id="${esc(r.id)}"><div class="campaign-live-head"><div><strong>${esc(name)}</strong><small>${esc(r.type||'حملة')} · كود: ${esc(code)}</small></div><span>${esc(calcDelay(req,del))}</span></div>
      <div class="campaign-live-dates"><span>تاريخ الإنشاء: ${esc(r.createdAt||'--')}</span><span>تاريخ النزول: ${esc(r.launchDate||'--')}</span><span>التاريخ المطلوب: ${esc(req||'--')}</span><span>تاريخ التسليم: ${esc(del||'--')}</span></div>
      <div class="campaign-live-actions">${displayGroups.map(g=>`<button class="view-btn" data-title="${g[1]} - ${esc(name)}" data-content="${g[2]} | سيتم عرض الملفات أو بيانات الـ Template المحفوظة داخل سجل الحملة: ${esc(code)}">${g[1]}</button>`).join('')}<button class="danger-btn" type="button" data-delete-record="${esc(r.id)}" data-admin-only>مسح الحملة</button></div></article>`;
    }).join('');
  }
  document.addEventListener('click',async(e)=>{const btn=e.target.closest('[data-delete-record]'); if(!btn) return; const ok=confirm('تأكيد مسح الحملة/الأجندة من قاعدة البيانات؟'); if(!ok) return; await deleteRecord(btn.dataset.deleteRecord);});
  window.renderCampaignRecordsLive=render;
  document.addEventListener('DOMContentLoaded',()=>{render(); setTimeout(loadFirestoreRecords,250);});
})();
