import { hand_rank, set_hand_rank_eval, shuffle, cards, Stack, PotShare, Pot, Card, RoundN, RoundNPov } from 'lheadsup'
import { Player } from './headsup_ai'
import { Dests } from 'lheadsup'
import { predict_strs } from './neural'

const log_throw = (() => {
  let i = 0
  return (..._: any[]) => {
    i++;
    console.log(..._)
    if (i > 10) {
      throw 3
    }

  }
})()

function removeCloseNumbers(array: number[], threshold: number) {
  const result = [];
  let sum = 0;
  let count = 0;

  for (let i = 0; i < array.length; i++) {
    sum += array[i];
    count++;

    if (i === array.length - 1 || Math.abs(array[i + 1] - array[i]) > threshold) {
      const average = sum / count;
      result.push(average);
      sum = 0;
      count = 0;
    }
  }

  return result;
}

function sum(a: number[]) {
  return a.reduce((a, b) => a + b, 0)
}


export class MCTSPlayer implements Player {
  async act(history: RoundNPov[], round: RoundNPov, dests: Dests) {
    let res = await Search.begin_async(round)
    console.log(round.fen, res)
    return res
  }
}

function select_random_move(a: Move[]) {
  let raises = a.filter(_ => _.startsWith('raise'))
  let rest = a.filter(_ => !_.startsWith('raise'))
  rest = filter_legal_moves_no_fold_if_check(rest)
  let raise_amount = a_random(raises)
  return a_random([...rest, raise_amount])
}

function filter_legal_moves_no_fold_if_check(a: Move[]) {
  let check = a.includes('check')
  if (check) {
    return a.filter(_ => !_.startsWith('fold'))
  }
  return a
}

async function ehs_async(hand: Card[], board: Card[], nb = 50, use_cache = true) {
  if (board.length === 0) {
    return ehs(hand, board, nb, use_cache)
  }


  return await predict_strs([...hand, ...board])
}

let cache: any = {}

export function ehs(hand: Card[], board: Card[], nb = 50, use_cache = true) {
  let ahead = 0

  let i = cache[hand.join('') + board.join('')]
  if (use_cache && i) {
    return i
  }

  for (let i = 0; i < nb; i++) {
    let op = card_outs([...board, ...hand], 2)
    let board_rest = card_outs([...hand, ...board, ...op], 5 - board.length)

    let my_hand = [...hand, ...board, ...board_rest]
    let op_hand = [...op, ...board, ...board_rest]

    if (hand_rank(my_hand).hand_eval >= hand_rank(op_hand).hand_eval) {
      ahead ++;
    }
  }
  let res = ahead / nb

  if (use_cache) {
    cache[hand.join('') + board.join('')] = res
  }
  return res
}

/*
let res: any = []
for (let i = 0; i < 100; i++) {
  let hand = card_outs([], 2)
  res.push([hand.join(''), ehs(hand, [])])
}
res.sort((a: any, b: any) => a[1] - b[1])
console.log(res)
console.log(ehs(['Kc', 'Qd'], []))
console.log(ehs(['Ac', 'Qd'], []))
console.log(ehs(['Ac', 'Ad'], []))
*/
//console.log(ehs(['Td', 'Qh'], ['2c', 'Jd', 'Kc']))
//
//console.log(ehs(['2s', '4h'], ['Td','Tc','6h','Qs']))
// console.log(ehs(['9s', '3c'], ['8s','Td','6s','Ah']))
//console.log(ehs(['Qs', 'Qc'], []))
//console.log(ehs(['As', 'Kc'], []))
//console.log(ehs(['As', 'Ks'], []))

async function model_value_async(round: RoundNPov) {
  let strength = await ehs_async(round.stacks[0].hand!, round.middle)

  return model_value(round, strength)
}

