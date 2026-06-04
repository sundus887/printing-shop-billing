import mongoose from 'mongoose'

const ShopSchema = new mongoose.Schema({
  shopId: { type:String, unique:true, required:true },
  name: String,
  ownerEmail: String,
  lastOnlineStatusAt: Date,
}, { timestamps:true })

export default mongoose.model('Shop', ShopSchema)
