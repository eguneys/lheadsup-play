type Model = {
  small_blind: number,
  stack0: number,
  stack1: number,
  strength: number,

}


function generate_random_model() {
}

function simulate(model: Model) {
  return 0
}


function generate_data() {
  let nb = 1000
  let data = [...Array(nb)].map(generate_random_model)
  //const values = data.map(_ => simulate(_))

  //return [data, values]
}
