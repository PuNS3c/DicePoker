import { useEffect, useState } from 'react'
import {
  canConfirmTurn,
  canReroll,
  confirmTurn,
  createGame,
  getCurrentPlayer,
  getVisibleHand,
  rerollSelectedDice,
  rollTurn,
  toggleSelectedDie,
} from './game/engine'
import { getDieLabel } from './game/scoring'
import type { GameSetup, GameState, TurnResult } from './game/types'

/**
 * @decision DEC-APP-001
 * The UI stays as a single-screen state machine: setup, play, and results are all
 * rendered from one React tree so GitHub Pages deployment remains static and simple.
 */

const MIN_PLAYERS = 2
const MAX_PLAYERS = 6
const MIN_ROUNDS = 1
const MAX_ROUNDS = 10
const ROLL_ANIMATION_MS = 650

const defaultSetup = {
  playerCount: 2,
  roundCount: 5,
}

const CARD_FACE_ART: Record<1 | 2 | 3 | 4 | 5 | 6, { rank: string; suit: string; name: string }> = {
  1: { rank: '9', suit: '♣', name: 'Nine of Clubs' },
  2: { rank: '10', suit: '♦', name: 'Ten of Diamonds' },
  3: { rank: 'J', suit: '♥', name: 'Jack of Hearts' },
  4: { rank: 'Q', suit: '♠', name: 'Queen of Spades' },
  5: { rank: 'K', suit: '♦', name: 'King of Diamonds' },
  6: { rank: 'A', suit: '♠', name: 'Ace of Spades' },
}

const HAND_CHEATSHEET = [
  { name: 'Five of a Kind', score: '140000+', note: 'Best possible hand' },
  { name: 'Four of a Kind', score: '120000+', note: 'Four matching dice' },
  { name: 'Full House', score: '100000+', note: 'Three of a kind plus a pair' },
  { name: 'Straight', score: '80000+', note: '1-2-3-4-5 or 2-3-4-5-6' },
  { name: 'Three of a Kind', score: '60000+', note: 'Three matching dice' },
  { name: 'Two Pair', score: '40000+', note: 'Two separate pairs' },
  { name: 'One Pair', score: '20000+', note: 'One matching pair' },
  { name: 'Bust / High Hand', score: '0-19999', note: 'Highest cards decide the tie-break' },
] as const

