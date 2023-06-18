import { parseArgs } from 'node:util'
import { ehs_stats } from './ehs_stats'
import { gen_ehs_train } from './ehs_train'

try {

  const options = {
    stats: {
      type: 'boolean' as 'boolean',
      short: 's'
    },
    train: {
      type: 'string' as 'string',
      short: 't'
    }
  }

  const { values } = parseArgs({ options })
  main(parse_values(values))
} catch (e) {
  console.log((e as Error).message)
  process.exit(-1)
}

function parse_values(args: any): CmdLineArgs {

  if (args.stats) {
    return { stats: true }
  }

  switch (args.train) {
    case 'flop': return { train: 'flop' }
    case 'turn': return { train: 'turn' }
    case 'river': return { train: 'river' }
    case 'mix': return { train: 'mix' }
    default: return { train: 'mix' }
  }
}

type CmdLineArgs = {
  stats?: boolean,
  train?: 'flop' | 'turn' | 'river' | 'mix'
}

function main(args: CmdLineArgs) {
  if (args.stats) {
    console.log('Stats')
    ehs_stats()
  } else if (args.train) {

    console.log(`Train ${args.train}`)
    gen_ehs_train()
  }
}
