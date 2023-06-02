import cluster from 'node:cluster'
import { availableParallelism } from 'node:os'
import process from 'node:process'

export function parallel_work(work: (nb: number) => void) {
  const numCPUs = availableParallelism()

  if (cluster.isPrimary) {
    console.log(`Primary ${process.pid} is running`)


    for (let i = 0; i < numCPUs; i++) {
      cluster.fork()
    }

    cluster.on('exit', (worker, code, signal) => {
      console.log(`worker ${worker.process.pid} died`)
    })

  } else {
    console.log(`Worker ${process.pid} started`)
    work(numCPUs)
    console.log(`Worker ${process.pid} finished`)
    process.exit()
  }
}
