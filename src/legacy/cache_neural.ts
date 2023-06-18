import { InputPlanes, NetworkComputation } from './neural'

class WorkItem {

  static empty = (hash: number, lock: CachedNNRequest) => {
    let res = new WorkItem(hash, -1, [])
    res.lock = lock
    return res
  }

  lock?: CachedNNRequest

  constructor(
    readonly hash: number,
    readonly idx_in_parent: number,
    readonly probabilities_to_cache: number[]) {}
}

class CachedNNRequest {
  q!: number
}

class NNCache {

  res: Map<number, CachedNNRequest> = new Map()

  insert(hash: number, req: CachedNNRequest) {
    [...this.res.keys()].slice(500).forEach(key => this.res.delete(key))
    this.res.set(hash, req)
  }

  lock(hash: number) {
    return this.res.get(hash)
  }
}


export class CachingComputation {

  batch: WorkItem[] = []
  cache: NNCache = new NNCache()

  constructor(readonly parent: NetworkComputation) {
  }


  async compute_async() {
    await this.parent.ComputeAsync()

    this.batch.forEach(item => {
      if (item.idx_in_parent === -1) {
        return
      }
      let req = new CachedNNRequest()
      req.q = this.parent.GetQVal(item.idx_in_parent)
      /*
      let idx = 0
      for (let x of item.probabilities_to_cache) {
        req.p[idx++] = [x, this.parent.GetPVal(item.idx_in_parent, x)]
      }
     */
      this.cache.insert(item.hash, req)
    })
  }

  add_input(hash: number,
            input_planes: InputPlanes,
            probabilities_to_cache: number[]) {
              if (this.add_input_by_hash(hash)) {
                return
              }
              this.batch.push(
                new WorkItem(hash, this.parent.GetBatchSize(), probabilities_to_cache))

              this.parent.AddInput(input_planes)
            }

   add_input_by_hash(hash: number) {
     let lock = this.cache.lock(hash)
     if (!lock) {
       return false
     }
     this.batch.push(WorkItem.empty(hash, lock))
   }

   get_cache_misses() {
     return this.parent.GetBatchSize()
   }

   get_Q_val(sample: number) {
     let item = this.batch[sample]
     if (item.idx_in_parent >= 0) {
       return this.parent.GetQVal(item.idx_in_parent)
     }
     return item.lock!.q
   }
}
