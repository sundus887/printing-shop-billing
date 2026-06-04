import mongoose from 'mongoose'

const ActivationSchema = new mongoose.Schema({
  shopId: { type:String, index:true },
  machineId: String,
  licenseKey: String,
  event: String,
  ok: Boolean,
  reason: String,
  meta: {},
  at: { type:Date, default: ()=> new Date() },
}, { timestamps:true })

export default mongoose.model('Activation', ActivationSchema)
