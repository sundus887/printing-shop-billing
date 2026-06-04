import mongoose from 'mongoose'

const LicenseSchema = new mongoose.Schema({
  licenseKey: { type:String, unique:true, required:true },
  shopId: { type:String, index:true, required:true },
  machineId: { type:String, default:'' },
  plan: { type:String, enum:['monthly','yearly'], default:'monthly' },
  status: { type:String, enum:['active','suspended','revoked'], default:'active' },
  expiresAt: Date,
  signature: String,
}, { timestamps:true })

export default mongoose.model('License', LicenseSchema)
