import * as tf from '@tensorflow/tfjs'
import { get_files, decompress_gzip } from './util'

import { Card, split_cards } from 'phevaluatorjs25'
import { encode_suit, ranks, card_sort } from './ehs_train'

const kEpsilon = 1e-5

// [[[0, 1, 2, 3], [4, 5, 6, 7]]]
//console.log(TransposeTensor([0, 1, 2, 3, 4, 5, 6, 7], [1, 2, 4], [2, 1, 0]))
function TransposeTensor(from: number[], dims: number[], order: number[] = []) {
  if (from.length !== dims.reduce((a, b) => a * b, 1)) {
    throw 'Dimensions doesnt match'
  }

  if (order.length === 0) {
    for (let i = 0; i < dims.length; i++) {
      order.unshift(dims.length - i - 1)
    }
  }

  let to: number[] = []
  let cur_idx = Array(dims.length).fill(0)
  for (let _ = 0; _ < from.length; _++) {
    let from_idx = 0
    order.forEach(i => {
      from_idx *= dims[i]
      from_idx += cur_idx[i]
    })
    to.push(from[from_idx])

    for(let i = dims.length - 1; i >= 0; i--) {
      if (++cur_idx[i] === dims[i]) {
        cur_idx[i] = 0
      } else {
        break
      }
    }
  }
  return to
}

export function EncodeCardsForNN(hand: Card[], board: Card[]) {
  hand.sort(card_sort)
  board.sort(card_sort)
  let res: number[] = []
  for (let i = 0; i < 2; i++) {
    let [rank, suit] = hand[i]
    res[i * 2 + 0] = ranks.indexOf(rank) + 1
    res[i * 2 + 1] = encode_suit[suit]
  }

  res[2 * 2] = 0xffffffff
  for (let i = 0; i < 5; i++) {
    let card = board[i]
    if (card) {
      let [rank, suit] = card
      res[2 * 2 + 1 +  i * 2 + 0] = ranks.indexOf(rank) + 1
      res[2 * 2 + 1 + i * 2 + 1] = encode_suit[suit]
    }
  }

  res[2 * 7 + 1] = 0xffffffff

  return res
}

function MakeConst(shape: number[],
                   values: number[],
                   order?: number[]) {
                     let dims = shape
                     values = TransposeTensor(values, dims, order)
                     return tf.tensor(values, shape)
                   }

export type InputPlanes = number[]

const kInputPlanes = 16

type Input = tf.SymbolicTensor


/* https://github.com/tensorflow/tfjs/issues/793 */ 
class ApplySqueezeExcite extends tf.layers.Layer {

  reshapeSize!: number

  build(inputShape: tf.Shape[]) {
    super.build(inputShape)

    this.reshapeSize = inputShape[1][1]!
  }

  computeOutputShape(inputShape: tf.Shape[]) {
    return [inputShape[1][1]!]
  }

  call(inputs: tf.Tensor[], kwargs: any) {
    this.invokeCallHook(inputs, kwargs)

    const [x, excited] = inputs

    return tf.tidy(() => {
      let [gammas, betas] = tf.split(tf.reshape(excited, [-1, 1, 1, this.reshapeSize]),
                                     2, 3)

      return tf.sigmoid(gammas).mul(x).add(betas)
    })
  }

  static get className() {
    return 'SqueezeAndExcite'
  }
}


function SqueezeAndExcite(input: Input, 
                          channels: number, 
                          weights: SEUnit, 
                          basename: string): tf.SymbolicTensor {
    const se_channels = weights.b1.length

    let pooled = tf.layers.globalAveragePooling2d({
      dataFormat: 'channelsLast',
      name: basename + '/pooled',
      trainable: false
    }).apply(input)

    let w1 = tf.tensor(weights.w1, [channels, se_channels])
    let b1 = tf.tensor(weights.b1, [se_channels])

    let squeezed = tf.layers.dense({
      units: se_channels,
      activation: 'relu',
      useBias: true,
      weights: [w1, b1],
      trainable: false
    }).apply(pooled) as tf.SymbolicTensor

    let w2 = tf.tensor(weights.w2, [se_channels, 2 * channels])
    let b2 = tf.tensor(weights.b2, [2 * channels])

    let excited = tf.layers.dense({
      units: 2 * channels,
      useBias: true,
      weights: [w2, b2],
      trainable: false
    }).apply(squeezed) as tf.SymbolicTensor

    return new ApplySqueezeExcite().apply([input, excited]) as tf.SymbolicTensor
}

