import { shuffle, cards, Stack, PotShare, Pot, Card, RoundN, RoundNPov } from 'lheadsup'
import { Player } from './headsup_ai'
import { Dests } from 'lheadsup'



export class MCTSPlayer implements Player {
  act(history: RoundNPov[], round: RoundNPov, dests: Dests) {
    return Search.begin(round)
  }
}


function ehs(_: Card[]) {
  console.log(_.join(''))
  return Math.random()
}

function model_value(round: RoundN) {

  let { dests } = round

  if (dests.fin) {
    let stacks = round.stacks.map(_ => _.stack)
    return stacks[0] / (stacks[0] + stacks[1])
  }

  let { phase, small_blind, pot, shares } = round

  let bets = round.stacks.map(_ => _.bet?.total ?? 0)
  let min_shared_bet = Math.min(...bets)
  let max_shared_bet = Math.max(...bets)
  let over_bet = max_shared_bet - min_shared_bet
  let shared_bet = min_shared_bet * 2
  let total_pot = pot?.total_pot ?? 0
  let stacks = round.stacks.map(_ => _.stack)

  if (shares) {
    let res = [0, 0]
    shares.map(_ => {
      let { win, back, swin } = _

      if (win) {
        res[win[0] - 1] += win[1]
      }
      if (back && back[0] === 1) {
        res[back[0] - 1] += back[1]
      }
      if (swin && swin[0] === 1) {
        res[swin[0] - 1] += swin[1]
      }
    })

    return stacks[0] + res[0] / (stacks[0] + res[0] + stacks[1] + res[1])
  } else {
    let middle,
    hand

    if (round.middle) {
      middle = []
      if (phase === 'f') {
        middle.push(...round.middle.slice(0, 3))
      } else if (phase === 't') {
        middle.push(...round.middle.slice(0, 4))
      } else if (phase === 'r') {
        middle.push(...round.middle)
      }
      hand = [...round.stacks[0].hand!, ...middle]
    }

    let strength = hand ? ehs(hand) : 1

    let stack_factor = stacks[0] / (stacks[0] + stacks[1] + over_bet + shared_bet + total_pot)
    
    return (stack_factor * 10 + strength * 30) / 40
  }
}

function play_move(round: RoundN, move: Move) {
  round.act(move)

  // skip dealer moves
  while (true) {
    let { dests } = round
    if (dests.phase) {
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
    return new State(before, after_model)
  }

  static make_from_round = (round: RoundNPov) => {
    let after_model = generate_random_pov_model(round)
    return new State(round, after_model)
  }

  after: RoundNPov
  
  constructor(
    readonly before: RoundNPov,
    readonly after_model: RoundN) {
      this.after = this.after_model.pov(1)
    }

  get value() {
    return model_value(this.after_model)
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

        let raises = 
          [min_raise, pot / 3, pot / 2, pot, pot * 1.2, pot * 2, stack].map(_ => Math.floor(_)).filter(_ => _ <= stack && _ >= min_raise)
        raises = [...new Set(raises)]

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
      res.push('fold')
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

    const max_UCB_value = Math.max(...ucb_values)
    const selected_child_index = ucb_values.indexOf(max_UCB_value)
    return children[selected_child_index]
  }

  expand_node(node: Node, moves_to_node: Move[]) {
    this.history.trim(this.played_history.length)
    this.history.append(moves_to_node)

    let possible_actions = this.history.last.get_legal_moves()

    possible_actions.forEach(action => {
      let new_edge = new Edge(node, action)
      node.edges.push(new_edge)
    })
  }

  simulate_random_playout() {
    let current_state = this.history.last

    while (!current_state.is_terminal) {
      const random_action = a_random(current_state.get_legal_moves())
      current_state = current_state.perform_action(random_action)
    }
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
      const value = this.simulate_random_playout()
      this.backpropagate(selected_node, value)

      console.log(nb_iterations, selected_node.visits, selected_node.values, moves_to_node)
      if (nb_iterations++ > 100) {
        break
      }
    }

    const best_edge = this.root.children.reduce((a: Node, b: Node) => (a.visits > b.visits ? a : b)).parent!
    return best_edge
  }
}
