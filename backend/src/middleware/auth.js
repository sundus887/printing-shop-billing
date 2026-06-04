import jwt from 'jsonwebtoken'

export function auth(requiredRole='VIEWER'){
  return (req,res,next)=>{
    const hdr = req.headers.authorization||''
    const token = hdr.startsWith('Bearer ')? hdr.slice(7) : ''
    try{
      const payload = jwt.verify(token, process.env.JWT_SECRET)
      if (requiredRole==='ADMIN' && payload.role!=='ADMIN') return res.status(403).json({error:'forbidden'})
      if (requiredRole==='SUPPORT' && !['SUPPORT','ADMIN'].includes(payload.role)) return res.status(403).json({error:'forbidden'})
      req.user = payload; next()
    }catch{
      return res.status(401).json({error:'unauthorized'})
    }
  }
}