function buildPlayerNames(playerCount: number, currentNames: string[]): string[] {
  return Array.from({ length: playerCount }, (_, index) => currentNames[index] ?? '')
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function formatDice(values: number[]) {
  return values.map((value) => getDieLabel(value as 1 | 2 | 3 | 4 | 5 | 6)).join(' ')
}

function getCardFaceArt(value: 1 | 2 | 3 | 4 | 5 | 6) {
  return CARD_FACE_ART[value]
}

export default function App() {
  const [playerCount, setPlayerCount] = useState(defaultSetup.playerCount)
  const [roundCount, setRoundCount] = useState(defaultSetup.roundCount)
  const [playerNames, setPlayerNames] = useState<string[]>(buildPlayerNames(defaultSetup.playerCount, []))
  const [validationError, setValidationError] = useState('')
  const [game, setGame] = useState<GameState | null>(null)
  const [isRolling, setIsRolling] = useState(false)
  const [rollingDiceIndices, setRollingDiceIndices] = useState<number[]>([])
  const [isCheatsheetOpen, setIsCheatsheetOpen] = useState(false)
  const [isBoardFlipped, setIsBoardFlipped] = useState(false)
  const [lastTurnResult, setLastTurnResult] = useState<TurnResult | null>(null)

  useEffect(() => {
    if (!isRolling) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      setIsRolling(false)
      setRollingDiceIndices([])
    }, ROLL_ANIMATION_MS)
    return () => window.clearTimeout(timeoutId)
  }, [isRolling])

  const activeTurn = game?.activeTurn ?? null
  const currentPlayer = game ? getCurrentPlayer(game) : null
  const visibleHand = activeTurn ? getVisibleHand(activeTurn) : null
  const canUseReroll = activeTurn ? canReroll(activeTurn) : false
  const canUseConfirm = activeTurn ? canConfirmTurn(activeTurn) : false

  function updatePlayerName(index: number, nextValue: string) {
    setPlayerNames((currentNames) => {
      const nextNames = [...currentNames]
      nextNames[index] = nextValue
      return nextNames
    })
  }

  function handlePlayerCountChange(nextCount: number) {
    const clampedCount = clamp(nextCount, MIN_PLAYERS, MAX_PLAYERS)
    setPlayerCount(clampedCount)
    setPlayerNames((currentNames) => buildPlayerNames(clampedCount, currentNames))
  }

  function handleStartGame() {
    const trimmedNames = playerNames.slice(0, playerCount).map((name) => name.trim())

    if (trimmedNames.some((name) => name.length === 0)) {
      setValidationError('Enter a name for every player before starting.')
      return
    }

    if (roundCount < MIN_ROUNDS || roundCount > MAX_ROUNDS) {
      setValidationError(`Rounds must be between ${MIN_ROUNDS} and ${MAX_ROUNDS}.`)
      return
    }

    const setup: GameSetup = {
      playerCount,
      playerNames: trimmedNames,
      roundCount,
    }

    setValidationError('')
    setIsBoardFlipped(false)
    setIsCheatsheetOpen(false)
    setLastTurnResult(null)
    setGame(createGame(setup))
  }

  function handleRoll() {
    if (!activeTurn || isRolling) {
      return
    }

    const nextRollingDice = activeTurn.hasRolled
      ? [...activeTurn.selectedDice]
      : activeTurn.dice.map((_, index) => index)

    setRollingDiceIndices(nextRollingDice)
    setIsRolling(true)
    setGame((currentGame) => {
      if (!currentGame?.activeTurn) {
        return currentGame
      }

      if (!currentGame.activeTurn.hasRolled) {
        return {
          ...currentGame,
          activeTurn: rollTurn(currentGame.activeTurn),
        }
      }

      return {
        ...currentGame,
        activeTurn: rerollSelectedDice(currentGame.activeTurn),
      }
    })
  }

  function handleToggleDie(index: number) {
    if (!activeTurn || isRolling) {
      return
    }

    setGame((currentGame) => {
      if (!currentGame?.activeTurn) {
        return currentGame
      }

      return {
        ...currentGame,
        activeTurn: toggleSelectedDie(currentGame.activeTurn, index),
      }
    })
  }

  function handleConfirmTurn() {
    setGame((currentGame) => {
      if (!currentGame) {
        return currentGame
      }

      const result = currentGame.activeTurn ? getVisibleHand(currentGame.activeTurn) : null
      const completedGame = confirmTurn(currentGame)

      if (result && currentGame.activeTurn) {
        setLastTurnResult({
          playerId: currentGame.activeTurn.playerId,
          playerName:
            currentGame.players.find((player) => player.id === currentGame.activeTurn?.playerId)?.name ?? 'Player',
          roundNumber: currentGame.roundNumber,
          dice: result.dice,
          hand: result,
        })
      }

      return completedGame
    })
  }

  function handleNewGame() {
    setGame(null)
    setIsRolling(false)
    setRollingDiceIndices([])
    setIsCheatsheetOpen(false)
    setIsBoardFlipped(false)
    setLastTurnResult(null)
  }

  if (!game) {
    return (
      <main className="app-shell setup-shell">
        <section className="card hero-card">
          <p className="eyebrow">GitHub Pages Ready</p>
          <h1>Dice Poker Night</h1>
          <p className="hero-copy">
            Build a full poker-dice match, then pass the phone around the table.
          </p>
        </section>

        <section className="card setup-card">
          <h2>Match Setup</h2>
          <div className="setup-grid compact-grid">
            <label>
              <span>Players</span>
              <input
                type="number"
                min={MIN_PLAYERS}
                max={MAX_PLAYERS}
                value={playerCount}
                onChange={(event) => handlePlayerCountChange(Number(event.target.value))}
              />
            </label>

            <label>
              <span>Rounds</span>
              <input
                type="number"
                min={MIN_ROUNDS}
                max={MAX_ROUNDS}
                value={roundCount}
                onChange={(event) => setRoundCount(Number(event.target.value))}
              />
            </label>
          </div>

          <div className="players-grid compact-grid">
            {playerNames.map((name, index) => (
              <label key={`player-name-${index}`}>
                <span>{`Player ${index + 1}`}</span>
                <input
                  type="text"
                  value={name}
                  maxLength={20}
                  placeholder={`Name for player ${index + 1}`}
                  onChange={(event) => updatePlayerName(index, event.target.value)}
                />
              </label>
            ))}
          </div>

          {validationError ? <p className="inline-error">{validationError}</p> : null}

          <button type="button" className="primary-button" onClick={handleStartGame}>
            Start Game
          </button>
        </section>
      </main>
    )
  }

  if (game.status === 'completed' && game.finalResults) {
    const winnerNames = game.finalResults.winnerIds.map((winnerId) => {
      const winner = game.finalResults?.ranking.find((entry) => entry.playerId === winnerId)
      return winner?.playerName ?? winnerId
    })

    return (
      <main className="app-shell results-shell">
        <div className="fireworks" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>

        <section className="card results-card">
          <p className="eyebrow">Final Results</p>
          <h1>{winnerNames.join(' & ')} win{winnerNames.length > 1 ? '' : 's'}!</h1>
          <p className="hero-copy">The last scoreboard is locked in. Start a fresh match whenever the table is ready.</p>

          <div className="results-list">
            {game.finalResults.ranking.map((entry, index) => (
              <article key={entry.playerId} className="result-row">
                <span className="result-rank">#{index + 1}</span>
                <span>{entry.playerName}</span>
                <strong>{entry.totalScore}</strong>
              </article>
            ))}
          </div>

          <button type="button" className="primary-button" onClick={handleNewGame}>
            New Game
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell play-shell">
      <div className={`play-stage${isBoardFlipped ? ' is-flipped' : ''}`}>
        <section className="card spotlight-card">
          <div>
            <p className="eyebrow">Round {game.roundNumber} of {game.setup.roundCount}</p>
            <h1>{currentPlayer?.name}&apos;s turn</h1>
          </div>

          <div className="spotlight-meta">
            <span>{`Turn ${game.turnIndex + 1} of ${game.playerOrder.length}`}</span>
            <span>{activeTurn?.rerollsUsed ?? 0} / 2 rerolls used</span>
          </div>
        </section>

        <section className="card main-board">
          <div className="play-panel">
            <div className={`utility-row${game.setup.playerCount === 2 ? ' has-three-actions' : ' has-two-actions'}`}>
              <button type="button" className="secondary-button utility-button" onClick={() => setIsCheatsheetOpen(true)}>
                Hand Scores
              </button>

              {game.setup.playerCount === 2 ? (
                <button
                  type="button"
                  className="secondary-button utility-button"
                  onClick={() => setIsBoardFlipped((currentValue) => !currentValue)}
                >
                  Switch Orientation
                </button>
              ) : null}

              <button type="button" className="secondary-button utility-button utility-button-danger" onClick={handleNewGame}>
                End Game
              </button>
            </div>

            <div className="dice-tray" role="list" aria-label="Poker dice">
              {activeTurn?.dice.map((die, index) => {
                const isSelected = activeTurn.selectedDice.includes(index)
                const face = die.value === null ? null : getCardFaceArt(die.value)
                const isRollingDie = rollingDiceIndices.includes(index)

                return (
                  <button
                    key={die.id}
                    type="button"
                    className={`die-card${isSelected ? ' is-selected' : ''}${isRollingDie ? ' is-rolling' : ''}`}
                    onClick={() => handleToggleDie(index)}
                    disabled={!activeTurn.hasRolled || activeTurn.rerollsUsed >= 2}
                    aria-label={face ? face.name : `Die ${index + 1}, not rolled yet`}
                  >
                    <span className="die-shell" aria-hidden="true">
                      {face ? (
                        <>
                          <span className="die-corner die-corner-top">
                            <span>{face.rank}</span>
                            <span>{face.suit}</span>
                          </span>
                          <span className="die-center-mark">
                            <span className="die-rank-mark">{face.rank}</span>
                            <span className="die-suit-mark">{face.suit}</span>
                          </span>
                          <span className="die-corner die-corner-bottom">
                            <span>{face.rank}</span>
                            <span>{face.suit}</span>
                          </span>
                        </>
                      ) : (
                        <span className="die-placeholder">Roll</span>
                      )}
                    </span>
                    <span className="die-index">Die {index + 1}</span>
                  </button>
                )
              })}
            </div>

            <div className="hand-preview">
              <strong>{visibleHand ? visibleHand.label : 'Roll all five dice to reveal a hand.'}</strong>
              <span>{visibleHand ? `Current score: ${visibleHand.score}` : 'Select dice after the first roll to reroll them.'}</span>
            </div>

            {lastTurnResult ? (
              <div className="turn-feedback" role="status">
                <strong>{`${lastTurnResult.playerName} scored ${lastTurnResult.hand.label}`}</strong>
                <span>{formatDice(lastTurnResult.dice)}</span>
              </div>
            ) : null}

            <div className="control-row">
              <button
                type="button"
                className="primary-button"
                onClick={handleRoll}
                disabled={isRolling || (!!activeTurn?.hasRolled && !canUseReroll)}
              >
                {activeTurn?.hasRolled ? 'Reroll Selected' : 'Roll Dice'}
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={handleConfirmTurn}
                disabled={isRolling || !canUseConfirm}
              >
                Confirm Hand
              </button>
            </div>
          </div>

          <aside className="sidebar">
            <section className="sidebar-card">
              <h2>Play Order</h2>
              <ol>
                {game.playerOrder.map((playerId, index) => {
                  const player = game.players.find((entry) => entry.id === playerId)
                  return (
                    <li key={playerId} className={index === game.turnIndex ? 'is-active-order' : ''}>
                      {player?.name}
                    </li>
                  )
                })}
              </ol>
            </section>

            <section className="sidebar-card">
              <h2>Scoreboard</h2>
              <div className="scoreboard-list">
                {game.scoreboard
                  .slice()
                  .sort((left, right) => right.totalScore - left.totalScore)
                  .map((entry) => (
                    <article key={entry.playerId} className="score-row">
                      <span>{entry.playerName}</span>
                      <strong>{entry.totalScore}</strong>
                    </article>
                  ))}
              </div>
            </section>
          </aside>
        </section>
      </div>

      {isCheatsheetOpen ? (
        <div className="overlay-backdrop" role="presentation" onClick={() => setIsCheatsheetOpen(false)}>
          <section
            className="card cheatsheet-card"
            role="dialog"
            aria-modal="true"
            aria-label="Hand score cheatsheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="cheatsheet-header">
              <div>
                <p className="eyebrow">Hand Scores</p>
                <h2>Strongest to weakest</h2>
              </div>

              <button type="button" className="secondary-button utility-button" onClick={() => setIsCheatsheetOpen(false)}>
                Close
              </button>
            </div>

            <div className="cheatsheet-list">
              {HAND_CHEATSHEET.map((hand, index) => (
                <article key={hand.name} className="cheatsheet-row">
                  <span className="result-rank">#{index + 1}</span>
                  <div>
                    <strong>{hand.name}</strong>
                    <p>{hand.note}</p>
                  </div>
                  <strong>{hand.score}</strong>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
