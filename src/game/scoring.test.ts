import { describe, expect, it } from 'vitest'
import { scoreDice } from './scoring'

describe('scoreDice', () => {
  it('scores five of a kind', () => {
    expect(scoreDice([6, 6, 6, 6, 6]).rank).toBe('five_of_a_kind')
  })

  it('scores four of a kind', () => {
    expect(scoreDice([4, 4, 4, 4, 2]).rank).toBe('four_of_a_kind')
  })

  it('scores full house', () => {
    expect(scoreDice([5, 5, 5, 1, 1]).rank).toBe('full_house')
  })

  it('scores low straight', () => {
    const hand = scoreDice([1, 2, 3, 4, 5])
    expect(hand.rank).toBe('straight')
    expect(hand.label).toBe('Low Straight')
  })

  it('scores high straight', () => {
    const hand = scoreDice([2, 3, 4, 5, 6])
    expect(hand.rank).toBe('straight')
    expect(hand.label).toBe('High Straight')
  })

  it('scores three of a kind', () => {
    expect(scoreDice([3, 3, 3, 6, 1]).rank).toBe('three_of_a_kind')
  })

  it('scores two pair', () => {
    expect(scoreDice([2, 2, 5, 5, 6]).rank).toBe('two_pair')
  })

  it('scores one pair', () => {
    expect(scoreDice([1, 1, 3, 5, 6]).rank).toBe('one_pair')
  })

  it('scores bust hands', () => {
    expect(scoreDice([1, 2, 4, 5, 6]).rank).toBe('bust')
  })

  it('uses tie-breakers within a hand rank', () => {
    const strongerPair = scoreDice([6, 6, 2, 3, 4])
    const weakerPair = scoreDice([5, 5, 2, 3, 4])

    expect(strongerPair.score).toBeGreaterThan(weakerPair.score)
  })

  it('uses kickers to break ties when the pair matches', () => {
    const strongerKicker = scoreDice([4, 4, 6, 5, 1])
    const weakerKicker = scoreDice([4, 4, 6, 3, 1])

    expect(strongerKicker.score).toBeGreaterThan(weakerKicker.score)
  })
})
