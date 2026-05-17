(function(){
  'use strict';

  const STOCK_CONFIG = window.MZJ_STOCK_FIREBASE_CONFIG || null;
  const STOCK_COLLECTION = window.MZJ_STOCK_CARS_COLLECTION || 'cars';
  const EXCLUDED_STATUSES = new Set(['مباع تم التسليم', 'أرشيف', 'مؤرشف']);
  const state = {
    cars: [],
    filtered: [],
    specs: [],
    search: '',
    status: 'all',
    loading: false,
    error: ''
  };

  const els = {};

  function $(id){ return document.getElementById(id); }

  function normalize(value){
    return String(value == null ? '' : value).trim();
  }

  function getCarId(doc){
    return normalize(doc.vin || doc.id || doc.docId || '');
  }

  function normalizeCar(doc){
    const vin = getCarId(doc);
    return {
      id: normalize(doc.docId || vin),
      vin,
      carName: normalize(doc.carName),
      statement: normalize(doc.statement),
      model: normalize(doc.model),
      exteriorColor: normalize(doc.exteriorColor),
      interiorColor: normalize(doc.interiorColor),
      status: normalize(doc.status),
      location: normalize(doc.location),
      trackingLink: normalize(doc.trackingLink || doc.tracking || doc.Tracking),
      isArchived: doc.isArchived === true,
      raw: doc
    };
  }

  function shouldExclude(car){
    const status = normalize(car.status);
    return car.isArchived === true || EXCLUDED_STATUSES.has(status) || status.includes('أرشيف') || status.includes('مؤرشف');
  }

  function getStockDb(){
    if(!window.firebase || !firebase.firestore){
      throw new Error('Firebase SDK غير موجود في صفحة الاستوك.');
    }
    if(!STOCK_CONFIG){
      throw new Error('كونفيج قاعدة الاستوك غير موجود.');
    }

    const appName = 'mzjStockReadonlyApp';
    let app = null;
    try {
      app = firebase.app(appName);
    } catch(_err) {
      app = firebase.initializeApp(STOCK_CONFIG, appName);
    }
    return app.firestore();
  }

  async function loadCars(){
    state.loading = true;
    state.error = '';
    render();

    try {
      const db = getStockDb();
      const snap = await db.collection(STOCK_COLLECTION).get();
      const cars = [];
      snap.forEach((doc) => {
        const data = doc.data() || {};
        const car = normalizeCar({ ...data, docId: doc.id });
        if(!shouldExclude(car)) cars.push(car);
      });
      cars.sort((a,b) => {
        const aStatus = a.status.localeCompare(b.status, 'ar');
        if(aStatus !== 0) return aStatus;
        return a.vin.localeCompare(b.vin, 'ar', { numeric: true });
      });
      state.cars = cars;
      applyFilters();
    } catch(err) {
      console.error('Stock load error:', err);
      state.error = err && err.message ? err.message : 'فشل قراءة الاستوك من قاعدة البيانات.';
      state.cars = [];
      state.filtered = [];
      state.specs = [];
    } finally {
      state.loading = false;
      render();
    }
  }

  function getStatuses(){
    const statuses = Array.from(new Set(state.cars.map(c => c.status).filter(Boolean)));
    statuses.sort((a,b) => a.localeCompare(b, 'ar'));
    return statuses;
  }

  function getSpecKey(car){
    return [car.carName || 'بدون اسم', car.statement || 'بدون بيان', car.model || 'بدون موديل'].join(' | ');
  }

  function buildUniqueSpecs(cars){
    const map = new Map();
    cars.forEach((car) => {
      const key = getSpecKey(car);
      if(!map.has(key)){
        map.set(key, {
          key,
          carName: car.carName,
          statement: car.statement,
          model: car.model,
          count: 0,
          exteriorColors: new Set(),
          interiorColors: new Set(),
          statuses: new Map(),
          vins: []
        });
      }
      const item = map.get(key);
      item.count += 1;
      if(car.exteriorColor) item.exteriorColors.add(car.exteriorColor);
      if(car.interiorColor) item.interiorColors.add(car.interiorColor);
      if(car.status) item.statuses.set(car.status, (item.statuses.get(car.status) || 0) + 1);
      if(car.vin) item.vins.push(car.vin);
    });

    return Array.from(map.values()).sort((a,b) => {
      if(b.count !== a.count) return b.count - a.count;
      return a.key.localeCompare(b.key, 'ar', { numeric: true });
    });
  }

  function applyFilters(){
    const search = normalize(state.search).toLowerCase();
    state.filtered = state.cars.filter((car) => {
      if(state.status !== 'all' && car.status !== state.status) return false;
      if(!search) return true;
      const haystack = [
        car.vin,
        car.carName,
        car.statement,
        car.model,
        car.exteriorColor,
        car.interiorColor,
        car.status,
        car.location
      ].join(' ').toLowerCase();
      return haystack.includes(search);
    });
    state.specs = buildUniqueSpecs(state.filtered);
  }

  function escapeHtml(value){
    return normalize(value)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#039;');
  }

  function valueOrDash(value){
    const v = normalize(value);
    return v ? escapeHtml(v) : '<span class="stock-muted">-</span>';
  }

  function statusBadge(status){
    const s = normalize(status) || 'بدون حالة';
    const cls = s.includes('متاح') ? 'is-available'
      : s.includes('حجز') ? 'is-reserved'
      : s.includes('مباع') ? 'is-sold'
      : s.includes('ملاحظ') ? 'is-notes'
      : '';
    return `<span class="stock-status ${cls}">${escapeHtml(s)}</span>`;
  }

  function renderStats(){
    if(!els.countAll) return;
    els.countAll.textContent = state.cars.length;
    els.countShown.textContent = state.filtered.length;

    const available = state.cars.filter(c => c.status.includes('متاح')).length;
    const reserved = state.cars.filter(c => c.status.includes('حجز')).length;
    const handover = state.cars.filter(c => c.status.includes('مباع تحت التسليم')).length;
    if(els.countAvailable) els.countAvailable.textContent = available;
    if(els.countReserved) els.countReserved.textContent = reserved;
    if(els.countHandover) els.countHandover.textContent = handover;
  }

  function renderStatusFilter(){
    if(!els.statusFilter) return;
    const current = state.status;
    const statuses = getStatuses();
    els.statusFilter.innerHTML = `<option value="all">كل الحالات</option>` + statuses.map((status) => (
      `<option value="${escapeHtml(status)}" ${status === current ? 'selected' : ''}>${escapeHtml(status)}</option>`
    )).join('');
  }

  function renderSpecs(){
    if(!els.specsBody) return;
    if(state.loading){
      els.specsBody.innerHTML = `<tr><td colspan="8" class="stock-empty">جاري تحميل الحصر...</td></tr>`;
      return;
    }
    if(state.error){
      els.specsBody.innerHTML = `<tr><td colspan="8" class="stock-empty stock-error">${escapeHtml(state.error)}</td></tr>`;
      return;
    }
    if(!state.specs.length){
      els.specsBody.innerHTML = `<tr><td colspan="8" class="stock-empty">لا توجد مواصفات مطابقة للبحث الحالي.</td></tr>`;
      return;
    }

    els.specsBody.innerHTML = state.specs.map((spec, index) => {
      const exteriors = Array.from(spec.exteriorColors).sort((a,b) => a.localeCompare(b, 'ar'));
      const interiors = Array.from(spec.interiorColors).sort((a,b) => a.localeCompare(b, 'ar'));
      const statuses = Array.from(spec.statuses.entries()).sort((a,b) => b[1] - a[1]);
      return `
        <tr>
          <td>${index + 1}</td>
          <td class="stock-spec-key"><strong>${escapeHtml(spec.key)}</strong><small>${escapeHtml(spec.statement || '')}</small></td>
          <td>${valueOrDash(spec.carName)}</td>
          <td>${valueOrDash(spec.model)}</td>
          <td><span class="stock-count-pill">${spec.count}</span></td>
          <td>${renderColorTags(exteriors)}</td>
          <td>${renderColorTags(interiors)}</td>
          <td>${statuses.map(([s,count]) => `<span class="stock-status-count">${escapeHtml(s)}: ${count}</span>`).join(' ') || '<span class="stock-muted">-</span>'}</td>
        </tr>
      `;
    }).join('');
  }

  function renderColorTags(colors){
    if(!colors.length) return '<span class="stock-muted">-</span>';
    return colors.map((color) => `<span class="stock-color-tag">${escapeHtml(color)}</span>`).join(' ');
  }

  function renderTable(){
    if(!els.tableBody) return;

    if(state.loading){
      els.tableBody.innerHTML = `<tr><td colspan="8" class="stock-empty">جاري تحميل الاستوك...</td></tr>`;
      return;
    }

    if(state.error){
      els.tableBody.innerHTML = `<tr><td colspan="8" class="stock-empty stock-error">${escapeHtml(state.error)}</td></tr>`;
      return;
    }

    if(!state.filtered.length){
      els.tableBody.innerHTML = `<tr><td colspan="8" class="stock-empty">لا توجد سيارات مطابقة للبحث الحالي.</td></tr>`;
      return;
    }

    els.tableBody.innerHTML = state.filtered.map((car, index) => `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${valueOrDash(car.vin)}</strong></td>
        <td>${valueOrDash(car.carName)}</td>
        <td>${valueOrDash(car.statement)}</td>
        <td>${valueOrDash(car.model)}</td>
        <td>${valueOrDash(car.exteriorColor)}</td>
        <td>${valueOrDash(car.interiorColor)}</td>
        <td>${statusBadge(car.status)}</td>
      </tr>
    `).join('');
  }

  function render(){
    renderStats();
    renderStatusFilter();
    renderSpecs();
    renderTable();
  }

  function bind(){
    els.searchInput?.addEventListener('input', (event) => {
      state.search = event.target.value || '';
      applyFilters();
      render();
    });

    els.statusFilter?.addEventListener('change', (event) => {
      state.status = event.target.value || 'all';
      applyFilters();
      render();
    });

    els.refreshBtn?.addEventListener('click', loadCars);
  }

  function init(){
    els.searchInput = $('stockSearchInput');
    els.statusFilter = $('stockStatusFilter');
    els.refreshBtn = $('stockRefreshBtn');
    els.tableBody = $('stockTableBody');
    els.specsBody = $('stockSpecsBody');
    els.countAll = $('stockCountAll');
    els.countShown = $('stockCountShown');
    els.countAvailable = $('stockCountAvailable');
    els.countReserved = $('stockCountReserved');
    els.countHandover = $('stockCountHandover');

    bind();
    loadCars();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
