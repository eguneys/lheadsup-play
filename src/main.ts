import { ehs_train_main } from './ehs_train'
import { network } from './neural'

import { Card, split_cards, make_deal } from 'lheadsup'
import { ehs } from '../src/mcts'
import { encode_suit, ranks } from './ehs_train'

function EncodeCardsForNN(hand: Card[], board: Card[]) {
  let res = []
  for (let i = 0; i < 2; i++) {
    let [rank, suit] = hand[i]
    res[i * 2 + 0] = encode_suit[suit]
    res[i * 2 + 1] = ranks.indexOf(rank) + 1
  }
  for (let i = 0; i < 5; i++) {
    let card = board[i]
    if (card) {
      let [rank, suit] = card
      res[2 * 2 + i * 2 + 0] = encode_suit[suit]
      res[2 * 2 + i * 2 + 1] = ranks.indexOf(rank) + 1
    }
  }

  res[2 * 7] = 1

  return res
}

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
