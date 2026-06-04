import mongoose from 'mongoose'

const UserSchema = new mongoose.Schema({
  email: { type:String, unique:true, required:true },
  passwordHash: { type:String, required:true },
  role: { type:String, enum:['ADMIN','SUPPORT','VIEWER'], default:'VIEWER' },
}, { timestamps:true })

export default mongoose.model('User', UserSchema)