function batch_norm(input: Input, name: string, channels: number, weights?: BatchNorm, scale: boolean = false) {

  if (!weights) {
    return input
  }
  let means = tf.tensor(weights.bn_means, [channels])
  let stddivs = tf.tensor(weights.bn_stddivs, [channels])
  let gammas = tf.tensor(weights.bn_gammas, [channels])
  let betas = tf.tensor(weights.bn_betas, [channels])

  let w = scale ? [gammas, betas, means, stddivs] : [betas, means, stddivs]

  return tf.layers.batchNormalization({
    axis: 3,
    epsilon: kEpsilon,
    center: true,
    scale,
    name,
    trainable: false,
    weights: w
  }).apply(input)
}

function MakeResidualBlock(
  input: Input,
  channels: number,
  weights: Residual,
  basename: string) {

    let block1 = MakeConvBlock(input, 3, channels, channels,
                               weights.conv1, basename + "/conv1")

    let block2 = MakeConvBlock(block1, 3, channels, channels,
                               weights.conv2, basename + "/conv2", false, true)

    block2 = SqueezeAndExcite(block2, channels, weights.se, basename + "/se")

    return tf.layers.reLU({ trainable: false })
    .apply(tf.layers.add().apply([input, block2])) as tf.SymbolicTensor

  }


function MakeConvBlock(
  input: Input,
  channels: number,
  input_channels: number, 
  output_channels: number, 
  weights: ConvBlock, basename: string, relu = true, bn_scale=false): tf.SymbolicTensor {
    let w_conv = MakeConst([channels, channels, input_channels, output_channels], weights.weights, [3, 2, 0, 1])

    let w = [w_conv]

    let activation: any = relu ? 'relu' : undefined

    let conv2d = tf.layers.conv2d({
      filters: output_channels,
      kernelSize: channels,
      strides: [1, 1],
      padding: 'same',
      dataFormat: 'channelsLast',
      dilationRate: [1, 1],
      useBias: false,
      weights: w
    }).apply(input) as tf.SymbolicTensor

    conv2d = batch_norm(conv2d, basename + '/bn', output_channels, weights.bn, bn_scale) as tf.SymbolicTensor
    if (activation === 'relu') {
      return tf.layers.reLU({ trainable: false }).apply(conv2d) as tf.SymbolicTensor
    } else {
      return conv2d
    }
  }



function MakeNetwork(input: Input, weights: WeightsLegacy) {

  //let filters = 64
  let filters = weights.input.weights.length / kInputPlanes / 9

  let flow = MakeConvBlock(input, 3, kInputPlanes, filters, weights.input, "input/conv", true, true)

  weights.residual.forEach((block, i) =>
                           flow = MakeResidualBlock(flow, filters, block,
                                                    `block_${i}`))

  let conv_hs = MakeConvBlock(flow, 1, filters, 32, weights.hs, "hs/conv")

  conv_hs = tf.layers.flatten().apply(conv_hs) as tf.SymbolicTensor

  let ip1_hs_w = tf.tensor(weights.ip1_hs_w, [8 * 32, 128])
  let ip1_hs_b = tf.tensor(weights.ip1_hs_b, [128])

  let hs_flow = tf.layers.dense({
    units: 128,
    activation: 'relu',
    useBias: true,
    weights: [ip1_hs_w, ip1_hs_b],
    trainable: false
  }).apply(conv_hs) as tf.SymbolicTensor

  let ip2_hs_w = tf.tensor(weights.ip2_hs_w, [128, 1])
  let ip2_hs_b = tf.tensor(weights.ip2_hs_b, [1])

  let hs_head = tf.layers.dense({
    units: 1,
    activation: 'tanh',
    useBias: true,
    weights: [ip2_hs_w, ip2_hs_b],
    name: 'value/out',
    trainable: false
  }).apply(hs_flow) as tf.SymbolicTensor



  let conv_ppot = MakeConvBlock(flow, 1, filters, 32, weights.ppot, "ppot/conv")

  conv_ppot = tf.layers.flatten().apply(conv_ppot) as tf.SymbolicTensor

  let ip1_ppot_w = tf.tensor(weights.ip1_ppot_w, [8 * 32, 128])
  let ip1_ppot_b = tf.tensor(weights.ip1_ppot_b, [128])

  let ppot_flow = tf.layers.dense({
    units: 128,
    activation: 'relu',
    useBias: true,
    weights: [ip1_ppot_w, ip1_ppot_b],
    trainable: false
  }).apply(conv_ppot) as tf.SymbolicTensor

  let ip2_ppot_w = tf.tensor(weights.ip2_ppot_w, [128, 1])
  let ip2_ppot_b = tf.tensor(weights.ip2_ppot_b, [1])

  let ppot_head = tf.layers.dense({
    units: 1,
    activation: 'tanh',
    useBias: true,
    weights: [ip2_ppot_w, ip2_ppot_b],
    name: 'value/out',
    trainable: false
  }).apply(ppot_flow) as tf.SymbolicTensor



  let conv_npot = MakeConvBlock(flow, 1, filters, 32, weights.npot, "npot/conv")

  conv_npot = tf.layers.flatten().apply(conv_npot) as tf.SymbolicTensor

  let ip1_npot_w = tf.tensor(weights.ip1_npot_w, [8 * 32, 128])
  let ip1_npot_b = tf.tensor(weights.ip1_npot_b, [128])

  let npot_flow = tf.layers.dense({
    units: 128,
    activation: 'relu',
    useBias: true,
    weights: [ip1_npot_w, ip1_npot_b],
    trainable: false
  }).apply(conv_npot) as tf.SymbolicTensor

  let ip2_npot_w = tf.tensor(weights.ip2_npot_w, [128, 1])
  let ip2_npot_b = tf.tensor(weights.ip2_npot_b, [1])

  let npot_head = tf.layers.dense({
    units: 1,
    activation: 'tanh',
    useBias: true,
    weights: [ip2_npot_w, ip2_npot_b],
    name: 'value/out',
    trainable: false
  }).apply(npot_flow) as tf.SymbolicTensor

  let model = tf.model({ inputs: input, outputs: [hs_head, ppot_head, npot_head] })
  return model
}



