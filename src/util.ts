import fs from 'fs'
import zlib from 'node:zlib'

export function sum(a: number[]) {
  return a.reduce((a, b) => a + b, 0)
}

export function mean(res: number[]) {
  return sum(res) / res.length
}

export function variance(res: number[]) {
  let m = mean(res)
  return Math.sqrt(sum(res.map(_ => (_ - m) * (_ - m))) / (res.length - 1))
}

export function decompress_gzip(filename: string): Promise<Buffer> {
  return new Promise(resolve => {
    fs.readFile(filename, (err, buffer) => {
      zlib.gunzip(buffer, (err, buffer) => {
        resolve(buffer)
      })
    })
  })
}

export function get_files(folder: string): Promise<string[]> {
  return new Promise(resolve => {
    fs.readdir(folder, (err, files) => {
      return resolve(files)
    })
  })
}
