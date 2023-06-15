import { networks_all } from './neural'
import { EncodeCardsForNN } from './neural'
import { Card, split_cards, make_deal } from 'lheadsup'
import { ehs } from './cards'
import { predict_strs } from './neural'
import { get_files } from './util'
import { read_from_data_training } from './ehs_train'
import { ehs_async_str, ehs_str } from './cards'

const phase_long: Record<string, string> = {
  'p': 'Preflop',
  'f': 'Flop',
  't': 'Turn',
  'r': 'River'
}

function split_cards_for_phase(phase: string) {
  let cards = split_cards(make_deal(2), 7)
  if (phase === 'p') {
    return [cards.slice(0, 2), []]
  }
  if (phase === 'f') {
    return [cards.slice(0, 2), cards.slice(2, 5)]
  }
  if (phase === 't') {
    return [cards.slice(0, 2), cards.slice(2, 6)]
  }
  // phase === 'r'
  return [cards.slice(0, 2), cards.slice(2, 7)]
}



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

async function batched_neural_all_log(data: [string, number][]) {
  let cards = data.map(_ => _[0])
  let expected = data.map(_ => _[1])

  let res = await Promise.all(networks_all.map(async function _(network) {
    let output = await predict_strs(cards, network)


    let o = output.map(_ => _[0])
    let acc = o.filter((o, i) => Math.abs(expected[i] - o) < 0.09)

    let outliers = o.filter((o, i) => Math.abs(expected[i] - o) >= 0.2)

    let off_cards = o.map((o, i) => Math.abs(expected[i] - o) >= 0.2 ? 
                          `${cards[i]}:${expected[i]}` : undefined).filter(Boolean)

    let res = `${network.name} A: ${(acc.length / o.length).toFixed(2)} O: ${(outliers.length / o.length).toFixed(2)}`

    res += '\n' + off_cards.slice(0, 10).join(' ')

    return res
  }))

  console.log(res.join('\n'))
}

async function acc(phase: string) {

  let batch_size = 128
  let batch = [...Array(batch_size)].map(() => {
    let [hand, board] = split_cards_for_phase(phase)
    let expected = ehs(hand, board)

    //console.log(`["${hand.join('')}", "${board.join('')}", ${expected}],`)
    return [[...hand, ...board].join(''), expected] as [string, number]
  })

  await batched_neural_all_log(batch)
}

export async function test_acc_main(phase: string, nb: number = 100) {
  console.log(phase_long[phase])
  for (let i = 0; i < nb; i++) {
    await acc(phase)
    console.log('\n')
  }
}

export async function test_acc_main2() {
  let fen = 'JsAh4sJcKcQd9s'
  console.log([
    fen,
    await ehs_str(fen),
    await ehs_async_str(fen),
  ])
}

export async function test_acc_high_from_data() {

  let folder = 'data/data_high_sub'
  let files = await get_files(folder)
  let nb = files.length
  for (let i = 0; i < nb; i++) {
    let data = await read_from_data_training(`${folder}/${files[i]}`)

    let batched = batch_arr(data, 100)

    for (let i = 0; i < batched.length; i++) {
      await batched_neural_all_log(batched[i])
    }
  }
}

export async function test_neural_debug() {

  let res = [...Array(10).keys()].map(_ => make_deal(2))

  res = [
    'Tc3d4s3s6c'
  ]

  //res = [...Array(100).keys()].map(_ => make_deal(2))
  for (let i = 0; i < res.length; i++) {
    let cards = split_cards(res[i])
    let hand = cards.slice(0, 2).join('')
    let board = cards.slice(2, 7).join('')
    console.log(`["${hand}", "${board}", ${await predict_strs([cards.join('')])}],`)
  }
}
