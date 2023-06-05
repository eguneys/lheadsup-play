import { network14, network28 } from './neural'
import { EncodeCardsForNN } from './neural'
import { Card, split_cards, make_deal } from 'lheadsup'
import { ehs } from '../src/mcts'

async function acc_hand_board(hand: Card[], board: Card[]) {
  let expected = ehs(hand, board)

  let computation = network14.new_computation()
  computation.AddInput(EncodeCardsForNN(hand, board))

  /*
  for (let i = 0; i < 63; i++) {
    let cards = split_cards(7, make_deal(2))
    let hand = cards.slice(0, 2)
    let board: Card[] = cards.slice(2, 7)

    computation.AddInput(EncodeCardsForNN(hand, board))
  }

 */

  await computation.ComputeAsync()
  let got14 = computation.output[0][0]
  //console.log(computation.output)

  computation = network28.new_computation()
  computation.AddInput(EncodeCardsForNN(hand, board))
  await computation.ComputeAsync()
  let got28 = computation.output[0][0]

  console.log(hand.join(''), board.join(''), expected, got28.toFixed(2), got14.toFixed(2))
}

function river_hb() {
  let cards = split_cards(7, make_deal(2))
  let hand = cards.slice(0, 2)
  let board: Card[] = []

  board = cards.slice(2, 7)
  return [hand, board] as [Card[], Card[]]
}

async function acc_batch(batch: [Card[], Card[]][]) {
  
  let c14 = network14.new_computation()
  let c28 = network28.new_computation()

  let expected = batch.map(([hand, board]) =>  {
    c14.AddInput(EncodeCardsForNN(hand, board))
    c28.AddInput(EncodeCardsForNN(hand, board))
    return ehs(hand, board)
  })

  await Promise.all([c14.ComputeAsync(), c28.ComputeAsync()])

  let o14 = c14.output.map(_ => _[0])
  let o28 = c28.output.map(_ => _[0])

  let acc14 = o14.filter((o, i) => Math.abs(expected[i] - o) < 0.1)
  let acc28 = o28.filter((o, i) => Math.abs(expected[i] - o) < 0.1)

  console.log((acc14.length / o14.length).toFixed(2), (acc28.length / o28.length).toFixed(2))
}

async function acc() {

  let batch_size = 128
  let rivers = [...Array(batch_size)].map(river_hb)

  await acc_batch(rivers)
}

export function test_acc_main(nb: number = 100) {
  for (let i = 0; i < nb; i++) {
    acc()
  }
}
