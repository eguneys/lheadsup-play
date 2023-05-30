import fs from 'fs/promises'
import zlib from 'node:zlib'

import { ehs } from './mcts'
import { Card, make_deal, split_cards } from 'lheadsup'

function card_sort(a: Card, b: Card) {
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
const ranks = '23456789TJQKA'
const encode_suit: Record<string, number> = {
  'h': 0b0001,
  's': 0b0010,
  'd': 0b0100,
  'c': 0b1000
}

function encode_board(hand: Card[], board: Card[]) {
  
  let res = Array(7 * 2).fill(0);

  ([...hand, ...board]).forEach((card, i) => {
    let [rank, suit] = card
    res[i * 2] = ranks.indexOf(rank) + 1
    res[i * 2 + 1] = encode_suit[suit]
  })

  return res
}


function gen_ehs() {
  let cards = split_cards(7, make_deal(2))

  let hand = cards.slice(0, 2)
  let board = cards.slice(2, 7)

  let phase = Math.floor(Math.random() * 4)

  if (phase === 0) {
    board = []
  } else if (phase === 1) {
    board.splice(3)
  } else if (phase === 2) {
    board.splice(4)
  }

  let _ = hand.join('') + board.join('')
  hand.sort(card_sort)
  board.sort(card_sort)

  let e_board = encode_board(hand, board)

  let value = ehs(hand, board, 50, false)

  return {
    board: e_board,
    value
  }
}

function gen_training_data() {
  let res = []
  for (let i = 0; i < 10000; i++) {
    let data = gen_ehs()
    res.push(data)
  }
  return res
}

function write_sample_to_buffer(buff: Buffer, sample: TrainingData, offset: number) {
  let { board, value } = sample

  board.forEach((n, i) => buff.writeUInt8(n, offset + i))
  buff.writeFloatBE(value, offset + 14)
}

let sample_size = 7 * 2 + 4
function write_training_data(id: number) {
  let data = gen_training_data()

  let buff = Buffer.alloc(data.length * sample_size)
  data.forEach((sample, i) => write_sample_to_buffer(buff, sample, i * sample_size))

  zlib.gzip(buff, (err, buffer) => {
    let r = (Math.random() + 1).toString(36).substring(7)
    fs.writeFile(`data/data_ehs${r}_${id}.gz`, buffer)
  })

}

export function ehs_train_main() {
  for (let i = 0; i < 100; i++) {
    console.log(i)
    write_training_data(i + 1)
  }
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



