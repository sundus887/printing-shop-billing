import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import authRoutes from './routes/auth.js'
import licenseRoutes from './routes/license.js'
import shopRoutes from './routes/shops.js'
import brandingRoutes from './routes/branding.js'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

const PORT = process.env.PORT || 3000

async function start(){
  await mongoose.connect(process.env.MONGO_URI)
  app.use('/auth', authRoutes)
  app.use('/license', licenseRoutes)
  app.use('/shops', shopRoutes)
  app.use('/branding', brandingRoutes)
  app.get('/health', (req,res)=> res.json({ ok:true }))
  app.listen(PORT, ()=> console.log(`[admin] listening on :${PORT}`))
}

start().catch(e=>{ console.error(e); process.exit(1) })
