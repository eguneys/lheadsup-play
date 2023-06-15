import { GameN, Chips, make_deal, Side, Headsup, RoundNPov, RoundN, Dests } from 'lheadsup'

function increase_blinds(blinds: Chips) {
  return blinds + 25
}

export abstract class Spectator {

  tournament_key?: string

  dealt(round: RoundN) {
    this._dealt(round)
  }

  dealer_act(round: RoundN, action: string) {
    this._dealer_act(round, action)
  }

  match_begin(p1: Player, p2: Player) {
    this._match_begin(p1, p2)
  }

  increase_blinds(blinds: Chips, level: number) {
    this._increase_blinds(blinds, level)
  }

  async action(round: RoundN, action: string) {
    await this._action(round, action)
  }

  match_end(winner: Side) {
    this._match_end(winner)
  }


  tournament_begin(p1: Player, p2: Player) {
    this.tournament_key = [p1.name, p2.name].join('_vs_')
    this._tournament_begin(p1, p2)
  }

  async tournament_end() {
    await this._tournament_end()
  }



  abstract _tournament_begin(p1: Player, p2: Player): void;
  abstract _tournament_end(): Promise<void>;

  abstract _dealt(round: RoundN): void;
  abstract _dealer_act(round: RoundN, action: string): void;
  abstract _match_begin(p1: Player, p2: Player): void;
  abstract _increase_blinds(blinds: Chips, level: number): void;
  abstract _action(round: RoundN, action: string): Promise<void>;
  abstract _match_end(winner: Side): void;
}

export abstract class Player {

  abstract name: string
  abstract desc: string

  match_side?: Side

  dealt(round: RoundNPov) {
    this._dealt(round)
  }

  dealer_act(round: RoundNPov, action: string) {
    this._dealer_act(round, action)
  }

  match_begin(side: Side, opponent: Player) {
    this.match_side = side
    this._match_begin(side, opponent)
  }

  increase_blinds(blinds: Chips, level: number) {
    this._increase_blinds(blinds, level)
  }

  async act(round: RoundNPov, dests: Dests): Promise<string> {
    let act = await this._act(round, dests)

    return act
  }

  opponent_act(round: RoundNPov, action: string) {
    this._opponent_act(round, action)
  }


  match_end(winner: Side) {
    this._match_end(winner)
  }


  tournament_begin(side: Side, p2: Player) {
    this._tournament_begin(side, p2)
  }

  tournament_end() {
    this._tournament_end()
  }


  _tournament_begin(side: Side, p2: Player) {}
  _tournament_end() {}

  _dealt(round: RoundNPov) {}
  _dealer_act(round: RoundNPov, action: string) {}
  _match_begin(side: Side, opponent: Player) {}
  _increase_blinds(blinds: Chips, level: number) {}
  abstract _act(round: RoundNPov, dests: Dests): Promise<string>;
  _opponent_act(round: RoundNPov, action: string) {}
  _match_end(winner: Side) {}
}



export async function one_match(p1: Player, p2: Player, specs: Spectator[] = []) {
  let players = [p1, p2]

  let h = Headsup.make()
  let level = 1

  function dealer_act_for_round(act: string) {
    p1.dealer_act(h.round!.pov(1), act)
    p2.dealer_act(h.round!.pov(2), act)
    specs.forEach(s => s.dealer_act(h.round!, act))

    h.round_act(act)
  }

  p1.match_begin(1, p2)
  p2.match_begin(2, p1)
  specs.forEach(s => s.match_begin(p1, p2))

  while (!h.winner) {
    if (h.game_dests.deal) {
      let { small_blind, button, seats } = h.game!
      if (++level % 20 === 0) {

        let new_blinds = increase_blinds(small_blind)
        h.game = new GameN(new_blinds, button, seats)

        p1.increase_blinds(new_blinds, level)
        p2.increase_blinds(new_blinds, level)
        specs.forEach(s => s.increase_blinds(new_blinds, level))
      }

      h.game_act('deal')

      p1.dealt(h.round!.pov(1))
      p2.dealt(h.round!.pov(2))
      specs.forEach(s => s.dealt(h.round!))

      h.round_act(`deal ${make_deal(2)}`)
    }

    const { round, round_dests } = h

    if (round && round_dests) {
      if (round_dests.phase) {
        dealer_act_for_round('phase')
      } else if (round_dests.win) {
        dealer_act_for_round('win')
      } else if (round_dests.share) {
        dealer_act_for_round('share')
      } else if (round_dests.showdown) {
        dealer_act_for_round('showdown')
      } else {

        let { action_side } = round

        let op_side = action_side === 1 ? 2 : 1 as Side

        let action = await players[action_side - 1].act(round.pov(action_side), round_dests)

        players[op_side - 1].opponent_act(round.pov(op_side), action)
        await specs.forEach(s => s.action(round, action))

        h.round_act(action)
      }
    }
  }


  p1.match_end(h.winner!)
  p2.match_end(h.winner!)
  specs.forEach(s => s.match_end(h.winner!))
}


export async function one_tournament(p1: Player, p2: Player, specs: Spectator[] = []) {

  let ps = [p1, p2]

  p1.tournament_begin(1, p2)
  p2.tournament_begin(2, p1)
  specs.forEach(s => s.tournament_begin(p1, p2))

  for (let i = 0; i < 10; i++) {
    await one_match(ps[0], ps[1], specs);

    [ps[0], ps[1]] = [ps[1], ps[0]]
  }

  p1.tournament_end()
  p2.tournament_end()
  await Promise.all(specs.map(s => s.tournament_end()))
}
