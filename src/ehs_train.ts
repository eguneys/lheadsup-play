import fs from 'fs'
import zlib from 'node:zlib'
import { Card, split_cards, make_cards } from 'lheadsup'
import { stats_cards } from './ehs_stats'

function log_line(line: string) {
  /*
  process.stdout.clearLine(-1)
  process.stdout.cursorTo(0)
  process.stdout.write(line)
 */
  console.log(line)
}

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

export type TrainPhase = 'flop' | 'turn' | 'river' | 'mix'
function make_cards_for_phase(phase: TrainPhase) {
  switch (phase) {
    case 'flop': return make_cards(5)
    case 'turn': return make_cards(6)
    case 'river': return make_cards(7)
    default: {
      if (Math.random() < 0.4) { return make_cards(5) }
      if (Math.random() < 0.4) { return make_cards(6) }
      return make_cards(7)
    }
  }
}


type TrainingData = {
  board: number[],
  hs: number,
  ppot: number,
  npot: number
}

const suits = 'hdsc'
const ranks = '23456789TJQKA'
const encode_suit: Record<string, number> = { 'h': 1, 's': 2, 'd': 4, 'c': 8 }

function encode_cards7(cards: Card[]) {
  let res = Array(7 * 2).fill(0)

  cards.forEach((card, i) => {
    let [rank, suit] = card
    res[i * 2] = ranks.indexOf(rank) + 1
    res[i * 2 + 1] = encode_suit[suit]
  })
  return res
}





function gen_cards(phase: TrainPhase) {
  let cards = split_cards(make_cards_for_phase(phase))
  return [
    ...cards.slice(0, 2).sort(card_sort),
    ...cards.slice(2).sort(card_sort)
  ].join('')
}

function make_training_data(cards: string) {
  let board = encode_cards7(split_cards(cards))

  let [hs, ehs, ppot, npot] = stats_cards(cards)

  return {
    board,
    hs,
    ppot,
    npot
  }
}

function gen_training_data_n(phase: TrainPhase, nb_samples: number) {
  return [...Array(nb_samples)].map(_ => {
    let cards = gen_cards(phase)
    return make_training_data(cards)
  })
}

// stats_cards -> hs ehs ppot npot
export async function gen_ehs_train(phase: TrainPhase, 
                              nb_chunks: number, 
                              batch_size: number,
                              foldername: string) {
  for (let i = 0; i < nb_chunks; i++) {
    log_line(`ehs-train ${i}/${nb_chunks}`)
    let data = gen_training_data_n(phase, batch_size)
    let prefix = phase
    await write_training_data(i + 1, data, foldername, prefix)
  }
  console.log('\nehs-train done')
}


let sample_size = 7 * 2 + 4 + 4 + 4
function write_t_buffer(buff: Buffer, t: TrainingData, offset: number) {
  let { board, hs, ppot, npot } = t

  board.forEach((n, i) => buff.writeUInt8(n, offset + i))
  buff.writeFloatBE(hs, offset + 14)
  buff.writeFloatBE(ppot, offset + 18)
  buff.writeFloatBE(npot, offset + 22)
}

function write_training_data(id: number, data: TrainingData[], basefolder: string, prefix: string) {
  let buff = Buffer.alloc(data.length * sample_size)
  data.forEach((t, i) => write_t_buffer(buff, t, i * sample_size))

  return new Promise(resolve => {
    zlib.gzip(buff, (err, buffer) => {
      let r = (Math.random() + 1).toString(36).substring(7)
      if (!fs.existsSync(basefolder)) {
        //fs.mkdirSync(basefolder)
        throw `Destination folder doesnt exist ${basefolder}`
      }

      let filename = ['data_ehs', prefix, r, id].join('_')
      resolve(fs.writeFileSync(`${basefolder}/${filename}.gz`, buffer))
    })
  })
}
