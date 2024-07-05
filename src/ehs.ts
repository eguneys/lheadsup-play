import { cards, Card, lookup_cards } from 'phevaluatorjs25'

const epsilon = 1e-5
type Card2 = [Card, Card]
type Card3 = [Card, Card, Card]

export function card_outs(excludes: Card[]) {
  return cards.filter(_ => !excludes.includes(_))
}

/* https://en.wikipedia.org/wiki/Effective_hand_strength_algorithm */
export function ehs(hs: number, ppot: number, npot: number) {
  return hs * (1 - npot) + (1 - hs) * ppot
}

export function hs(hand: Card2, flop: Card3, tr: Card[]) {

  let ahead = 0,
    tied = 0,
    behind = 0
  let boardcards = [...flop, ...tr]
  let cards = [...hand, ...boardcards]
  let ourrank = lookup_cards(cards)

  card_outs(cards).forEach(c1 => {
    card_outs([...cards, c1]).forEach(c2 => {
      let opprank = lookup_cards([...boardcards, c1, c2])
      if (ourrank > opprank) { ahead += 1 }
      else if (ourrank === opprank) { tied += 1 }
      else { behind += 1 }
    })
  })

  return (ahead + tied / 2) / (ahead + tied + behind)
}


export function hp(hand: Card2, flop: Card3, tr: Card[]) {
  const ahead = 0,
    tied = 1,
    behind = 2


  let index: number

  let HP = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ],
    HPTotal = [0, 0, 0]

  let HS = [0, 0, 0]

  let boardcards = [...flop, ...tr]
  let cards = [...hand, ...boardcards]
  let ourrank = lookup_cards(cards)

  card_outs(cards).forEach(c1 => {
    card_outs([...cards, c1]).forEach(c2 => {
      let opprank = lookup_cards([...boardcards, c1, c2])
      if (ourrank > opprank) { index = ahead } 
      else if (ourrank === opprank) { index = tied } 
      else { index = behind }

      HS[index] += 1;
      
      if (tr[1]) {
        HPTotal[index] += 1;
        HP[index][index] += 1;
      } else if (tr[0]) {
        card_outs([...cards, c1, c2]).forEach(river => {
          HPTotal[index] += 1;
          let board = [...boardcards, river]
          let ourbest = lookup_cards([...hand, ...board])
          let oppbest = lookup_cards([c1, c2, ...board])

          if (ourbest > oppbest) { HP[index][ahead] += 1 }
          else if (ourbest === oppbest) { HP[index][tied] += 1 }
          else { HP[index][behind] += 1 }
        })
      } else {
        card_outs([...cards, c1, c2]).forEach(turn => {
          card_outs([...cards, c1, c2, turn]).forEach(river => {
            HPTotal[index] += 1;
            let board = [...boardcards, turn, river]
            let ourbest = lookup_cards([...hand, ...board])
            let oppbest = lookup_cards([c1, c2, ...board])

            if (ourbest > oppbest) { HP[index][ahead] += 1 }
            else if (ourbest === oppbest) { HP[index][tied] += 1 }
            else { HP[index][behind] += 1 }
          })
        })
      }
    })
  })

  let hs = (HS[ahead] + HS[tied] / 2) / (HS[ahead] + HS[tied] + HS[behind])

  let Ppot = (HP[behind][ahead] + HP[behind][tied] / 2 + HP[tied][ahead] / 2) / (HPTotal[behind] + HPTotal[tied] + epsilon)
  let Npot = (HP[ahead][behind] + HP[tied][behind] / 2 + HP[ahead][tied] / 2) / (HPTotal[ahead] + HPTotal[tied] + epsilon)

  return [hs, Ppot, Npot]
}

export function ehsp(hand: Card2, flop: Card3, turn?: Card, river?: Card) {
  let hs, ppot, npot, ehs_

  if (!turn) {
    [hs, ppot, npot] = hp(hand, flop, [])
    ehs_ = ehs(hs, ppot, npot)
  } else if (!river) {
    [hs, ppot, npot] = hp(hand, flop, [turn])
    ehs_ = ehs(hs, ppot, npot)
  } else {
    [hs, ppot, npot] = hp(hand, flop, [turn, river])
    ehs_ = ehs(hs, ppot, npot)
  }

  return [hs, ehs_, ppot, npot]
}




export function ehs_async_batched(nb: [Card[], Card[]][]) {
  return []
}