function model_value(round: RoundNPov, strength = ehs(round.stacks[0].hand!, round.middle)) {
  let { small_blind, pot, middle } = round

  let stacks = round.stacks.map(_ => _.stack)
  let pots = []

  if (round.pot) {
    pots.push(round.pot)

    if (round.pot.side_pots) {
      pots.push(...round.pot.side_pots)
    }
  }

  let safe_stack = stacks[0]
  let showdown_value = 0
  let foldwins = [0, 0]
  pots.forEach(pot => {
    if (pot.sides.length === 1) {
      foldwins[pot.sides[0]-1] += pot.chips
    } else {
      showdown_value += pot.chips
    }
  })

  let reveal_factor = middle.length / 5


  let [r, a, b, c, d] = [0.05, 0.27, 0.18, 0.2, 0.3]
  
  //let policy = ((strength - 0.5) / 0.5) * 0.12
  let policy = ((strength - 0.5) / 0.5) * 0.2

  a -= policy
  b += policy

  //console.log(strength, a, b, policy)
  const se = (n: number) => (n / 3000) - 1
  let res = r * reveal_factor + a * se(safe_stack) + b * (showdown_value / 6000) * strength - c * se(round.stacks[1].stack) + d * ((foldwins[0] > 2000 ? 0 : foldwins[0])/ 6000)

  //console.log(round.fen, res, reveal_factor, se(safe_stack), (showdown_value / 6000) * strength, se(round.stacks[1].stack), foldwins[0])
  if (round.stacks[0].state === 'w') {
    //console.log(round.fen, res, reveal_factor, safe_stack, showdown_value, strength, foldwins[0])
  }
 
  return res


  /*

  sb h0.5 w1000 f4000 1000-1
  sb h0.5 s1000 s4000 1000-12

  sb h0.5 w4000 f1000 1000-1
  sb h0.8 w4000 f1000 1000-1

  sb h0.1 w2990 f2980 30-1
  sb h0.5 w2990 f2980 30-1

  sb h0.8 s0    s0    6000-12
  sb h0.8 w2990 f2980 30-1

  sb h0.8 s2980 s2980 40-12

  sb h0.1 w0    f2980 3020-1
  sb h0.5 w0    f2980 3020-1
  sb h0.8 w0    f2980 3020-1

  sb h0.1 s2980 s2980 40-12
  sb h0.5 s2980 s2980 40-12

  sb h0.8 f2990 w2980 30-2
  sb h0.5 f2990 w2980 30-2
  sb h0.1 f2990 w2980 30-2

  sb h0.5 s0    s0    6000-12
  sb h0.1 s0    s0    6000-12

  sb h0.8 f3000    w3000
  sb h0.5 f3000    w3000
  sb h0.5 s0    s0    6000-12
 */

/*
I am trying to estimate the value of poker situations for texas hold'em headsup poker between two players. My model looks like this

  sb h0.5 s0    s0    6000-12

 sb = small blind (in chips)
 h  = hand strength (0-1 range)
 s0 = (s means showdown) our stack (in chips)
 s0 = (s means showdown) opponent's stack (in chips)
 6000-12 = 6000 pot (in chips) 12 means (1 and 2) meaning player 1 and player 2 is in the pot

 so this means both went allin for a showdown


another situation is:

 sb h0.8 w2990 f2980 30-1

 w means win and f means fold
 30-1 means there's 30 in the pot which player 1 has won

so in this case player 2 has folded and player 1 won the pot

one more example:

  sb h0.1 w0    f2980 3020-1

in this example player 1 has went allin player 2 has folded and player 1 has won the pot 3020 in chips

this model is the terminal situation for one round of playing cards.
the headsup match starts with each 3000 stack blinds 10-20 and blinds increase every 10 hands by 25 chips
my current goal is to dominate against some simple strategies like going all in every hand and raising minimum every hand. for this i run a tournament simulation that lasts for 10 matches.


I've tried various formulas but I couldn't get the player to play reasonably well.

some considerations that might help:

something to force the player to play his strong hands and get maximum value
something to prevent the player risking more than his hand strength
something to prevent the player folding to small raises even when his hand strength is low.

here are some specific comparisons, that I am not exactly sure how to compare:

  sb h0.5 w1000 f4500 500-1
  sb h0.5 s1000 s4000 1000-12
first case wins 1000 uncontested, second case wins 500 half of the time.

  sb h0.5 w4000 f1000 1000-1
  sb h0.8 w4000 f1000 1000-1
the stacks and wins are equal except the hand strength is different.


  sb h0.5 w1000 f4500 500-1
  sb h0.5 s500 s4500 1000-1
player 1's stack is equal in each case after winning, but in first case player 1 risked less

  sb h0.8 s0    s0    6000-12
  sb h0.5 f3000 w2900 100-2
a case between going allin with a good hand vs folding a decent hand

one drawback with my model is, in a win-fold situation i can't decide how much a player won from opponent's stack, 

for example i cant differentiate these two scenarios

player 1 bet 300 and player 2 folds
  sb h0.5 w700 f4000 300-1
or
player 1 bet 100 player 2 calls player 1 bet 100 more model can look exactly the same
  sb h0.5 w700 f4000 300-1

the difference is the starting stacks but i don't have that information. one solution is to include the starting stacks in the model, but I am not sure if this is relevant or makes any difference.


finally I am not considering advanced factors like slow playing or bluffing based on previous round history. Just looking for a game theory optimal player that plays based on odds.

*/

}

