import { EncodeCardsForNN, InputPlanes, Network, NetworkComputation } from './neural'
import { CachingComputation } from './cache_neural'

function bisect<A>(items: A[], x: A, a_is_smaller: (a: A, b: A) => boolean, lo = 0, hi = items.length) {
  var mid;
  while (lo < hi) {
    mid = Math.floor((lo + hi) / 2);
    if (a_is_smaller(x, items[mid])) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

function insort<A>(items: A[], x: A, a_is_smaller: (a: A, b: A) => boolean) {
  items.splice(bisect(items, x, a_is_smaller), 0, x);
}

/* https://stackoverflow.com/questions/15621145/partial-sort-in-javascript */
function partialSort<A>(items: A[], k: number, a_is_smaller: (a: A, b: A) => boolean) {
    var smallest = items.slice(0, k).sort(),
        max = smallest[k-1];
    for (var i = k, len = items.length; i < len; ++i) {
        var item = items[i];
        if (a_is_smaller(item, max)) {
            insort(smallest, item, a_is_smaller);
            smallest.length = k;
            max = smallest[k-1];
        }
    }
    return smallest;
}

function Hash(val: number) {
  return 0xfad0d7f2fbb059f1 * (val + 0xbaad41cdcb839961) +
    0x7acec0050bf82f43 * ((val >> 31) + 0xd571b3a92b1b2755);
}

function HashCat(hash: number, x = 0) {
  hash ^= 0x299799adf0d95def + Hash(x) + (hash << 6) + (hash >> 2);
  return hash;
}

function HashCatL(vl: number[]) {
  let hash = 0
  vl.forEach(x => hash = HashCat(hash, x))
  return hash
}

type GameResult = 'whitewon' | 'blackwon'

const Cpuct = 1.745
const CpuctFactor = 3.894
const CpuctBase = 38739
const FpuValue = 0.330

function GetFpu(node: Node, is_root_node: boolean) {
  let value = FpuValue
  return -node.get_Q() - value * Math.sqrt(node.get_visited_policy())
}

function ComputeCpuct(N: number, is_root_node: boolean) {
  let init = Cpuct
  let k = CpuctFactor
  let base = CpuctBase

  return init + (k * Math.log((N + base) / base))
}

const MiniBatchSize = 256

class NodeTree {

  current_head!: Node
  history: PositionHistory = new PositionHistory()


  reset_to_position(fen: string) {
    let board = Board.from_fen(fen)

    this.current_head = new Node(undefined, 0)

    this.history.reset(board)
  }

  get_current_head() {
    return this.current_head
  }

  get_position_history() {
    return this.history
  }
}

function EncodePositionForNN(history: PositionHistory) {
  //let { hand, board } = history.last.us_board

  //return EncodeCardsForNN(hand, board)
  return []
}

class Move {

  as_nn_index() {
    return 0
  }
}

class Board {

  static from_fen = (fen: string) => {
    return new Board()
  }

  generate_legal_moves() {
    return []
  }

  apply_move(m: Move) {

    return this
  }

  hash() {
    return HashCatL([])
  }
}

class Position {

  static from_board = (board: Board) => {
    return new Position(board)
  }

  static from_move = (parent: Position, m: Move) => {
    return new Position(parent.us_board.apply_move(m))
  }

  constructor(readonly us_board: Board) { }

  hash() {
    return HashCat(this.us_board.hash())
  }

  get_board() {
    return this.us_board
  }
}

class PositionHistory {

  positions!: Position[]

  reset(board: Board) {
    this.positions = []
    this.positions.push(Position.from_board(board))
  }

  get length() {
    return this.positions.length
  }

  get last() {
    return this.positions[this.positions.length - 1]
  }

  hash_last() {
    let hash = 0
    this.positions.forEach(pos => hash = HashCat(hash, pos.hash()))
    return hash
  }

  append(m: Move) {
    this.positions.push(Position.from_move(this.last, m))
  }

  trim(nb: number) {
    this.positions.splice(nb)
  }
}


class Edge {

  static from_move_list = (moves: Move[]) => {
    return moves.map(_ => new Edge(_))
  }

  constructor(readonly move: Move) {}

  get_move() {
    return this.move
  }
}

class EdgeAndNode {

  constructor(readonly edge?: Edge, readonly node?: Node) {}

  reset() {
  
  }

  get_move() {
    return this.edge ? this.edge.get_move() : new Move()
  }

  get_Q(default_q: number) {
    return (this.node && this.node.get_n() > 0) ? this.node.get_Q() : default_q
  }

  get_n() {
    return this.node ? this.node.get_n() : 0
  }

  get_n_started() {
    return this.node ? this.node.get_n_started() : 0
  }
}

class VisitedNodeIterator {

  get iterator(): Node[] {
    return this.parent_node.children.filter(n => !(n.get_n() === 0 && n.get_n_in_flight() === 0))
  }

  constructor(readonly parent_node: Node) {}
}

class EdgeIterator {

  get node() {
    return this.parent_node.children[this.current_idx]
  }

  get edge() {
    return this.node.edge
  }

  get base() {
    return new EdgeAndNode(this.edge, this.node)
  }

  advance() {
    this.current_idx++
  }

  get iterator(): EdgeIterator[] {
    return [...Array(this.parent_node.children.length - this.current_idx - 1).keys()].map(i => new EdgeIterator(this.parent_node, i + this.current_idx))
  }

  get_or_spawn_node(parent: Node) {
    if (this.node) {
      return this.node
    }
    let new_node = new Node(this.parent_node, this.current_idx)
    this.parent_node.children.splice(this.current_idx, 0, new_node)
    return new_node
  }

  constructor(readonly parent_node: Node, 
              public current_idx = 0) {}
}

class Node {

  children: Node[] = []
  _edges?: Edge[]

  get siblings() {
    if (this.parent) {
      return this.parent.children
    }
  }

  get edge() {
    if (this.parent) {
      return this.parent._edges![this.index]
    }
  }

  n: number = 0
  n_in_flight: number = 0
  wl: number = 0
  terminal_type: string

  constructor(readonly parent: Node | undefined, readonly index: number) {
    this.terminal_type = 'nonterminal'
  }

  get visited_nodes() {
    return new VisitedNodeIterator(this)
  }

  get edges() {
    return new EdgeIterator(this)
  }

  get_parent() {
    return this.parent
  }

  adjust_for_terminal(v: number, multivisit: number) {
    this.wl += multivisit * v / this.n
  }

  increment_n_in_flight(multivisit: number) {
    this.n_in_flight += multivisit
  }

  finalize_score_update(v: number, multivisit: number) {
    this.wl += multivisit * (v - this.wl) / (this.n + multivisit)

    this.n += multivisit
    this.n_in_flight -= multivisit
  }

  cancel_score_update(multivisit: number) {
    this.n_in_flight -= multivisit
  }

  try_start_score_update() {
    if (this.n === 0 && this.n_in_flight > 0) {
      return false
    }
    this.n_in_flight++;
    return true
  }

  make_terminal(result: GameResult, type = 'endofgame') {
    this.terminal_type = type
    if (result === 'whitewon') {
      this.wl = 1
    } else if (result === 'blackwon') {
      this.wl = -1
    }
  }

  create_edges(moves: Move[]) {
    this._edges = Edge.from_move_list(moves)
  }

  is_terminal() {
    return this.terminal_type !== 'nonterminal'
  }

  get_visited_policy() {
    let sum = 0
    return sum
  }

  get_children_visits() {
    return this.n > 0 ? this.n - 1 : 0
  }

  get_n() {
    return this.n
  }

  get_n_in_flight() {
    return this.n_in_flight
  }

  get_n_started() {
    return this.n + this.n_in_flight
  }

  get_v() {
    return this.wl
  }

  get_Q() {
    return this.wl
  }

  get_num_edges() {
    return this.num_edges
  }

  get num_edges() {
    return this._edges!.length
  }
}

class NodeToProcess {

  static Visit = (node: Node, depth: number) => {
    return new NodeToProcess(false, node, depth, 1, 0)
  }

  static Collision = (node: Node, depth: number, collision_count: number, max_count: number) => {
    return new NodeToProcess(true, node, depth, collision_count, max_count)
  }

  constructor(readonly is_collision: boolean, 
              readonly node: Node,
              readonly depth: number, 
              readonly multivisit: number,
              readonly max_count: number) {
  }


  is_cache_hit!: number
  hash!: number
  input_planes!: InputPlanes
  probabilities_to_cache!: number[]
  nn_queried!: boolean
  moves_to_visit!: Move[]
  v!: number

  is_extendable() {
    return !this.is_collision && !this.node.is_terminal()
  }
}

export class SearchBatched {

  extend_node(node: Node, depth: number, moves_to_node: Move[], history: PositionHistory) {
    history.trim(this.played_history.length)
    for (let i = 0; i < moves_to_node.length; i++) {
      history.append(moves_to_node[i])
    }

    let board = history.last.get_board()
    let legal_moves = board.generate_legal_moves()

    if (legal_moves.length === 0) {
      node.make_terminal('whitewon')
      return
    }


    node.create_edges(legal_moves)
  }

  pick_nodes_to_extend_task(node: Node | undefined, 
                            base_depth: number, 
                            collision_limit: number,
                            moves_to_base: Move[], 
                            receiver: NodeToProcess[]) {

    let vtp_buffer: number[][] = []
    let visits_to_perform: number[][] = []
    let vtp_last_filled: number[] = []
    let current_path: number[] = []
    let moves_to_path = moves_to_base

    let current_util = []

    let current_score = []
    let current_nstarted = []
    let cur_iters: EdgeIterator[] = []

    let best_edge,
    second_best_edge

    let best_node_n = this.current_best_edge.get_n()

    let passed_off = 0
    let completed_visits = 0

    let is_root_node = node === this.root_node
    let max_limit = Number.MAX_SAFE_INTEGER

    current_path.push(-1)
    while (current_path.length > 0) {
      if (current_path[current_path.length - 1] === -1) {


        let cur_limit = collision_limit

        if (current_path.length > 1) {
          cur_limit = (visits_to_perform[visits_to_perform.length - 1])
          [current_path[current_path.length - 2]]
        }

        if (node!.get_n() === 0 || node!.is_terminal()) {
          if (is_root_node) {
            if (node!.try_start_score_update()) {
              cur_limit -= 1
              this.minibatch.push(NodeToProcess.Visit(
                node!, current_path.length + base_depth))
              completed_visits++;
            }
          }

          if (cur_limit > 0) {
            let max_count = 0
            if (cur_limit === collision_limit && base_depth === 0 &&
                max_limit > cur_limit) {
              max_count = max_limit
            }
            receiver.push(NodeToProcess.Collision(
              node!, current_path.length + base_depth,
              cur_limit, max_count))
            completed_visits += cur_limit
          }
          node = node!.get_parent()
          current_path.pop()
          continue
        }

        if (is_root_node) {
          node!.increment_n_in_flight(cur_limit)
        }

        if (vtp_buffer.length > 0) {
          visits_to_perform.push(vtp_buffer[vtp_buffer.length - 1])
          vtp_buffer.pop()
        } else {
          visits_to_perform.push([])
        }
        vtp_last_filled.push(-1)

        let max_needed = node!.get_num_edges()
        max_needed = Math.min(max_needed, node!.get_n_started() + cur_limit + 2)


        for (let i =0; i < max_needed; i++) {
          current_util[i] = Number.MIN_VALUE
        }

        for (let child of node!.visited_nodes.iterator) {
          let index = child.index
          let q = child.get_Q()
          current_util[index] = q
        }

        const fpu = GetFpu(node!, is_root_node)

        for (let i = 0; i < max_needed; i++) {
          if (current_util[i] === Number.MIN_VALUE) {
            current_util[i] = fpu
          }
        }

        const cpuct = ComputeCpuct(node!.get_n(), is_root_node)
        const puct_mult =
          cpuct * Math.sqrt(Math.max(node!.get_children_visits(), 1))

        let cache_filled_idx = -1

        while (cur_limit > 0) {
          let best = Number.MIN_VALUE
          let best_idx = -1
          let best_without_u = Number.MIN_VALUE
          let second_best = Number.MIN_VALUE
          let can_exit = false
          best_edge = undefined

          for (let idx = 0; idx < max_needed; idx++) {
            if (idx > cache_filled_idx) {
              if (idx === 0) {
                cur_iters[idx] = node!.edges
              } else {
                cur_iters[idx] = cur_iters[idx - 1]
                cur_iters[idx].advance()
              }
              current_nstarted[idx] = cur_iters[idx].base.get_n_started()
            }
            let nstarted = current_nstarted[idx]
            const util = current_util[idx]

            if (idx > cache_filled_idx) {
              current_score[idx] = puct_mult / (1 + nstarted) + util
              cache_filled_idx++;
            }
            if (is_root_node) {

            }

            let score = current_score[idx]
            if (score > best) {
              second_best = best
              second_best_edge = best_edge
              best = score
              best_idx = idx
              best_without_u = util
              best_edge = cur_iters[idx]
            } else if (score > second_best) {
              second_best = score
              second_best_edge = cur_iters[idx]
            }
            //if (can_exit) { break }
            if (nstarted === 0) {
              can_exit = true
            }
          }


          let new_visits = 0
          if (second_best_edge) {
            let estimated_visits_to_change_best = Number.MAX_SAFE_INTEGER

            if (best_without_u < second_best) {
              const n1 = current_nstarted[best_idx] + 1
              estimated_visits_to_change_best = Math.max(1, Math.min(puct_mult / (second_best - best_without_u) - n1 + 1, 1e9))
            }
            second_best_edge = undefined
            max_limit = Math.min(max_limit, estimated_visits_to_change_best)
            new_visits = Math.min(cur_limit, estimated_visits_to_change_best)
          } else {
            new_visits = cur_limit
          }

          if (best_idx >= vtp_last_filled[vtp_last_filled.length - 1]) {
            let vtp_array = visits_to_perform[visits_to_perform.length - 1]
            for (let i = vtp_last_filled[vtp_last_filled.length - 1] + 1; i <= best_idx; i++) {
              vtp_array[i] = 0
            }
          }
          visits_to_perform[visits_to_perform.length - 1][best_idx] += new_visits
          cur_limit -= new_visits
          let child_node = best_edge!.get_or_spawn_node(node!)

          let decremented = false
          if (child_node.try_start_score_update()) {
            current_nstarted[best_idx]++;
            new_visits -= 1
            decremented = true
            if (child_node.get_n() > 0 && !child_node.is_terminal()) {
              child_node.increment_n_in_flight(new_visits)
              current_nstarted[best_idx] += new_visits
            }
            current_score[best_idx] = puct_mult / (1 + current_nstarted[best_idx]) + current_util[best_idx]
          }

          if ((decremented &&
               (child_node.get_n() === 0 || child_node.is_terminal()))) {
            visits_to_perform[visits_to_perform.length - 1][best_idx] -= 1
          receiver.push(NodeToProcess.Visit(child_node, current_path.length + 1 + base_depth))
          completed_visits++
            receiver[receiver.length - 1].moves_to_visit = moves_to_path
            receiver[receiver.length - 1].moves_to_visit.push(best_edge!.base.get_move())
          }
          if (best_idx > vtp_last_filled[vtp_last_filled.length - 1] &&
              (visits_to_perform[visits_to_perform.length - 1])[best_idx] > 0) {
            vtp_last_filled[vtp_last_filled.length - 1] = best_idx
          }
        }

        is_root_node = false

        /*
        for (let i = 0; i <= vtp_last_filled[vtp_last_filled.length - 1]; i++) {
          let child_limit = visits_to_perform[visits_to_perform.length - 1][i]

        }
       */
      }


      let min_idx = current_path[current_path.length - 1]
      let found_child = false
      if (vtp_last_filled[vtp_last_filled.length - 1] > min_idx) {
        let idx = -1
        for (let child of node!.edges.iterator) {
          idx++;
          if (idx > min_idx && 
              (visits_to_perform[visits_to_perform.length - 1])[idx] > 0) {
            if (moves_to_path.length !== current_path.length + base_depth) {
              moves_to_path.push(child.base.get_move())
            } else {
              moves_to_path[moves_to_path.length - 1]= child.base.get_move()
            }
            current_path[current_path.length - 1] = idx
            current_path.push(-1)
            node = child.get_or_spawn_node(node!)
            found_child = true
            break
          }
        }
      }
      if (!found_child) {
        node = node!.get_parent()
        if (moves_to_path.length !== 0) {
          moves_to_path.pop()
        }
        current_path.pop()
        vtp_buffer.push(visits_to_perform.pop()!)
        vtp_last_filled.pop()
      }
    }
  }

  do_backup_update_single_node(node_to_process: NodeToProcess) {
    let { node } = node_to_process

    if (node_to_process.is_collision) {
      return
    }

    let { v } = node_to_process
    let n_to_fix = 0
    let v_delta = 0

    for (let n = node, p; n !== this.root_node.get_parent(); n = p) {
      p = n.get_parent()

      if (n.is_terminal()) {
        v = n.get_Q()
      }

      n.finalize_score_update(v, node_to_process.multivisit)
      if (n_to_fix > 0 && !n.is_terminal()) {
        n.adjust_for_terminal(v_delta, n_to_fix)
      }

      if (!p) { break }


      if (p.is_terminal()) { n_to_fix = 0 }

      v = -v
      v_delta = -v_delta
      
      if (p === this.root_node &&
          (n !== this.current_best_edge.node &&
           this.current_best_edge.get_n() <= n.get_n())) {
        this.current_best_edge = this.get_best_child_no_temperature(this.root_node, 0)
      }
    }

    this.total_playouts += node_to_process.multivisit
    this.cum_depth += node_to_process.depth * node_to_process.multivisit
    this.max_depth = Math.max(this.max_depth, node_to_process.depth)
  }

  fetch_single_node_result(node_to_process: NodeToProcess, idx_in_computation: number) {
    if (node_to_process.is_collision) {
      return 
    }
    let { node } = node_to_process

    if (!node_to_process.nn_queried) {
      node_to_process.v = node.get_v()
      return
    }

    let { computation } = this

    let v = computation.get_Q_val(idx_in_computation)

    node_to_process.v = v
  }

  process_picked_task(start_idx: number, end_idx: number) {

    let { minibatch } = this

    let history = this.played_history

    for (let i = start_idx; i < end_idx; i++) {
      let picked_node = minibatch[i]
      let { node } = picked_node

      if (picked_node.is_extendable()) {
        this.extend_node(node, picked_node.depth, picked_node.moves_to_visit, history)

        if (!node.is_terminal()) {
          picked_node.nn_queried = true
          const hash = history.hash_last()
          picked_node.hash = hash
          picked_node.input_planes = EncodePositionForNN(history)
          let moves = picked_node.probabilities_to_cache
          node.edges.iterator.forEach(edge => {
            moves.push(edge.base.get_move().as_nn_index())
          })
        } else {

        }
      }
    }
  }

  pick_nodes_to_extend(collision_limit: number) {
    let { minibatch } = this
    let empty_movelist: Move[] = []

    this.pick_nodes_to_extend_task(this.root_node, 0, collision_limit, empty_movelist,
                                   minibatch)
     
  }

  calculate_collisions_left(nb: number) {
    return nb
  }

  get_best_child_no_temperature(parent: Node, depth: number) {
    let res = this.get_best_children_no_temperature(parent, 1, depth)
    return res.length === 0 ? new EdgeAndNode() : res[0]
  }

  get_best_children_no_temperature(parent: Node, count: number, depth: number) {
    if (parent.get_n() === 0) {
      return []
    }

    let edges = []
    for (let edge of parent.edges.iterator) {
      edges.push(edge.base)
    }

    let middle = edges.length > count ? count : edges.length

    partialSort(edges, middle, (a, b) => {

      // TODO
      return true
    })

    if (count < edges.length) {
      edges.length = count
    }

    return edges
  }

  total_playouts = 0
  cum_depth = 0
  max_depth = 0

  current_best_edge: EdgeAndNode = new EdgeAndNode()

  played_history!: PositionHistory

  shared_collisions!: [Node, number][]

  root_node!: Node

  minibatch!: NodeToProcess[]

  computation!: CachingComputation


  constructor(readonly tree: NodeTree,
              readonly network: Network) {
                this.root_node = tree.get_current_head()
                this.played_history = tree.get_position_history()
              }


  initialize_iteration(computation: NetworkComputation) {
    this.computation = new CachingComputation(computation)
    this.minibatch = []
  }

  gather_minibatch() {

    let { computation, minibatch } = this

    let minibatch_size = 0
    let cur_n = 0

    {
      cur_n = this.root_node.get_n()
    }

    let collisions_left = this.calculate_collisions_left(cur_n)

    while (minibatch_size < MiniBatchSize) {
      if (minibatch_size > 0 && computation.get_cache_misses() === 0) {
        return
      }

      let new_start = minibatch.length

      this.pick_nodes_to_extend(
        Math.min(collisions_left, MiniBatchSize - minibatch_size))

      let non_collisions = 0
      for (let i = new_start; i < minibatch.length; i++) {
        let picked_node = minibatch[i]
        if (picked_node.is_collision) {
          continue
        }
        non_collisions++;
        minibatch_size++;
      }

      let ppt_start = new_start

      this.process_picked_task(ppt_start, minibatch.length)

      for (let i = new_start; i < minibatch.length; i++) {
        if (!minibatch[i].nn_queried) { continue }
        if (minibatch[i].is_cache_hit) {
          computation.add_input_by_hash(minibatch[i].hash)
        } else {
          computation.add_input(minibatch[i].hash,
                                minibatch[i].input_planes,
                                minibatch[i].probabilities_to_cache)
        }
      }

      for (let i = new_start; i < minibatch.length; i++) {
        let picked_node = minibatch[i]

        if ((collisions_left -= picked_node.multivisit) <= 0) {
          return
        }
      }

    }
  }

  run_nn_computation() {
    return this.computation.compute_async()
  }

  fetch_minibatch_results() {
    let idx_in_computation = 0
    this.minibatch.forEach(node_to_process => {
      this.fetch_single_node_result(node_to_process, idx_in_computation)
      if (node_to_process.nn_queried) {
        idx_in_computation++;
      }
    })
  }

  do_backup_update() {
    let work_done = false
    this.minibatch.forEach(node_to_process => {
      this.do_backup_update_single_node(node_to_process)
      if (!node_to_process.is_collision) {
        work_done = true
      }
    })

    if (!work_done) {
      return
    }
    this.cancel_shared_collisions()
  }

  cancel_shared_collisions() {
    this.shared_collisions.forEach(entry => {
      let node: Node | undefined = entry[0]
      for (node = node.get_parent(); node !== this.root_node.get_parent();
           node = node!.get_parent()) {
             node!.cancel_score_update(entry[1])
           }
    })
    this.shared_collisions = []
  }

  collect_collisions() {
    let { minibatch } = this

    minibatch.forEach(node_to_process => {
      if (node_to_process.is_collision) {
        this.shared_collisions.push([node_to_process.node, node_to_process.multivisit])
      }
    })
  }

  update_counters() {

  }

  async execute_one_iteration() {

    this.initialize_iteration(this.network.new_computation())

    await this.gather_minibatch()

    this.collect_collisions()

    await this.run_nn_computation()

    this.fetch_minibatch_results()

    this.do_backup_update()

    this.update_counters()

    //await sleep(10)
  }


  async search() {
    let nb_iterations = 0
    while (true) {

      await this.execute_one_iteration()

      if (nb_iterations++ > 50) {
        break
      }
    }
  }
}