type OutputShape = [number, number, number][]

export class NetworkComputation {

  input!: tf.Tensor
  output!: OutputShape

  raw_input: InputPlanes[] = []

  constructor(readonly network: Network) {
  }

  GetBatchSize() {
    return this.raw_input.length
  }

  AddInput(input: InputPlanes) {
    this.raw_input.push(input)
  }

  PrepareInput() {
    let shape = [this.raw_input.length, kInputPlanes, 8, 1]
    let values: number[] = []
    this.raw_input.forEach(sample => {
      const buffer = new Uint8Array(sample)
      for (let i = 0; i < buffer.length; i++) {
        const byte = buffer[i]
        let res: number[] = []
        for (let j = 0; j < 8; j++) {
          const bit = (byte >> j) & 1
          res.unshift(bit)
        }
        values.push(...res)
      }
    })
    this.input = tf.tensor(values, shape).transpose([0, 2, 3, 1])
  }

  async ComputeAsync() {
    this.PrepareInput()
    this.output = await (this.network.Compute(this.input) as tf.Tensor).array() as OutputShape
  }

  GetQVal(sample: number) {
    return this.output[sample][0]
  }
}

async function load_weights_from_file(filename: string) {
    let buffer = await decompress_gzip(filename)

      return parse_weights_json(buffer)
}


type Layer = number[]

type SEUnit = {
  w1: Layer,
  b1: Layer,
  w2: Layer,
  b2: Layer
}

type Residual = {
  conv1: ConvBlock,
  conv2: ConvBlock,
  se: SEUnit
}

type BatchNorm = {
  bn_means: Layer,
  bn_stddivs: Layer,
  bn_gammas: Layer,
  bn_betas: Layer
}

type ConvBlock = {
  weights: Layer,
  //biases: Layer,
  bn?: BatchNorm
}
type WeightsLegacy = {
  input: ConvBlock,
  residual: Residual[],

  hs: ConvBlock,
  ip1_hs_w: Layer,
  ip1_hs_b: Layer,
  ip2_hs_w: Layer,
  ip2_hs_b: Layer,

  ppot: ConvBlock,
  ip1_ppot_w: Layer,
  ip1_ppot_b: Layer,
  ip2_ppot_w: Layer,
  ip2_ppot_b: Layer,

  npot: ConvBlock,
  ip1_npot_w: Layer,
  ip1_npot_b: Layer,
  ip2_npot_w: Layer,
  ip2_npot_b: Layer,

}

