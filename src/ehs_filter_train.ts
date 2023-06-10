import fs from 'fs'
import { encode_board, read_from_data_training, write_training_data } from './ehs_train'
import { hand_rank, Card, split_cards  } from 'lheadsup'
import { get_files } from './util'


function filter_high_fn(data: [string, number]) {
  let cards = split_cards(data[0], 7)
  let hand = cards.slice(0, 2)
  let board = cards.slice(2, 7)

  let rank = hand_rank([...hand, ...board])

  return !!rank.high
}

export async function filter_high() {
  let from_folder = 'data/data_all'

  let filter_prefix = 'high'
  let filter_fn = filter_high_fn
  let files = await get_files(from_folder)

  let res = []

  for (let i = 0; i < files.length; i++) {
    console.log(`${(i / files.length * 100).toFixed(1)}%`)
    let data = await read_from_data_training(`${from_folder}/${files[i]}`)
    let nb = data.length
    data = data.filter(filter_fn)

    let ts = data.map(repack_to_trainingdata)

    res.push(...ts)

    if (res.length >= 10000) {
      ts = res.splice(0, 10000)
      await write_training_data(i + 1, ts, filter_prefix, 'data/data_high_all')
    }
  }

}

function repack_to_trainingdata(data: [string, number]) {
  let cards = split_cards(data[0], 7)
  let hand = cards.slice(0, 2)
  let board = cards.slice(2, 7)

  let e_board = encode_board(hand, board)
  let value = data[1]

  return {
    board: e_board,
    value
  }
}

