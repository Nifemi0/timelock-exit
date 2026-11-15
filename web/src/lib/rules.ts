import { toFunctionSelector, type Hex } from 'viem'

export type RuleId = 'fee' | 'upgrade' | 'owner'

export interface RulePreset {
  id: RuleId
  label: string
  hint: string
  signatures: string[]
}

/** Named kinds of change. Each expands to function selectors watched on any target. */
export const presets: RulePreset[] = [
  {
    id: 'fee',
    label: 'Fee change',
    hint: 'setExitFee',
    signatures: ['setExitFee(uint256)'],
  },
  {
    id: 'upgrade',
    label: 'Contract upgrade',
    hint: 'upgradeTo, upgradeToAndCall, upgradeAndCall',
    signatures: ['upgradeTo(address)', 'upgradeToAndCall(address,bytes)', 'upgradeAndCall(address,address,bytes)'],
  },
  {
    id: 'owner',
    label: 'New owner',
    hint: 'transferOwnership, grantRole',
    signatures: ['transferOwnership(address)', 'grantRole(bytes32,address)'],
  },
]

/** ExitGuard accepts at most this many selectors per guard. */
export const MAX_SELECTORS = 8

const selectorsOf = (preset: RulePreset): Hex[] => preset.signatures.map(s => toFunctionSelector(`function ${s}`))

export function selectorsFor(ids: RuleId[]): Hex[] {
  return presets.filter(p => ids.includes(p.id)).flatMap(selectorsOf)
}

/** Which presets are fully covered by a guard's selector list. */
export function presetsIn(selectors: readonly Hex[]): RuleId[] {
  const have = new Set(selectors.map(s => s.toLowerCase()))
  return presets.filter(p => selectorsOf(p).every(s => have.has(s.toLowerCase()))).map(p => p.id)
}