function play_move(round: RoundN, move: Move) {
  round.act(move)

  // skip dealer moves
  while (true) {
    let { dests } = round
    if (dests.phase) {
      round.act('phase')
    } else {
      break
      //h.round_act(action)
    }
  }
}

function card_outs(excludes: Card[], n: number) {
  return shuffle(cards.filter(_ => !excludes.includes(_))).slice(0, n)
}

function copy_pot(pot: Pot): Pot {
  return new Pot(pot.chips, pot.sides.slice(0), pot.side_pots?.map(_ => copy_pot(_)))
}

function copy_stack_with_hand(stack: Stack, hand?: [Card, Card]) {
  return new Stack(
    stack.state,
    stack.stack,
    stack.hand ?? hand,
    stack.bet)
}

function generate_random_pov_model(p: RoundNPov): RoundN {

  let { small_blind, button, stacks, pot, flop, turn, river, shares } = p

  let hands = [...stacks[0].hand!]

  let phase = 'p'
  let middle: any = []
  if (flop) {
    phase = 'f'
    middle.push(...flop)
  }
  if (turn) {
    phase = 't'
    middle.push(turn)
  }
  if (river) {
    phase = 'r'
    middle.push(river)
  }
  let reveals = card_outs([...hands, ...middle], 5 - middle.length + 2)

  let op_hand: [Card, Card] = [reveals.pop()!, reveals.pop()!]
  middle.push(...reveals)
  
  let m_stacks = [
    copy_stack_with_hand(stacks[0]),
    copy_stack_with_hand(stacks[1], op_hand)
  ]

  let m_pot = !!pot ? copy_pot(pot) : undefined
  let m_shares = shares

  let res = new RoundN(small_blind, button, m_stacks, m_pot, middle, phase, m_shares)
  //console.log(p.fen, res.fen, 'XX')
  return new RoundN(small_blind, button, m_stacks, m_pot, middle, phase, m_shares)
}

function a_random<A>(a: A[]) {
  return a[Math.floor(Math.random() * a.length)]
}

type Move = string

class State {

  static make = (before: RoundNPov, move: Move) => {
    let after_model = generate_random_pov_model(before)
    play_move(after_model, move)
    return new State(before, after_model, move)
  }

  static make_from_round = (round: RoundNPov) => {
    let after_model = generate_random_pov_model(round)
    return new State(round, after_model)
  }

  after: RoundNPov
  
  constructor(
    readonly before: RoundNPov,
    readonly after_model: RoundN,
    //readonly before_phase: RoundN,
    readonly move?: Move) {
      /*
      if (before_phase.dests.phase) {
        this.after_model = generate_random_pov_model(before_phase.pov(1))
        this.after_model.act('phase')
      } else {
        this.after_model = before_phase
      }
     */
      this.after = this.after_model.pov(1)
    }

  get is_me_who_just_moved() {
    return this.before.stacks[0].state === '@'
  }

  get value() {
    return model_value(this.after)
  }

  get value_async() {
    return model_value_async(this.after)
  }

  get is_terminal() {
    return this.after_model.dests.fin
  }

  perform_action(move: Move) {
    return State.make(this.after, move)
  }

  get_legal_moves() {
    let { dests } = this.after_model

    let res = []

    if (dests.raise) {
      let { match, min_raise, cant_match, cant_minraise } = dests.raise

      if (cant_match !== undefined) {
        res.push(`raise ${cant_match}-0`)
      } else if (cant_minraise !== undefined) {
        res.push(`raise ${match}-${cant_minraise}`)
      } else {

        let pot = this.after_model.pot?.total_pot ?? 0
        let stack = this.after_model.stacks[0].stack - match
        if (pot === 0) {
          pot = sum(this.after_model.stacks.map(_ => _.bet?.total ?? 0))
        }

        let raises = 
          [min_raise, pot / 3, pot / 2, pot, pot * 1.2, pot * 2, stack].map(_ => Math.floor(_)).filter(_ => _ <= stack && _ >= min_raise)
        raises = removeCloseNumbers(raises, min_raise)

        res.push(...raises.map(raise => `raise ${match}-${raise}`))
      }
    }
    if (dests.call) {
      res.push(`call ${dests.call.match}`)
    }
    if (dests.check) {
      res.push('check')
    }
    if (dests.fold) {
      // pot committed
      let bets = sum(this.after_model.stacks.map(_ => _.bet?.total ?? 0))
      let pot = this.after_model.pot?.total_pot ?? 0
      if (bets + pot < 4000) {
        res.push('fold')
      }
    }

    if (!dests.fin) {
      //console.log(dests.fen, res)
    }

    return res
  }

}

