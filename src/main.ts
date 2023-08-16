import { parseArgs } from 'node:util'
import { parallel_work } from './cluster'
import { ehs_stats } from './ehs_stats'
import { gen_ehs_train, TrainPhase } from './ehs_train'

try {

  const options = {
    stats: {
      type: 'boolean' as 'boolean',
      short: 's'
    },
    train: {
      type: 'string' as 'string',
      short: 't'
    },
    'batch_size': {
      type: 'string' as 'string',
      short: 'b'
    },
    'nb_chunks': {
      type: 'string' as 'string',
      short: 'c'
    },
    'folder_name': {
      type: 'string' as 'string',
      short: 'd'
    }
  }

  const { values } = parseArgs({ options })
  main(parse_values(values))
} catch (e) {
  if (typeof e === 'string') {
    console.log(e)
  } else {
    console.log((e as Error).message)
  }
  process.exit(-1)
}


function parse_values(args: any): CmdLineArgs {

  if (args.stats) {
    return { stats: true }
  }

  let train: TrainPhase
  switch (args.train) {
    case 'flop': train = 'flop'
    break
    case 'turn': train = 'turn'
    break
    case 'river': train = 'river'
    break
    case 'mix': train = 'mix'
    break
    default: train = 'mix'
  }
  let batch_size = parseInt(args.batch_size) || 1
  let nb_chunks = parseInt(args.nb_chunks) || 10
  let folder_name = args.folder_name ?? 'out_data'

  return {
    train,
    batch_size,
    nb_chunks,
    folder_name
  }
}

type CmdLineArgs = {
  stats?: boolean,
  train?: TrainPhase,
  nb_chunks?: number,
  batch_size?: number,
  folder_name?: string
}

function main(args: CmdLineArgs) {
  if (args.stats) {
    console.log('Stats')
    ehs_stats()
  } else if (args.train && args.nb_chunks && args.batch_size && args.folder_name) {
    const { nb_chunks, train, batch_size, folder_name } = args
    console.log(`Train ${args.train} ${args.nb_chunks}x${args.batch_size}`)
    parallel_work((cpus, id) => {
      return gen_ehs_train(train, Math.ceil(nb_chunks / cpus), batch_size, `${folder_name}/d_${id}`)
    }, 1)
  } else {
    throw "Nothing to do"
  }
}
