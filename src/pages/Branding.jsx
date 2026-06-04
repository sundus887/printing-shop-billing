import React, { useEffect, useMemo, useRef, useState } from 'react'

export default function Branding(){
  const [info, setInfo] = useState({ shopId: '', hasLogo:false, hasTemplateHtml:false, hasTemplateJson:false, config:{} })
  const [header, setHeader] = useState('')
  const [footer, setFooter] = useState('')
  const [shopName, setShopName] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [logoPreview, setLogoPreview] = useState('')

  const fileInputLogo = useRef(null)

  useEffect(()=>{ (async()=>{
    try {
      const x = await window.api.brandingGet()
      setInfo(x)
      const cfg = x.config || {}
      setHeader(cfg.header || '')
      setFooter(cfg.footer || '')
      setShopName(cfg.shopName || '')
      // Load logo if exists
      if (x.hasLogo) {
        try {
          const logoRes = await window.api.brandingGetLogo?.()
          if (logoRes?.ok && logoRes.path) {
            // Convert file path to displayable URL
            setLogoPreview(`file://${logoRes.path}`)
          }
        } catch {}
      }
    } catch {}
  })() }, [])

  const uploadLogo = async (e)=>{
    const f = e.target.files && e.target.files[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = async ()=>{
      try {
        await window.api.brandingSaveLogo(reader.result)
        const x = await window.api.brandingGet()
        setInfo(x)
        setLogoPreview(reader.result)
        showToast('Logo uploaded successfully!')
      } catch(err) {
        alert('Failed to upload logo: ' + (err.message || err))
      }
    }
    reader.readAsDataURL(f)
  }

  const saveConfig = async ()=>{
    setSaving(true)
    try {
      const cfg = { header, footer, shopName }
      await window.api.brandingSaveConfig(cfg)
      showToast('Settings saved!')
    } catch(err) {
      alert('Failed to save: ' + (err.message || err))
    } finally {
      setSaving(false)
    }
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div>
        <div className="text-2xl font-semibold section-accent">Shop Branding</div>
        <div className="opacity-70 text-sm">Set your shop logo, name and invoice branding</div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Logo Upload */}
        <div className="card neon-red">
          <div className="title mb-4">Shop Logo</div>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-20 h-20 rounded-xl border-2 border-dashed border-[rgba(31,58,138,0.25)] grid place-items-center bg-[rgba(31,58,138,0.04)] overflow-hidden">
              {logoPreview ? (
                <img src={logoPreview} alt="Shop Logo" className="w-full h-full object-contain p-1" />
              ) : (
                <span className="text-3xl opacity-30">🖼️</span>
              )}
            </div>
            <div>
              <div className="text-sm font-medium">{info.hasLogo ? 'Logo is set' : 'No logo yet'}</div>
              <div className="text-xs opacity-70 mt-1">PNG or SVG, recommended 200x200px</div>
            </div>
          </div>
          <input
            ref={fileInputLogo}
            type="file"
            accept="image/png,image/svg+xml,image/jpeg"
            onChange={uploadLogo}
            className="text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border file:border-[rgba(31,58,138,0.25)] file:bg-[rgba(31,58,138,0.06)] file:text-[#1f3a8a] file:font-medium file:cursor-pointer"
          />
        </div>

        {/* Shop Info */}
        <div className="card neon-red">
          <div className="title mb-4">Shop Information</div>
          <div className="space-y-3">
            <div>
              <label className="text-sm opacity-80 block mb-1">Shop Name (shown on invoices)</label>
              <input
                value={shopName}
                onChange={e => setShopName(e.target.value)}
                className="input w-full"
                placeholder="e.g. Elite Printing Press"
              />
            </div>
            <div>
              <label className="text-sm opacity-80 block mb-1">Shop ID</label>
              <input
                value={info.shopId || ''}
                disabled
                className="input w-full opacity-60"
              />
              <div className="text-xs opacity-60 mt-1">Auto-generated, cannot be changed</div>
            </div>
          </div>
        </div>

        {/* Header & Footer */}
        <div className="card neon-red md:col-span-2">
          <div className="title mb-4">Invoice Header & Footer</div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm opacity-80 block mb-1">Header Text (appears on invoice)</label>
              <input
                value={header}
                onChange={e => setHeader(e.target.value)}
                className="input w-full"
                placeholder="e.g. Thank you for your business!"
              />
            </div>
            <div>
              <label className="text-sm opacity-80 block mb-1">Footer Text (appears at bottom)</label>
              <input
                value={footer}
                onChange={e => setFooter(e.target.value)}
                className="input w-full"
                placeholder="e.g. Contact: 0300-1234567 | info@shop.com"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button onClick={saveConfig} className="btn" disabled={saving}>
          {saving ? '⏳ Saving...' : '💾 Save Settings'}
        </button>
        {toast && (
          <span className="text-sm text-[#2e7d32] font-medium">✅ {toast}</span>
        )}
      </div>
    </div>
  )
}