function parse_weights_json(buffer: Buffer): WeightsLegacy {
  let { weights } = JSON.parse(buffer.toString('utf-8'))

  function parse_layer(l: any) {

    let min_val = l.min_val
    let max_val = l.max_val
    let decodedString = atob(l.params)

    const arrayBuffer = new ArrayBuffer(decodedString.length);
    const uint8Array = new Uint8Array(arrayBuffer)
    const uint16Array = new Uint16Array(arrayBuffer);

    for (let i = 0; i < decodedString.length; i++) {
        uint8Array[i] = decodedString.charCodeAt(i);
    }

    let params = Array.from(uint16Array)


    let range = max_val - min_val
    params = params.map(_ => _ / (0xffff) * range + min_val)

    return params
  }

  function parse_conv(c: any) {
    if (!c.bn_means.params) {
      return {
        weights: parse_layer(c.weights)
      }
    }

    let bn = {
      bn_means: parse_layer(c.bn_means),
      bn_gammas: parse_layer(c.bn_gammas),
      bn_betas: parse_layer(c.bn_betas),
      bn_stddivs: parse_layer(c.bn_stddivs)
    }

    return {
      weights: parse_layer(c.weights),
      bn
    }
  }

  function parse_se(s: any) {
    return {
      w1: parse_layer(s.w1),
      b1: parse_layer(s.b1),
      w2: parse_layer(s.w2),
      b2: parse_layer(s.b2),
    }
  }

  function parse_residual(r: any) {
    return { 
      conv1: parse_conv(r.conv1), 
      conv2: parse_conv(r.conv2),
      se: parse_se(r.se)
    }
  }

  let input = parse_conv(weights.input)
  let residual = weights.residual.map(parse_residual)

  let hs = parse_conv(weights.hs)
  let ip1_hs_w = parse_layer(weights.ip1_hs_w)
  let ip1_hs_b = parse_layer(weights.ip1_hs_b)
  let ip2_hs_w = parse_layer(weights.ip2_hs_w)
  let ip2_hs_b = parse_layer(weights.ip2_hs_b)


  let ppot = parse_conv(weights.ppot)
  let ip1_ppot_w = parse_layer(weights.ip1_ppot_w)
  let ip1_ppot_b = parse_layer(weights.ip1_ppot_b)
  let ip2_ppot_w = parse_layer(weights.ip2_ppot_w)
  let ip2_ppot_b = parse_layer(weights.ip2_ppot_b)


  let npot = parse_conv(weights.npot)
  let ip1_npot_w = parse_layer(weights.ip1_npot_w)
  let ip1_npot_b = parse_layer(weights.ip1_npot_b)
  let ip2_npot_w = parse_layer(weights.ip2_npot_w)
  let ip2_npot_b = parse_layer(weights.ip2_npot_b)



  return {
    input,
    residual,
    hs,
    ip1_hs_w,
    ip1_hs_b,
    ip2_hs_w,
    ip2_hs_b,

    ppot,
    ip1_ppot_w,
    ip1_ppot_b,
    ip2_ppot_w,
    ip2_ppot_b,

    npot,
    ip1_npot_w,
    ip1_npot_b,
    ip2_npot_w,
    ip2_npot_b,
  }
}



export class Network {

  constructor(readonly name: string) {}

  model!: tf.LayersModel

  async init(filename: string) {
    let weights = await load_weights_from_file(`networks/${filename}.json.gz`)

    let input = tf.input({ shape: [8, 1, kInputPlanes], dtype: 'float32', name: 'input_planes'})
    this.model = MakeNetwork(input, weights)


    let fake_request = this.new_computation()
    fake_request.AddInput(Array(kInputPlanes))
    await fake_request.ComputeAsync()
  }

  new_computation() {
    return new NetworkComputation(this)
  }


  Compute(input: tf.Tensor) {
    return this.model.predict(input)
  }
}

export const networks_all = await discover_all_networks()

async function discover_all_networks() {
  let files = await get_files('networks')

  return Promise.all(files.filter(_ => _.endsWith('.json.gz'))
                     .map(_ => _.slice(0, -8))
                     .map(_ => {
                       let n = new Network(_)
                       return n.init(_).then(_ => n)
                     }))
}

export async function predict_strs(cards: string[], network?: Network) {

  if (cards.length === 0) {
    throw "No cards to predict"
  }

  if (!network) {
    network = networks_all[0]
    if (!network) {
      throw "No network files found"
    }
  }


  let computation = network.new_computation()

  cards.forEach(_ => {
    let cards = split_cards(_)
    let input = EncodeCardsForNN(cards.slice(0, 2), cards.slice(2))
    computation.AddInput(input)
  })
  await computation.ComputeAsync()
  return computation.output
}
