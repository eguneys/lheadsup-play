import cluster from 'cluster'
//import { availableParallelism } from 'node:os'
import process from 'process'
import { cpus } from 'os'

export async function parallel_work(work: (nb: number) => Promise<void>, utilization: number = 0.5) {
  //const numCPUs = availableParallelism()
  const numCPUs = cpus().length
  let used = Math.min(numCPUs, numCPUs * utilization)

  if (cluster.isMaster) {
    console.log(`Primary ${process.pid} is running with ${used}/${numCPUs} cpus`)


    for (let i = 0; i < used; i++) {
      cluster.fork()
    }

    cluster.on('exit', (worker, code, signal) => {
      console.log(`worker ${worker.process.pid} died`)
    })

  } else {
    console.log(`Worker ${process.pid} started`)
    await work(used)
    console.log(`Worker ${process.pid} finished`)
    process.exit()
  }
}