class Edge {

  after: Node

  constructor(
    readonly before: Node,
    readonly move: Move) {
      this.after = new Node(this)
    }

}

class Node {

  edges: Edge[]
  visits: number
  values: number

  constructor(public parent?: Edge) {
               this.edges = []

               this.visits = 0
               this.values = 0
  }

  get children() {
    return this.edges.map(_ => _.after)
  }
}

class History {

  rest: State[]
  constructor(readonly root: State) {
    this.rest = []
  }

  get length() {
    return this.rest.length
  }

  trim(length: number) {
    this.rest.splice(length)
  }

  append(moves: Move[]) {
    moves.forEach(_ => this.rest.push(this.last.perform_action(_)))
    //console.log(this.rest.map(_ => _.after_model.fen))
  }

  get last() {
    return this.rest[this.rest.length - 1] ?? this.root
  }
}

export class Search {

  static begin_async = async (round: RoundNPov) => {
    let state = State.make_from_round(round)
    let search = new Search(state)
    let edge = await search.search()
    //console.log(search.root.edges)
    return edge.move
  }

  root: Node
  explorationConstant: number

  history: History
  played_history: History

  constructor(readonly root_state: State) {
    this.history = new History(root_state)
    this.played_history = new History(root_state)

    this.root = new Node()
    this.explorationConstant = Math.sqrt(2)
  }

  select_child(node: Node) {
    const total_visits = (node.visits || 1)
    const children = node.children

    const ucb_values = children.map(child => {
      const exploitation = child.values / (child.visits || 1)
      const exploration = Math.sqrt(
        (2 * Math.log(total_visits)) / (child.visits || 1)
      )
      return exploitation + this.explorationConstant * exploration
    })

    //console.log(ucb_values, children.map(_ => [_.values, _.visits, _.parent!.move]))
    //log_throw(ucb_values, children.map(_ => [_.values, _.visits, _.parent!.move]))
    const max_UCB_value = Math.max(...ucb_values)
    const selected_child_index = ucb_values.indexOf(max_UCB_value)
    return children[selected_child_index]
  }

  expand_node(node: Node, moves_to_node: Move[]) {
    this.history.trim(this.played_history.length)
    this.history.append(moves_to_node)

    if (this.history.last.is_terminal) {
      return
    }

    let possible_actions = this.history.last.get_legal_moves()
    possible_actions = filter_legal_moves_no_fold_if_check(possible_actions)

    /*
    if (moves_to_node.join('') + possible_actions.join('') === 'foldfold') {
      console.log(moves_to_node, possible_actions)
      console.log(this.history.rest.map(_ => _.before.fen + _.move + _.after.fen))
      throw 2
    }
   */
    possible_actions.forEach(action => {
      let new_edge = new Edge(node, action)
      node.edges.push(new_edge)
    })
  }


  async simulate_random_playout_async() {
    let current_state = this.history.last

    let { is_me_who_just_moved } = current_state

    let i = 0
    while (!current_state.is_terminal) {
      i++
      const random_action = select_random_move(current_state.get_legal_moves())
      if (!random_action) {
        break
      }
      current_state = current_state.perform_action(random_action)
    }
    /*
    if (i === 0 && current_state.value > 0.6) {
      console.log('i === 0', current_state.before.fen, current_state.after.fen)
      throw 3
    }
   */
    //console.log(i, current_state.after.fen, current_state.move, current_state.value)
    let value = await current_state.value_async
    return is_me_who_just_moved ? value : - value
  }

  simulate_random_playout() {
    let current_state = this.history.last

    let { is_me_who_just_moved } = current_state

    let i = 0
    while (!current_state.is_terminal) {
      i++
      const random_action = select_random_move(current_state.get_legal_moves())
      if (!random_action) {
        break
      }
      current_state = current_state.perform_action(random_action)
    }
    /*
    if (i === 0 && current_state.value > 0.6) {
      console.log('i === 0', current_state.before.fen, current_state.after.fen)
      throw 3
    }
   */
    //console.log(i, current_state.after.fen, current_state.move, current_state.value)
    return is_me_who_just_moved ? current_state.value : - current_state.value
  }


  backpropagate(_node: Node, value: number) {
    let node: Node | undefined = _node
    while (node !== undefined) {
      node.visits++;
      node.values += value
      value = -value
      node = node.parent?.before
    }
  }


