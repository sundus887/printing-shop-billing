import { Router } from 'express'
import License from '../models/License.js'
import Activation from '../models/Activation.js'
import { auth } from '../middleware/auth.js'
import { signLicense, canonicalize } from '../utils/signing.js'

const r = Router()

r.post('/issue', auth('SUPPORT'), async (req,res)=>{
  const { shopId, plan='monthly', expiresAt, machineId='' } = req.body||{}
  const licenseKey = 'LIC-' + Math.random().toString(36).slice(2)
  const lic = await License.create({ licenseKey, shopId, plan, expiresAt, machineId, status:'active' })
  res.json({ licenseKey: lic.licenseKey })
})

r.get('/status', async (req,res)=>{
  const { key:licenseKey, machineId, shopId } = req.query
  const lic = await License.findOne({ licenseKey, shopId }).lean()
  if (!lic) return res.json({ valid:false })
  const suspended = ['suspended','revoked'].includes(lic.status)
  const valid = !suspended && lic.expiresAt && (new Date(lic.expiresAt) > new Date())
  const meta = { licenseKey, shopId, machineId, expiresAt: lic.expiresAt ? new Date(lic.expiresAt).toISOString() : '' }
  let signature
  try { signature = signLicense(meta) } catch {}
  await Activation.create({ shopId, machineId, licenseKey, event:'online_status', ok: !!valid, at: new Date() })
  res.json({ valid, plan: lic.plan, expiresAt: lic.expiresAt, suspended, signature })
})

r.post('/update', auth('SUPPORT'), async (req,res)=>{
  const { licenseKey, status, expiresAt, plan } = req.body||{}
  const update = {}
  if (status) update.status = status
  if (expiresAt) update.expiresAt = expiresAt
  if (plan) update.plan = plan
  await License.updateOne({ licenseKey }, { $set: update, $currentDate: { updatedAt: true }})
  res.json({ ok:true })
})

r.post('/generate', auth('SUPPORT'), async (req,res)=>{
  const { licenseKey, shopId, machineId, expiresAt } = req.body||{}
  const meta = { licenseKey, shopId, machineId, expiresAt: new Date(expiresAt).toISOString() }
  const signature = signLicense(meta)
  res.json({ ...meta, signature })
})

export default r
