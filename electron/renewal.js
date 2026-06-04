(function(){
  const elExpiry = document.getElementById('expiry');
  const elDays = document.getElementById('days');
  const elMachine = document.getElementById('machineId');
  const elStatus = document.getElementById('status');
  const elKey = document.getElementById('key');
  const elBtn = document.getElementById('renew');
  const elPick = document.getElementById('pick');
  const elErr = document.getElementById('error');

  function setError(msg){ elErr.textContent = msg ? String(msg) : ''; }
  function setBusy(b){ elBtn.disabled = !!b; elKey.disabled = !!b; }

  function fmtDate(iso){
    try {
      const d = new Date(iso);
      if (!Number.isFinite(d.getTime())) return String(iso || '-');
      return d.toLocaleString();
    } catch { return String(iso || '-'); }
  }

  async function loadStatus(){
    setError('');
    try {
      const info = await window.renewal.getStatus();
      const license = info && info.license ? info.license : null;

      const exp = (license && (license.validTill || license.expiry)) ? (license.validTill || license.expiry) : null;
      elExpiry.textContent = exp ? fmtDate(exp) : '-';
      elMachine.textContent = license && license.machineId ? String(license.machineId) : '-';

      const days = (license && typeof license.daysRemaining === 'number') ? license.daysRemaining : null;
      elDays.textContent = (typeof days === 'number' && Number.isFinite(days)) ? String(days) : '-';

      if (info && info.reason === 'SUBSCRIPTION_EXPIRED'){
        elStatus.textContent = 'Subscription expired. Please renew to continue.';
      } else if (info && info.reason === 'LICENSE_CORRUPTED'){
        elStatus.textContent = 'License file corrupted or invalid.';
      } else if (info && info.reason === 'DATE_TAMPER_DETECTED'){
        elStatus.textContent = 'System date appears incorrect. Please fix system date to continue.';
      } else if (info && info.ok){
        elStatus.textContent = 'Subscription is active.';
      } else {
        elStatus.textContent = 'Subscription status unavailable.';
      }
    } catch (e){
      elStatus.textContent = 'Unable to read subscription status.';
    }
  }

  async function renew(){
    setError('');
    const key = String(elKey.value || '').trim();
    if (!key){ setError('Please enter a renewal key.'); return; }

    setBusy(true);
    try {
      const res = await window.renewal.renew(key);
      if (res && res.ok){
        return;
      }
      setError((res && (res.error || res.reason)) ? (res.error || res.reason) : 'Renewal failed');
    } catch (e){
      setError('Renewal failed');
    } finally {
      setBusy(false);
      await loadStatus();
    }
  }

  elBtn.addEventListener('click', renew);
  elKey.addEventListener('keydown', (e)=>{ if (e.key === 'Enter') renew(); });

  if (elPick){
    elPick.addEventListener('click', async ()=>{
      setError('');
      try {
        const r = await window.renewal.pickFile();
        if (r && r.ok) return;
        if (r && r.error && r.error !== 'CANCELED') setError(r.error);
      } catch (e){
        setError('Import failed');
      } finally {
        await loadStatus();
      }
    });
  }

  loadStatus();
})();
