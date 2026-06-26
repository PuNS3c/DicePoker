import { scoreDice } from './scoring'
import type {
  DieState,
  DieValue,
  FinalResults,
  GameSetup,
  GameState,
  Player,
  PlayerScore,
  TurnResult,
  TurnState,
} from './types'

/**
 * @decision DEC-ENGINE-001
 * The game engine stays pure and framework-agnostic. React only consumes immutable
 * state transitions so rerolls, round advancement, and winner calculation remain testable.
 */

export type RandomNumberSource = () => number

const MAX_REROLLS = 2

function createDice(): DieState[] {
  return Array.from({ length: 5 }, (_, index) => ({ id: index, value: null }))
}

function normalizeName(name: string, index: number): string {
  const trimmed = name.trim()
  return trimmed.length > 0 ? trimmed : `Player ${index + 1}`
}

function createPlayers(setup: GameSetup): Player[] {
  return setup.playerNames.map((name, index) => ({
    id: `player-${index + 1}`,
    name: normalizeName(name, index),
  }))
}

function shufflePlayerOrder(playerIds: string[], random: RandomNumberSource): string[] {
  const order = [...playerIds]

  for (let index = order.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[order[index], order[swapIndex]] = [order[swapIndex], order[index]]
  }

  return order
}

function rollDie(random: RandomNumberSource): DieValue {
  return (Math.floor(random() * 6) + 1) as DieValue
}

function createTurnState(playerId: string): TurnState {
  return {
    playerId,
    dice: createDice(),
    selectedDice: [],
    rerollsUsed: 0,
    hasRolled: false,
  }
}

function getPlayerName(players: Player[], playerId: string): string {
  const player = players.find((entry) => entry.id === playerId)

  if (!player) {
    throw new Error(`Unknown player id: ${playerId}`)
  }

  return player.name
}

function createScoreboard(players: Player[]): PlayerScore[] {
  return players.map((player) => ({
    playerId: player.id,
    playerName: player.name,
    totalScore: 0,
    turns: [],
  }))
}

function nextTurnPosition(game: GameState): { roundNumber: number; turnIndex: number } | null {
  const nextTurnIndex = game.turnIndex + 1

  if (nextTurnIndex < game.playerOrder.length) {
    return { roundNumber: game.roundNumber, turnIndex: nextTurnIndex }
  }

  const nextRoundNumber = game.roundNumber + 1

  if (nextRoundNumber > game.setup.roundCount) {
    return null
  }

  return { roundNumber: nextRoundNumber, turnIndex: 0 }
}

export function getCurrentPlayer(game: GameState): Player | null {
  if (!game.activeTurn) {
    return null
  }

  return game.players.find((player) => player.id === game.activeTurn?.playerId) ?? null
}

export function canReroll(turn: TurnState): boolean {
  return turn.hasRolled && turn.selectedDice.length > 0 && turn.rerollsUsed < MAX_REROLLS
}

export function canConfirmTurn(turn: TurnState): boolean {
  return turn.hasRolled
}

export function createGame(setup: GameSetup, random: RandomNumberSource = Math.random): GameState {
  if (setup.playerCount < 2) {
    throw new Error('Dice Poker requires at least 2 players.')
  }

  if (setup.roundCount < 1) {
    throw new Error('Dice Poker requires at least 1 round.')
  }

  if (setup.playerNames.length !== setup.playerCount) {
    throw new Error('Player names must match the selected player count.')
  }

  const players = createPlayers(setup)
  const playerOrder = shufflePlayerOrder(
    players.map((player) => player.id),
    random,
  )

  return {
    setup,
    players,
    playerOrder,
    roundNumber: 1,
    turnIndex: 0,
    activeTurn: createTurnState(playerOrder[0]),
    scoreboard: createScoreboard(players),
    completedTurns: [],
    finalResults: null,
    status: 'in_progress',
  }
}

