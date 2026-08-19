import { describe, expect, test } from 'vitest'
import registriesPayload from '../generated/1.21.1/registries.json'
import { ATTRIBUTE_OPERATIONS, EQUIPMENT_SLOTS, ITEM_COMPONENTS } from './item-components'

/**
 * The catalogue against the version it claims to describe.
 *
 * The component shapes are hand-authored — mcmeta publishes no schema for them — so
 * nothing else checks that a component this app offers is a component the game has.
 * These tests close that gap in the one direction data can: the ids are derived, so
 * they can be compared.
 */

const registries = registriesPayload.registries as unknown as Record<string, string[]>

describe('every authored component exists in the version it is offered for', () => {
  test('each id is in the data_component_type registry', () => {
    const known = new Set(registries.data_component_type)
    for (const spec of ITEM_COMPONENTS) {
      expect(known.has(spec.id), spec.id).toBe(true)
    }
  })

  test('the catalogue is sorted, which is also the order components are emitted in', () => {
    // Not cosmetic: serializeItemStack sorts the ids it emits, and the "add component"
    // picker offers them in this order. Keeping the two the same means what the user
    // reads in the form matches what they read in the output.
    const ids = ITEM_COMPONENTS.map((spec) => spec.id)
    expect(ids).toEqual([...ids].sort())
  })

  test('a default value is not treated as something to emit', () => {
    // Adding a component and touching nothing must not change the command. Otherwise
    // the form has said something the user did not.
    for (const spec of ITEM_COMPONENTS) {
      expect(spec.isEmpty(spec.defaultValue()), spec.id).toBe(true)
    }
  })
})

describe('the enum values a modifier is built from', () => {
  test('operations are the three the attribute system defines', () => {
    expect(ATTRIBUTE_OPERATIONS).toEqual([
      'add_value',
      'add_multiplied_base',
      'add_multiplied_total',
    ])
  })

  test('slot groups exclude the one that does not exist yet at this version', () => {
    // saddle arrives at 1.21.5. Offering it would be the same class of bug as
    // offering an item from another version: accepted by the picker, rejected by the
    // game. When a second version lands, this list becomes version data.
    expect(EQUIPMENT_SLOTS).not.toContain('saddle')
    expect(EQUIPMENT_SLOTS).toContain('any')
    expect(EQUIPMENT_SLOTS).toHaveLength(10)
  })
})
