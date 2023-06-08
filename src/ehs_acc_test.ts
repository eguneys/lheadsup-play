import { networks_all, network14, network28 } from './neural'
import { EncodeCardsForNN } from './neural'
import { Card, split_cards, make_deal } from 'lheadsup'
import { ehs } from '../src/mcts'
import { predict_strs } from './neural'
import { get_files } from './util'
import { read_from_data_training } from './ehs_train'

function batch_arr<A>(a: A[], batch_size: number) {
  let res = []
  let batch = []
  for (let i = 0; i < a.length; i++) {

    batch.push(a[i])

    if (batch.length >= batch_size) {
      res.push(batch.splice(0, batch_size))
    }
  } 
  return res
}

async function batched_neural_log(data: [string, number][]) {
  let cards = data.map(_ => _[0])
  let expected = data.map(_ => _[1])

  let output14 = await predict_strs(cards, network14)
  let output28 = await predict_strs(cards, network28)

  let o14 = output14.map(_ => _[0])
  let acc14 = o14.filter((o, i) => Math.abs(expected[i] - o) < 0.09)

  let o28 = output28.map(_ => _[0])
  let acc28 = o28.filter((o, i) => Math.abs(expected[i] - o) < 0.09)

  console.log((acc14.length / o14.length).toFixed(2), (acc28.length / o28.length).toFixed(2))
}

async function batched_neural_all_log(data: [string, number][]) {
  let cards = data.map(_ => _[0])
  let expected = data.map(_ => _[1])

  let res = await Promise.all(networks_all.map(async function _(network) {
    let output = await predict_strs(cards, network)


    let o = output.map(_ => _[0])
    let acc = o.filter((o, i) => Math.abs(expected[i] - o) < 0.09)

    return `${network.name} ${(acc.length / o.length).toFixed(2)}`
  }))

  console.log(res.join('\n'))
}

async function acc() {

  let batch_size = 24
  let batch = [...Array(batch_size)].map(() => {
    let cards = split_cards(7, make_deal(2))
    let expected = ehs(cards.slice(0, 2), cards.slice(2))

    return [cards.join(''), expected] as [string, number]
  })

  //await batched_neural_log(batch)
  await batched_neural_all_log(batch)
}

export async function test_acc_high_from_data() {

  let folder = 'data/data_high_sub'
  let files = await get_files(folder)
  let nb = files.length
  for (let i = 0; i < nb; i++) {
    let data = await read_from_data_training(`${folder}/${files[i]}`)

    let batched = batch_arr(data, 100)

    for (let i = 0; i < batched.length; i++) {
      await batched_neural_log(batched[i])
    }
  }
}

export async function test_acc_main(nb: number = 100) {
  for (let i = 0; i < nb; i++) {
    await acc()
    console.log('\n')
  }
}


export async function test_neural_debug() {

  let res = [...Array(10).keys()].map(_ => make_deal(2))

  res = [
    'JdKc7s9h5h3d8c',
    '7c6c3sKd8d5d2d',
    '5hKd3sQhJh9h4d',
    '7s2c9sAh8h3dJc',
    '7s6cQsKs5s9c3c',
    '2s3hAs7h5h9d8c',
    'As2hJd6dTc9c4c',
    'Jc5cAs6s3d7c2c',
    'Ks2c3sJh9h4hAc',
    'Ad3d9h2hQd7d5c',
  ]

  //res = [...Array(100).keys()].map(_ => make_deal(2))
  for (let i = 0; i < res.length; i++) {
    let cards = split_cards(7, res[i])
    let hand = cards.slice(0, 2).join('')
    let board = cards.slice(2, 7).join('')
    console.log(`["${hand}", "${board}", ${await predict_strs([res[i]])}],`)
  }
}