  selection(): [Node, Move[]] {
    let current_node = this.root
    
    let moves_to_node = []

    while (current_node.children.length > 0) {
      if (current_node.visits === 0) {
        return [current_node, moves_to_node]
      } else {
        let _ = current_node
        //console.log(moves_to_node.length, moves_to_node.slice(0, 3))
        current_node = this.select_child(current_node)
        if (current_node.parent) {
          moves_to_node.push(current_node.parent.move)
        }
      }
    }
    return [current_node, moves_to_node]
  }


  async search() {
    let nb_iterations = 0
    while (true) {
      const [selected_node, moves_to_node] = this.selection()
      this.expand_node(selected_node, moves_to_node)
      /*
      let values = [...Array(5)].map(() => this.simulate_random_playout())
      let value = sum(values) / 5
     */
      let value = await this.simulate_random_playout()
      //let value = this.simulate_random_playout()

      if (moves_to_node[0] !== 'fold') {
        //console.log(value, this.history.last.after.fen, moves_to_node.join(' '))
      }
      /*
      if (moves_to_node[0] === 'call 10') {
        //console.log(moves_to_node.join(' '), value)
        //console.log(moves_to_node.join(' '), value, values.join('x'))
      }
     */
      this.backpropagate(selected_node, value)

      //console.log(nb_iterations, selected_node.visits, selected_node.values, moves_to_node.join(' '))
      if (nb_iterations++ > 50) {
        break
      }
    }

    //console.log(this.root.children.map(_ => [_.parent!.move, _.visits, _.values, _.values / _.visits]))
    const best_edge = this.root.children.reduce((a: Node, b: Node) => (a.visits > b.visits ? a : b)).parent!
    return best_edge
  }
}

function model_tests() {

  /*
  w2990 f2980 30-1
  w0    f2980 3000-1
  f2990 w2980 30-2
  s2980 s2980 40-12
  s0    s0    6000-12
 */

  let round = RoundNPov.from_fen(`10-20 2 | w2990 KsQd / f2980 $ 30-1 !`)
  console.log(round.fen, model_value(round))

  round = RoundNPov.from_fen(`10-20 2 | w0 KsQd / f2980 2h2c $ 3020-1 !`)
  console.log(round.fen, model_value(round))

  round = RoundNPov.from_fen(`10-20 2 | f2990 KsQd / w2980 $ 30-2 !`)
  console.log(round.fen, model_value(round))
}

async function tests() {

  let res,
  round

  round = RoundNPov.from_fen(`85-170 2 | @3366 AdKd call-85-85 / a0 allin-170-0-2294 $!`)
  res = await Search.begin_async(round)
  console.log(round.fen, res)


  round = RoundNPov.from_fen(`10-20 2 | @2652 QsQh call-10-10 / a0 allin-20-0-3308 $!`)
  res = await Search.begin_async(round)
  console.log(round.fen, res)


  for (let i = 0; i < 3; i++) {
    round = RoundNPov.from_fen(`10-20 2 | @4876 TsTc / i1024 raise-0-0-20 $ 80-12 !9d9s2c`)
    res = await Search.begin_async(round)
    console.log(round.fen, res)
  }



  round = RoundNPov.from_fen(`10-20 1 | @2130 9d5d raise-0-20-340 / i1790 raise-20-340-340 $ 1020-12 !6d5sAs4hJc`)
  res = await Search.begin_async(round)
  console.log(round.fen, res)



  round = RoundNPov.from_fen(`10-20 1 | @2884 9s3c check-0 / i2864 raise-0-0-20 $ 232-12 !8sTd6sAh`)
  res = await Search.begin_async(round)
  console.log(round.fen, res)

  round = RoundNPov.from_fen(`10-20 1 | @2800 5h4h raise-0-0-160 / i2640 raise-0-160-160 $ 80-12 !TsQdQc`)
  res = await Search.begin_async(round)
  console.log(round.fen, res)

  round = RoundNPov.from_fen(`10-20 1 | @2600 2s4h raise-0-0-240 / i2560 raise-0-240-240 $ 120-12 !TdTc6hQs`)
  res = await Search.begin_async(round)
  console.log(round.fen, res)



  round = RoundNPov.from_fen(`10-20 1 | @2960 TdQh / i2960 $ 80-12 !2cJdKc`)
  res = await Search.begin_async(round)
  console.log(round.fen, res)


  round = RoundNPov.from_fen(`10-20 2 | @2990 KsQd sb-0-0-10 / i2980 bb-0-0-20 $!`)
  res = await Search.begin_async(round)
  console.log(round.fen, res)
}

//model_tests()
tests()
