import { ehs_train_main } from './ehs_train'
import { EncodeCardsForNN, network } from './neural'

import { Card, split_cards, make_deal } from 'lheadsup'
import { ehs } from '../src/mcts'

async function acc() {
  let cards = split_cards(7, make_deal(2))
  let hand = cards.slice(0, 2)
  let board: Card[] = []

  let expected = ehs(hand, board)
  let computation = network.new_computation()
  computation.AddInput(EncodeCardsForNN(hand, board))
  await computation.ComputeAsync()
  let got = computation.output[0][0]

  console.log(hand.join(''), expected, got)
}

for (let i = 0; i < 10; i++) {
  acc()
}
