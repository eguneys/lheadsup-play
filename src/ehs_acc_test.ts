import { network14, network28 } from './neural'
import { EncodeCardsForNN } from './neural'
import { Card, split_cards, make_deal } from 'lheadsup'
import { ehs } from '../src/mcts'

async function acc_hand_board(hand: Card[], board: Card[]) {
  let expected = ehs(hand, board)
  let computation = network14.new_computation()
  computation.AddInput(EncodeCardsForNN(hand, board))
  await computation.ComputeAsync()
  let got14 = computation.output[0][0]

  computation = network28.new_computation()
  computation.AddInput(EncodeCardsForNN(hand, board))
  await computation.ComputeAsync()
  let got28 = computation.output[0][0]



  console.log(hand.join(''), board.join(''), expected, got28.toFixed(2), got14.toFixed(2))
}

async function acc() {
  let cards = split_cards(7, make_deal(2))
  let hand = cards.slice(0, 2)
  let board: Card[] = []


  await acc_hand_board(hand, board)

  board = cards.slice(2, 5)

  await acc_hand_board(hand, board)

  board = cards.slice(2, 6)

  await acc_hand_board(hand, board)

  board = cards.slice(2, 7)

  await acc_hand_board(hand, board)
}

export function test_acc_main(nb: number = 100) {
  for (let i = 0; i < nb; i++) {
    acc()
  }
}
