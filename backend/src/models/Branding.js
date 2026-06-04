import mongoose from 'mongoose'

const BrandingSchema = new mongoose.Schema({
  shopId: { type:String, unique:true },
  logoUrl: String,
  templateHtmlUrl: String,
  config: {},
}, { timestamps:true })

export default mongoose.model('Branding', BrandingSchema)
