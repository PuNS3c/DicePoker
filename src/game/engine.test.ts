import { describe, expect, it } from 'vitest'
import { canReroll, confirmTurn, createGame, rerollSelectedDice, rollTurn, toggleSelectedDie } from './engine'
import type { DieValue, TurnState } from './types'

function createSequenceRandom(values: number[]) {
  let index = 0

  return () => {
    const value = values[index]

    if (value === undefined) {
      throw new Error('Random sequence exhausted during test.')
    }

    index += 1
    return value
  }
}

describe('game engine', () => {
  it('randomizes player order once at game start', () => {
    const game = createGame(
      {
        playerCount: 3,
        playerNames: ['Ava', 'Ben', 'Cleo'],
        roundCount: 1,
      },
      createSequenceRandom([0.9, 0]),
    )

    expect(game.playerOrder).toEqual(['player-2', 'player-1', 'player-3'])
    expect(game.activeTurn?.playerId).toBe('player-2')
  })

  it('rerolls only selected dice and enforces the reroll limit', () => {
    const game = createGame(
      {
        playerCount: 2,
        playerNames: ['Ava', 'Ben'],
        roundCount: 1,
      },
      () => 0,
    )

    const firstRoll = rollTurn(game.activeTurn!, () => 0)
    const selected = toggleSelectedDie(firstRoll, 0)
    const rerolled = rerollSelectedDice(selected, () => 0.99)

    expect(rerolled.dice[0].value).toBe(6)
    expect(rerolled.dice.slice(1).every((die) => die.value === 1)).toBe(true)
    expect(rerolled.rerollsUsed).toBe(1)
  })

  it('throws if reroll is attempted before the first roll', () => {
    const game = createGame(
      {
        playerCount: 2,
        playerNames: ['Ava', 'Ben'],
        roundCount: 1,
      },
      () => 0,
    )

    expect(() => rerollSelectedDice(game.activeTurn!, () => 0)).toThrow(/first roll/i)
  })

  it('advances through players and rounds, then computes the winner', () => {
    let game = createGame(
      {
        playerCount: 2,
        playerNames: ['Ava', 'Ben'],
        roundCount: 1,
      },
      () => 0.99,
    )

    const firstPlayerName = game.players.find((player) => player.id === game.playerOrder[0])?.name

    game = {
      ...game,
      activeTurn: { ...game.activeTurn!, dice: game.activeTurn!.dice.map((die) => ({ ...die, value: 6 })), hasRolled: true },
    }
    game = confirmTurn(game)

    game = {
      ...game,
      activeTurn: {
        ...game.activeTurn!,
        dice: game.activeTurn!.dice.map((die, index) => ({ ...die, value: ([3, 3, 3, 6, 6] as const)[index] })),
        hasRolled: true,
      },
    }
    game = confirmTurn(game)

    expect(game.status).toBe('completed')
    expect(game.finalResults?.ranking[0].playerName).toBe(firstPlayerName)
  })

  it('tracks selected dice and disables rerolls after two rerolls', () => {
    const game = createGame(
      {
        playerCount: 2,
        playerNames: ['Ava', 'Ben'],
        roundCount: 1,
      },
      () => 0,
    )

    let turn: TurnState = {
      ...game.activeTurn!,
      hasRolled: true,
      dice: game.activeTurn!.dice.map((die, index) => ({ ...die, value: (index + 1) as DieValue })),
    }

    turn = toggleSelectedDie(turn, 0)
    turn = toggleSelectedDie(turn, 3)

    expect(turn.selectedDice).toEqual([0, 3])
    expect(canReroll(turn)).toBe(true)

    turn = rerollSelectedDice(turn, () => 0.2)
    turn = { ...turn, selectedDice: [1], rerollsUsed: 1 }
    turn = rerollSelectedDice(turn, () => 0.4)

    expect(turn.rerollsUsed).toBe(2)
    expect(canReroll(turn)).toBe(false)
  })
})
