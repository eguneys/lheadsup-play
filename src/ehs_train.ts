import fs from 'fs'
import zlib from 'node:zlib'
import { decompress_gzip } from './util'

import { ehs } from './mcts'
import { hand_rank, Card, make_deal, split_cards } from 'lheadsup'

const kSampleNb = 10000

function avg(a: number[]) {
  return a.reduce((a, b) => a + b, 0) / a.length
}

export function card_sort(a: Card, b: Card) {
  if (a[1] === b[1]) {
    if (a[0] === b[0]) {
      return 0
    } else if (a[0] < b[0]) {
      return 1
    } else {
      return -1
    }
  } else if (a[1] < b[1]) {
    return 1
  }
  return -1
}

/*
 * Assumes cards are sorted
 * Preflop: C(52, 2) = 1,326 possibilities
 * Flop: C(48, 3) = 17,296 possibilities
 * Turn: C(47, 1) = 47 possibilities
 * River: C(46, 1) = 46 possibilities
 * Total Probability Space = 1,326 * 17,296 * 47 * 46 = 49,584,380,352
 */
type TrainingData = {
  board: number[],
  value: number
}

const suits = 'hdsc'
export const ranks = '23456789TJQKA'
export const encode_suit: Record<string, number> = {
  'h': 0b0001,
  's': 0b0010,
  'd': 0b0100,
  'c': 0b1000
}

export const decode_suit: Record<number, string> = {
  1: 'h',
  2: 's',
  4: 'd',
  8: 'c'
}

export function encode_board(hand: Card[], board: Card[]) {
  
  let res = Array(7 * 2).fill(0);

  ([...hand, ...board]).forEach((card, i) => {
    let [rank, suit] = card
    res[i * 2] = ranks.indexOf(rank) + 1
    res[i * 2 + 1] = encode_suit[suit]
  })

  return res
}

function decode_board(board: number[]) {
  let res = []

  for (let i = 0; i < board.length; i+=2) {
    let e_rank = board[i],
      e_suit = board[i+1]

    let rank = ranks[e_rank - 1]
    let suit = decode_suit[e_suit]
    res.push(`${rank}${suit}`)
  }
  return res
}

function gen_h_b(fixed_phase?: number): [Card[], Card[]] {
  let cards = split_cards(7, make_deal(2))

  let hand = cards.slice(0, 2)
  let board = cards.slice(2, 7)

  let phase = fixed_phase ?? Math.floor(Math.random() * 4) + 1

  if (phase === 1) {
    board = []
  } else if (phase === 2) {
    board.splice(3)
  } else if (phase === 3) {
    board.splice(4)
  } else {
  }

  let _ = hand.join('') + board.join('')
  hand.sort(card_sort)
  board.sort(card_sort)

  return [hand, board]
}


function gen_ehs(hand: Card[], board: Card[]) {
  let e_board = encode_board(hand, board)

  let value = ehs(hand, board, 50, false)

  return {
    board: e_board,
    value
  }
}

function gen_training_data(fixed_phase?: number, sample_nb = kSampleNb) {
  let hb: [Card[], Card[]][] = [...Array(sample_nb)].map(_ => gen_h_b(fixed_phase))
  return hb.map(([hand, board]) => gen_ehs(hand, board))
}

function write_sample_to_buffer(buff: Buffer, sample: TrainingData, offset: number) {
  let { board, value } = sample

  board.forEach((n, i) => buff.writeUInt8(n, offset + i))
  buff.writeFloatBE(value, offset + 14)
}

function read_board_from_buffer(buff: Buffer, offset: number) {
  let board = [...Array(14).keys()].map(i => buff.readUInt8(offset + i))
  return board
}

function read_value_from_buffer(buff: Buffer, offset: number) {
  return buff.readFloatBE(offset + 14)
}

