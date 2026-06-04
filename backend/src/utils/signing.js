import crypto from 'crypto'

export function canonicalize(meta){
  const o = {
    licenseKey: String(meta.licenseKey||''),
    shopId: String(meta.shopId||''),
    machineId: String(meta.machineId||''),
    expiresAt: String(meta.expiresAt||''),
  }
  const ordered = Object.keys(o).sort().reduce((r,k)=> (r[k]=o[k], r), {})
  return JSON.stringify(ordered)
}

export function signLicense(meta){
  const pk = process.env.LICENSE_PRIVATE_KEY
  if (!pk) throw new Error('LICENSE_PRIVATE_KEY not set')
  const data = canonicalize(meta)
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(data); signer.end()
  return signer.sign(pk).toString('base64')
}
