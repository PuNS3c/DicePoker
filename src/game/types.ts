export type DieValue = 1 | 2 | 3 | 4 | 5 | 6

export type HandRank =
  | 'five_of_a_kind'
  | 'four_of_a_kind'
  | 'full_house'
  | 'straight'
  | 'three_of_a_kind'
  | 'two_pair'
  | 'one_pair'
  | 'bust'

export interface Player {
  id: string
  name: string
}

export interface GameSetup {
  playerCount: number
  playerNames: string[]
  roundCount: number
}

export interface DieState {
  id: number
  value: DieValue | null
}

export interface ScoredHand {
  rank: HandRank
  label: string
  dice: DieValue[]
  tiebreak: number[]
  score: number
}

export interface TurnState {
  playerId: string
  dice: DieState[]
  selectedDice: number[]
  rerollsUsed: number
  hasRolled: boolean
}

export interface TurnResult {
  playerId: string
  playerName: string
  roundNumber: number
  dice: DieValue[]
  hand: ScoredHand
}

export interface PlayerScore {
  playerId: string
  playerName: string
  totalScore: number
  turns: TurnResult[]
}

export interface FinalResults {
  winnerIds: string[]
  ranking: PlayerScore[]
}

export interface GameState {
  setup: GameSetup
  players: Player[]
  playerOrder: string[]
  roundNumber: number
  turnIndex: number
  activeTurn: TurnState | null
  scoreboard: PlayerScore[]
  completedTurns: TurnResult[]
  finalResults: FinalResults | null
  status: 'in_progress' | 'completed'
}
