import fs from 'fs'
import path from 'path'

const BASE_DIR = process.env.DATA_DIR || process.cwd()
const BASE = path.join(BASE_DIR, 'data', 'shops')

export function readData(shopId, file) {
  const filePath = path.join(BASE, shopId, `${file}.json`)
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

export function writeData(shopId, file, data) {
  const filePath = path.join(BASE, shopId, `${file}.json`)
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
}
