import { cards, Card, shuffle, lookup_cards } from 'lheadsup'

export function card_outs(excludes: Card[]) {
  return cards.filter(_ => !excludes.includes(_))
}

/* https://en.wikipedia.org/wiki/Effective_hand_strength_algorithm */
export function ehs(hs: number, npot: number, ppot: number) {
  return hs * (1 - npot) + (1 - hs) * ppot
}

export function hs(hand: [Card, Card], flop: [Card, Card, Card], tr: Card[]) {

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


export function hp(hand: [Card, Card], flop: [Card, Card, Card], tr: Card[]) {
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
  let boardcards = [...flop, ...tr]
  let cards = [...hand, ...boardcards]
  let ourrank = lookup_cards(cards)

  card_outs(cards).forEach(c1 => {
    card_outs([...cards, c1]).forEach(c2 => {
      let opprank = lookup_cards([...boardcards, c1, c2])
      if (ourrank > opprank) { index = ahead } 
      else if (ourrank === opprank) { index = tied } 
      else { index = behind }

      HPTotal[index] += 1;

      (tr[0] ? [tr[0]] : 
       card_outs([...cards, c1, c2])).forEach(turn => {
        (tr[1] ? [tr[1]] : 
         card_outs([...cards, c1, c2, turn])).forEach(river => {

          let board = [...boardcards, turn, river]
          let ourbest = lookup_cards([...hand, ...boardcards])
          let oppbest = lookup_cards([c1, c2, ...boardcards])

          if (ourbest > oppbest) { HP[index][ahead] += 1 }
          else if (ourbest === oppbest) { HP[index][tied] += 1 }
          else { HP[index][behind] += 1 }
        })
      })
    })
  })

  console.log(HP, HPTotal)
  let Ppot = (HP[behind][ahead] + HP[behind][tied] / 2 + HP[tied][ahead] / 2) / (HPTotal[behind] + HPTotal[tied])
  let Npot = (HP[ahead][behind] + HP[tied][behind] / 2 + HP[ahead][tied] / 2) / (HPTotal[ahead] + HPTotal[tied])

  return [Ppot, Npot]
}



export function ehs_async_batched(nb: [Card[], Card[]][]) {
  return []
}
