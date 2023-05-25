function a_random<A>(a: A[]) {
  return a[Math.floor(Math.random() * a.length)]
}

type Move = string

class State {

  static make = () => {
    return new State(0)
  }

  constructor(public value: number) {}

  get is_terminal() {
    return true
  }

  perform_action(move: Move) {
    return this
  }

  get_legal_moves() {
    return []
  }

}

class Edge {

  after!: Node

  constructor(
    readonly before: Node,
    readonly move: Move) {}

}

class Node {

  edges: Edge[]
  visits: number
  values: number

  constructor(readonly state: State,
             public parent?: Edge) {
               this.edges = []

               this.visits = 0
               this.values = 0
  }

  get children() {
    return this.edges.map(_ => _.after)
  }
}


export class Search {

  static begin = () => {
    let state = State.make()
    let search = new Search(state)
    return search.search()
  }

  root: Node
  explorationConstant: number

  constructor(readonly root_state: State) {
    this.root = new Node(root_state)
    this.explorationConstant = Math.sqrt(2)
  }

  select_child(node: Node) {
    const total_visits = node.visits
    const children = node.children

    const ucb_values = children.map(child => {
      const exploitation = child.values / (child.visits || 1)
      const exploration = Math.sqrt(
        (2 * Math.log(total_visits)) / child.visits
      )
      return exploitation + this.explorationConstant * exploration
    })

    const max_UCB_value = Math.max(...ucb_values)
    const selected_child_index = ucb_values.indexOf(max_UCB_value)
    return children[selected_child_index]
  }

  expand_node(node: Node) {
    let possible_actions = node.state.get_legal_moves()

    possible_actions.forEach(action => {
      let new_state = node.state.perform_action(action)
      let new_edge = new Edge(node, action)
      const child_node = new Node(new_state, new_edge)
      new_edge.after = child_node
      node.children.push(child_node)
    })
  }

  simulate_random_playout(node: Node) {
    let current_state = node.state

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


  selection() {
    let current_node = this.root

    while (current_node.children.length > 0) {
      if (current_node.visits === 0) {
        return current_node
      } else {
        current_node = this.select_child(current_node)
      }
    }
    return current_node
  }


  search() {
    let nb_iterations = 0
    while (true) {
      const selected_node = this.selection()
      this.expand_node(selected_node)
      const value = this.simulate_random_playout(selected_node)
      this.backpropagate(selected_node, value)

      console.log(nb_iterations)
      if (nb_iterations++ > 10000) {
        break
      }
    }

    const best_edge = this.root.children.reduce((a: Node, b: Node) => (a.visits > b.visits ? a : b))
    return best_edge
  }
}
