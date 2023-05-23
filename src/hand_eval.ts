import fs from 'fs/promises'
import zlib from 'node:zlib'
import { Card, rank5, make_deal, split_cards } from 'lheadsup'

type TrainingData = {
  rank_probability: number,
  high_probability: number,
  planes: number[]
}


const hand_ranks = ['high', 'pair', 'pair2', 'set', 'full', 'straight', 'flush', 'quad', 'sflush']
function p_rank(rank: string) {
  return hand_ranks.indexOf(rank) + 1
}

const suits = 'hdsc'
const ranks = '23456789TJQKA'
function p_high(rank: string) {
  return ranks.indexOf(rank) + 1
}

const encode_suit: Record<string, number> = {
  'h': 0b0001,
  's': 0b0010,
  'd': 0b0100,
  'c': 0b1000
}

function encode_hand5(hand: string) {
  let res: number[] = []
  let cards = split_cards(5, hand)

  cards.forEach((card, i) => {
    let [rank, suit] = card

    let i_rank = ranks.indexOf(rank) + 1

    res[i * 2] = i_rank
    res[i * 2 + 1] = encode_suit[suit]
  })

  return res
}

type Card5 = [Card, Card, Card, Card, Card]

function gen_data5() {
  let hand = make_deal(0)

  let rank = rank5(split_cards(5, hand) as Card5)

  let { rank_name, high_card } = rank

  let planes = encode_hand5(hand)
  let rank_probability = p_rank(rank_name!)
  let high_probability = p_high(high_card![0])

  return {
    planes, 
    rank_probability, 
    high_probability
  }
}

function gen_training_data() {
  let res = []
  for (let i = 0; i < 10000; i++) {
    res.push(gen_data5())
  }
  return res
}

function write_training_data(game_id: number) {
  let data = gen_training_data()
  let res = data.flatMap(data => {
    let { rank_probability, high_probability, planes } = data

    return [
      rank_probability,
      high_probability,
      ...planes
    ]
  })

  zlib.gzip(Buffer.from(res), (err, buffer) => {
    let r = (Math.random() + 1).toString(36).substring(7)
    fs.writeFile(`data/hand_rank5_${r}_${game_id}.gz`, buffer)
  })
}


export function self_play() {
  for (let i = 0; i < 100; i++) {
    write_training_data(i + 1)
  }
}
