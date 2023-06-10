import fs from 'fs/promises'
import zlib from 'node:zlib'
import { Card, rank5, make_deal, split_cards } from 'lheadsup'

type TrainingData = {
  rank_probabilities: number[],
  high_probabilities: number[],
  planes: number[]
}

const hand_ranks = ['high', 'pair', 'pair2', 'set', 'full', 'straight', 'flush', 'quad', 'sflush']
function p_rank(rank: string) {
  let i = hand_ranks.indexOf(rank)
  let res = new Array(hand_ranks.length)
  res[i] = 1
  return res
}

const suits = 'hdsc'
const ranks = '23456789TJQKA'
function p_high(rank: string) {
  let i = ranks.indexOf(rank)
  let res = new Array(ranks.length)
  res[i] = 1
  return res
}

const encode_suit: Record<string, number> = {
  'h': 0b0001,
  's': 0b0010,
  'd': 0b0100,
  'c': 0b1000
}

function encode_hand5(hand: string) {
  let res: number[] = []
  let cards = split_cards(hand, 5)

  cards.forEach((card, i) => {
    let [rank, suit] = card

    let i_rank = ranks.indexOf(rank) + 1

    res[i * 2] = i_rank
    res[i * 2 + 1] = encode_suit[suit]
  })

  return res
}

let total: number
let stats: Record<string, number>

type Card5 = [Card, Card, Card, Card, Card]

function gen_data5() {
  let hand = make_deal(0)

  let rank = rank5(split_cards(hand, 5) as Card5)

  let { rank_name, high_card } = rank

  if ((stats[rank_name!] / total) > 0.1) {
    if (Math.random() < 0.98) {
      return
    }
  }

  stats[rank_name!]++;
  total++;

  let planes = encode_hand5(hand)
  let rank_probabilities = p_rank(rank_name!)
  let high_probabilities = p_high(high_card![0])

  return {
    planes, 
    rank_probabilities, 
    high_probabilities
  }
}

function gen_training_data() {
  let res = []
  for (let i = 0; i < 10000; i++) {
    let data = gen_data5()
    if (data) {
      res.push(data)
    }
  }
  return res
}

function write_training_data(game_id: number) {
  let data = gen_training_data()
  let res = data.flatMap(data => {
    let { rank_probabilities, high_probabilities, planes } = data

    return [
      ...rank_probabilities,
      ...high_probabilities,
      ...planes
    ]
  })

  zlib.gzip(Buffer.from(res), (err, buffer) => {
    let r = (Math.random() + 1).toString(36).substring(7)
    fs.writeFile(`data/hand_rank5_${r}_${game_id}.gz`, buffer)
  })
}


export function self_play() {
  total = 0
  stats = {}
  hand_ranks.forEach(_ => stats[_] = 0)

  let i
  for (i = 0; i < 100; i++) {
    write_training_data(i + 1)
  }

  while (total < 1000000) {
    write_training_data(i + 1)
    i++;
  }

  hand_ranks.map(_ => console.log(`${_}: ${(stats[_] /= total) * 100}%`))
  console.log(`Total: ${total}`)
}
