import { hand_rank, set_hand_rank_eval, shuffle, cards, Stack, PotShare, Pot, Card, RoundN, RoundNPov } from 'lheadsup'
import { Player } from './headsup_ai'
import { Dests } from 'lheadsup'

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
  act(history: RoundNPov[], round: RoundNPov, dests: Dests) {
    let res = Search.begin(round)
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

let cache: any = {}
function ehs(hand: Card[], board: Card[]) {
  let nb = 100
  let ahead = 0

  if (board.length === 0) {
    let i = cache[hand.join('')]
    if (i) {
      return i
    }
  }

  for (let i = 0; i < nb; i++) {
    let op = card_outs([], 2)
    let board_rest = card_outs(board, 5 - board.length)

    let my_hand = [...hand, ...board, ...board_rest]
    let op_hand = [...op, ...board, ...board_rest]

    if (hand_rank(my_hand).hand_eval >= hand_rank(op_hand).hand_eval) {
      ahead ++;
    }
  }
  let res = ahead / nb

  if (board.length === 0) {
    cache[hand.join('')] = res
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

function model_value(round: RoundNPov) {
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

  let strength = ehs(round.stacks[0].hand!, middle)

  let stack_risk_factor = (safe_stack / 3000) -1

  let fold_win_factor = foldwins[0] / 6000
  let fold_loss_factor = - (foldwins[1] / 6000)
  let showdown_factor = showdown_value / 6000

  let strength_showdown_equity = - Math.abs(strength - showdown_factor)

  let strength_fold_win_equity = fold_win_factor - strength

  let strength_fold_loss_equity = 1 - Math.abs(strength - fold_loss_factor)

  /*
  w2990 f2980 30-1
  w0    f2980 3020-1
  f2990 w2980 30-2
  s2980 s2980 40-12
  s0    s0    6000-12
 */


  let res = (stack_risk_factor + strength_fold_win_equity + strength_showdown_equity + strength_fold_loss_equity) / 4

  //console.log(res, round.fen, stack_risk_factor, fold_win_factor, fold_loss_factor, strength_showdown_equity, strength, strength_fold_loss_equity)
 
  return res
}

function play_move(round: RoundN, move: Move) {
  round.act(move)

  // skip dealer moves
  while (true) {
    let { dests } = round
    // dont skip phase
    if (false && dests.phase) {
      round.act('phase')
    } else if (dests.win) {
      round.act('win')
    } else if (dests.share) {
      round.act('share')
    } else if (dests.showdown) {
      round.act('showdown')
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
  after_model: RoundN
  
  constructor(
    readonly before: RoundNPov,
    readonly before_phase: RoundN,
    readonly move?: Move) {
      if (before_phase.dests.phase) {
        this.after_model = generate_random_pov_model(before_phase.pov(1))
        this.after_model.act('phase')
      } else {
        this.after_model = before_phase
      }
      this.after = this.after_model.pov(1)
    }

  get value() {
    return model_value(this.after)
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
        raises = [...new Set(raises)]
        raises = removeCloseNumbers(raises, min_raise)
        for (let i = 0; i < raises.length; i++) {
          for (let j = 0; j < raises.length; j++) {
            let x = raises[i],
              y = raises[j]
          }
        }

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

  static begin = (round: RoundNPov) => {
    let state = State.make_from_round(round)
    let search = new Search(state)
    let edge = search.search()
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

  simulate_random_playout() {
    let current_state = this.history.last

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
    // console.log(i, current_state.after.fen, current_state.move, current_state.value)
    return current_state.value
  }


  backpropagate(_node: Node, value: number) {
    let node: Node | undefined = _node
    while (node !== undefined) {
      node.visits++;
      node.values += value
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


  search() {
    let nb_iterations = 0
    while (true) {
      const [selected_node, moves_to_node] = this.selection()
      this.expand_node(selected_node, moves_to_node)
      const values = [...Array(5).keys()].map(_ => this.simulate_random_playout())
      let value = sum(values) / values.length
      if (moves_to_node[0] === 'call 10' || moves_to_node[0] === 'fold') {
        //console.log(moves_to_node, value, selected_node)
        //console.log(moves_to_node, value)
      }
      //let value = this.simulate_random_playout()

      //console.log(moves_to_node.length, value, this.history.last.after.fen, moves_to_node.join(' '))
      /*
      if (moves_to_node[0] === 'call 10') {
        //console.log(moves_to_node.join(' '), value)
        //console.log(moves_to_node.join(' '), value, values.join('x'))
      }
     */
      this.backpropagate(selected_node, value)

      //console.log(nb_iterations, selected_node.visits, selected_node.values, moves_to_node.join(' '))
      if (nb_iterations++ > 1000) {
        break
      }
    }

    console.log(this.root.children.map(_ => [_.parent!.move, _.visits, _.values, _.values / _.visits]))
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

function tests() {

  let res,
  round

  round = RoundNPov.from_fen(`10-20 2 | @2990 KsQd sb-0-0-10 / i2980 bb-0-0-20 $!`)
  res = Search.begin(round)
  console.log(round.fen, res)
}

model_tests()
//tests()