let sample_size = 7 * 2 + 4
export function write_training_data(id: number, data: TrainingData[], prefix: string = '', basefolder: string = 'data') {

  let buff = Buffer.alloc(data.length * sample_size)
  data.forEach((sample, i) => write_sample_to_buffer(buff, sample, i * sample_size))

  return new Promise(resolve => {
    zlib.gzip(buff, (err, buffer) => {
      let r = (Math.random() + 1).toString(36).substring(7)
      if (!fs.existsSync(basefolder)){
            fs.mkdirSync(basefolder);
      }
 
      resolve(fs.writeFileSync(`${basefolder}/data_ehs_${prefix}_${r}_${id}.gz`, buffer))
    })
  })

}


function gen_training_data_from_hb(hb: [Card[], Card[]][]) {
  return hb.map(([hand, board]) => gen_ehs(hand, board))
}



export async function ehs_train_prebatch() {
  let pre_hb: [Card[], Card[]][] = [...Array(100)].map(_ => gen_h_b(4))
  let data = gen_training_data_from_hb(pre_hb)
  await write_training_data(1, data)
}


export async function read_from_data_training(filename: string) {

  let data = await decompress_gzip(filename)

  let res = []
  for (let i = 0; i < data.length; i += 2 * 7 + 4) {
    let board = read_board_from_buffer(data, i)
    let value = read_value_from_buffer(data, i)
    res.push([decode_board(board).join(''), value])
  }

  return res as [string, number][]
}



export async function ehs_train_main(nb: number, fixed_phase?: number, sample_nb?: number) {
  for (let i = 0; i < nb; i++) {
    console.log(`${i}/${nb}`)
    let data = gen_training_data(fixed_phase, sample_nb)
    await write_training_data(i + 1, data)
  }
}


class Metric {

  values: number[] = []
  longs: string[] = []

  constructor(readonly bucket: string) {}

  add(value: number, long: string) {
    this.values.push(value)
    this.longs.push(long)
  }

  get value() {
    return avg(this.values)
  }

  get fen() {
    return `${this.value.toFixed(2)} ${this.bucket} ${this.values.map(_ => _.toFixed(2)).join(' ')} ${this.longs.join(' ')}`
  }
}

export function ehs_train_stats() {
  /*
  let a = `Kh8hKdAdKc9c7c` 
  let b = `Kh9hKsKcAc8c5c`

  let as = split_cards(7, a)
  let bs = split_cards(7, b)

  let st_a = ehs(as.slice(0, 2), as.slice(2), 1000, false)
  let st_b = ehs(bs.slice(0, 2), bs.slice(2), 1000, false)

  console.log(a, st_a)
  console.log(b, st_b)

  return

 */


  let data = []
  let batch_size = 64

  for (let i = 0; i < batch_size; i++) {
    let [hand, board] = gen_h_b(4)

    let rank = hand_rank([...hand, ...board])
    let bucket = rank.fen!.split(' ').slice(0, 3).join('')

    let strength = ehs(hand, board, 1000, false)

    data.push([bucket, strength, [...hand, ...board].join('')])
  }

  let metrics: Metric[] = []


  data.forEach(([bucket, strength, long]) => {
    let metric = metrics.find(_ => _.bucket === bucket) 
    if (!metric) {
      metric = new Metric(bucket)
      metrics.push(metric)
    }
    metric.add(strength, long)
  })

  console.log(metrics.sort((a, b) => b.value - a.value).map(_ => _.fen))
}


function sum(a: number[]) { return a.reduce((a, b) => a + b, 0) }

function accuracy_test() {
  for (let k = 0; k < 100; k++) {
    let cards = split_cards(7, make_deal(2))

    let hand = cards.slice(0, 2)
    let board = cards.slice(2, 7)

    let res = []
    for (let i = 0; i < 10; i++) {
      let nb = Math.floor((i + 1) / 100 * 5000)


      res.push([nb, ehs(hand, board, nb, false)])
    }
    let avg = sum(res.map(_ => _[1])) / res.length
    let ares = res.map(([nb, hs]) => [nb, avg - hs])
    console.log(hand.join(''), board.join(''), ares, avg)
  }
}