export function rollTurn(turn: TurnState, random: RandomNumberSource = Math.random): TurnState {
  const dice = turn.dice.map((die, index) => {
    const shouldRoll = !turn.hasRolled || turn.selectedDice.includes(index)

    if (!shouldRoll) {
      return die
    }

    return {
      ...die,
      value: rollDie(random),
    }
  })

  return {
    ...turn,
    dice,
    hasRolled: true,
    rerollsUsed: turn.hasRolled ? turn.rerollsUsed + 1 : 0,
    selectedDice: [],
  }
}

export function toggleSelectedDie(turn: TurnState, dieIndex: number): TurnState {
  if (!turn.hasRolled) {
    return turn
  }

  if (turn.rerollsUsed >= MAX_REROLLS) {
    return turn
  }

  const selectedDice = turn.selectedDice.includes(dieIndex)
    ? turn.selectedDice.filter((index) => index !== dieIndex)
    : [...turn.selectedDice, dieIndex].sort((left, right) => left - right)

  return {
    ...turn,
    selectedDice,
  }
}

export function rerollSelectedDice(
  turn: TurnState,
  random: RandomNumberSource = Math.random,
): TurnState {
  if (!turn.hasRolled) {
    throw new Error('The first roll must happen before rerolling dice.')
  }

  if (turn.rerollsUsed >= MAX_REROLLS) {
    throw new Error('No rerolls remain for this turn.')
  }

  if (turn.selectedDice.length === 0) {
    throw new Error('Select at least one die before rerolling.')
  }

  return rollTurn(turn, random)
}

function computeFinalResults(scoreboard: PlayerScore[]): FinalResults {
  const ranking = [...scoreboard].sort((left, right) => {
    if (right.totalScore !== left.totalScore) {
      return right.totalScore - left.totalScore
    }

    return left.playerName.localeCompare(right.playerName)
  })

  const topScore = ranking[0]?.totalScore ?? 0

  return {
    winnerIds: ranking.filter((player) => player.totalScore === topScore).map((player) => player.playerId),
    ranking,
  }
}

export function confirmTurn(game: GameState): GameState {
  if (!game.activeTurn) {
    throw new Error('There is no active turn to confirm.')
  }

  if (!canConfirmTurn(game.activeTurn)) {
    throw new Error('The active player must roll before confirming the turn.')
  }

  const dice = game.activeTurn.dice.map((die) => die.value)

  if (dice.some((value) => value === null)) {
    throw new Error('All dice must have values before a turn can be confirmed.')
  }

  const finalDice = dice as DieValue[]
  const hand = scoreDice(finalDice)
  const playerId = game.activeTurn.playerId
  const turnResult: TurnResult = {
    playerId,
    playerName: getPlayerName(game.players, playerId),
    roundNumber: game.roundNumber,
    dice: finalDice,
    hand,
  }

  const scoreboard = game.scoreboard.map((entry) => {
    if (entry.playerId !== playerId) {
      return entry
    }

    return {
      ...entry,
      totalScore: entry.totalScore + hand.score,
      turns: [...entry.turns, turnResult],
    }
  })

  const completedTurns = [...game.completedTurns, turnResult]
  const nextPosition = nextTurnPosition(game)

  if (!nextPosition) {
    return {
      ...game,
      activeTurn: null,
      scoreboard,
      completedTurns,
      finalResults: computeFinalResults(scoreboard),
      status: 'completed',
    }
  }

  return {
    ...game,
    roundNumber: nextPosition.roundNumber,
    turnIndex: nextPosition.turnIndex,
    activeTurn: createTurnState(game.playerOrder[nextPosition.turnIndex]),
    scoreboard,
    completedTurns,
  }
}

export function getVisibleHand(turn: TurnState) {
  if (!turn.hasRolled) {
    return null
  }

  const dice = turn.dice.map((die) => die.value)

  if (dice.some((value) => value === null)) {
    return null
  }

  return scoreDice(dice as DieValue[])
}
