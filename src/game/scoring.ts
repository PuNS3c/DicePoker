import type { DieValue, HandRank, ScoredHand } from './types'

/**
 * @decision DEC-SCORING-001
 * Poker dice hands are ranked with deterministic tie-breakers so the same 5-dice
 * input always produces a stable machine score, label, and ordering.
 */

const RANK_VALUES: Record<HandRank, number> = {
  bust: 0,
  one_pair: 1,
  two_pair: 2,
  three_of_a_kind: 3,
  straight: 4,
  full_house: 5,
  four_of_a_kind: 6,
  five_of_a_kind: 7,
}

const CARD_LABELS: Record<DieValue, string> = {
  1: '9',
  2: '10',
  3: 'Jack',
  4: 'Queen',
  5: 'King',
  6: 'Ace',
}

const SCORE_BAND = 20_000

function sortDescending(values: DieValue[]): DieValue[] {
  return [...values].sort((left, right) => right - left) as DieValue[]
}

function encodeTiebreak(values: number[]): number {
  return values.reduce((total, value) => total * 7 + value, 0)
}

function countDice(values: DieValue[]): Array<{ value: DieValue; count: number }> {
  const counts = new Map<DieValue, number>()

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count
      }

      return right.value - left.value
    })
}

function isStraight(values: DieValue[]): boolean {
  const sorted = [...new Set(values)].sort((left, right) => left - right)

  if (sorted.length !== 5) {
    return false
  }

  return (
    sorted.every((value, index) => value === index + 1) ||
    sorted.every((value, index) => value === index + 2)
  )
}

function buildScore(rank: HandRank, tiebreak: number[]): number {
  return RANK_VALUES[rank] * SCORE_BAND + encodeTiebreak(tiebreak)
}

export function getDieLabel(value: DieValue): string {
  return CARD_LABELS[value]
}

export function scoreDice(dice: DieValue[]): ScoredHand {
  if (dice.length !== 5) {
    throw new Error('Poker dice scoring requires exactly 5 dice.')
  }

  const sorted = sortDescending(dice)
  const counts = countDice(sorted)
  const uniqueCount = counts.length

  if (uniqueCount === 1) {
    const tiebreak = [counts[0].value]
    return {
      rank: 'five_of_a_kind',
      label: `Five of a Kind (${getDieLabel(counts[0].value)})`,
      dice: sorted,
      tiebreak,
      score: buildScore('five_of_a_kind', tiebreak),
    }
  }

  if (counts[0].count === 4) {
    const tiebreak = [counts[0].value, counts[1].value]
    return {
      rank: 'four_of_a_kind',
      label: `Four of a Kind (${getDieLabel(counts[0].value)})`,
      dice: sorted,
      tiebreak,
      score: buildScore('four_of_a_kind', tiebreak),
    }
  }

  if (counts[0].count === 3 && counts[1].count === 2) {
    const tiebreak = [counts[0].value, counts[1].value]
    return {
      rank: 'full_house',
      label: `Full House (${getDieLabel(counts[0].value)} over ${getDieLabel(counts[1].value)})`,
      dice: sorted,
      tiebreak,
      score: buildScore('full_house', tiebreak),
    }
  }

  if (isStraight(sorted)) {
    const highCard = sorted[0]
    const tiebreak = [highCard]
    return {
      rank: 'straight',
      label: highCard === 6 ? 'High Straight' : 'Low Straight',
      dice: sorted,
      tiebreak,
      score: buildScore('straight', tiebreak),
    }
  }

  if (counts[0].count === 3) {
    const kickers = counts.slice(1).map(({ value }) => value)
    const tiebreak = [counts[0].value, ...kickers]
    return {
      rank: 'three_of_a_kind',
      label: `Three of a Kind (${getDieLabel(counts[0].value)})`,
      dice: sorted,
      tiebreak,
      score: buildScore('three_of_a_kind', tiebreak),
    }
  }

  if (counts[0].count === 2 && counts[1].count === 2) {
    const pairValues = counts.slice(0, 2).map(({ value }) => value)
    const kicker = counts[2].value
    const tiebreak = [...pairValues, kicker]
    return {
      rank: 'two_pair',
      label: `Two Pair (${getDieLabel(pairValues[0])} and ${getDieLabel(pairValues[1])})`,
      dice: sorted,
      tiebreak,
      score: buildScore('two_pair', tiebreak),
    }
  }

  if (counts[0].count === 2) {
    const pairValue = counts[0].value
    const kickers = counts.slice(1).map(({ value }) => value)
    const tiebreak = [pairValue, ...kickers]
    return {
      rank: 'one_pair',
      label: `One Pair (${getDieLabel(pairValue)})`,
      dice: sorted,
      tiebreak,
      score: buildScore('one_pair', tiebreak),
    }
  }

  const tiebreak = sortDescending(sorted)

  return {
    rank: 'bust',
    label: `Bust (${getDieLabel(tiebreak[0])} high)`,
    dice: sorted,
    tiebreak,
    score: buildScore('bust', tiebreak),
  }
}
