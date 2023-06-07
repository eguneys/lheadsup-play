import fs from 'fs'
import zlib from 'node:zlib'

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
