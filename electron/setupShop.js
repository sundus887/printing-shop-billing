(function(){
  const $ = (id)=> document.getElementById(id);
  const shopNameEl = $('shopName');
  const logoEl = $('logo');
  const saveBtn = $('saveBtn');
  const errEl = $('err');
  const logoPreview = $('logoPreview');
  const logoPathText = $('logoPathText');

  let logoSourcePath = '';

  logoEl.addEventListener('change', ()=>{
    errEl.textContent = '';
    const f = logoEl.files && logoEl.files[0];
    if (!f){
      logoSourcePath = '';
      logoPreview.removeAttribute('src');
      logoPathText.textContent = 'No logo selected';
      return;
    }
    logoSourcePath = f.path || '';
    if (logoSourcePath){
      logoPathText.textContent = logoSourcePath;
      try{ logoPreview.src = 'file:///' + logoSourcePath.replace(/\\/g,'/'); }catch{}
    } else {
      logoPathText.textContent = f.name || 'Selected';
      try{
        const r = new FileReader();
        r.onload = ()=>{ try{ logoPreview.src = String(r.result||''); }catch{} };
        r.readAsDataURL(f);
      }catch{}
    }
  });

  saveBtn.addEventListener('click', async ()=>{
    errEl.textContent = '';
    const shopName = String(shopNameEl.value||'').trim();
    if (!shopName){ errEl.textContent = 'Shop name is required.'; return; }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    try{
      const res = await window.setupApi.save({ shopName, logoSourcePath });
      if (res && res.error){
        errEl.textContent = res.error;
        return;
      }
      window.close();
    } catch (e){
      errEl.textContent = String(e && e.message || e);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save & Continue';
    }
  });
})();
