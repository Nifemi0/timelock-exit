import { parseAbi } from 'viem'

export const exitGuardAbi = parseAbi([
  'function arm(address vault_, address timelock_, bool anyCallToVault_, bytes4[] selectors_)',
  'function disarm(address vault_)',
  'function guardOf(address user_, address vault_) view returns (address timelock, bool anyCallToVault, bool armed, bytes4[] selectors)',
  'function redeemableShares(address user_, address vault_) view returns (uint256)',
  'event Exited(address indexed user, address indexed vault, bytes32 indexed operationId, uint256 shares, uint256 assets)',
  'event ExitSkipped(address indexed user, address indexed vault, bytes32 indexed operationId, uint8 reason)',
])

export const sentinelAbi = parseAbi([
  'function isGuarded(address timelock_, address user_, address vault_) view returns (bool)',
  'event ExitRequested(address indexed timelock, bytes32 indexed operationId, address indexed user, address vault, address target, bytes4 selector, uint256 delay)',
])

export const timelockAbi = parseAbi([
  'function getTimestamp(bytes32 id) view returns (uint256)',
  'function getMinDelay() view returns (uint256)',
  'event CallScheduled(bytes32 indexed id, uint256 indexed index, address target, uint256 value, bytes data, bytes32 predecessor, uint256 delay)',
])

export const vaultAbi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function deposit(uint256 assets, address receiver) returns (uint256)',
  'function previewRedeem(uint256 shares) view returns (uint256)',
  'function exitFeeBps() view returns (uint256)',
  'function name() view returns (string)',
])

export const tokenAbi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function mint(address to_, uint256 amount_)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
])

/** Functions the app can name in plain English when they appear in a queued call. */
export const knownCallsAbi = parseAbi([
  'function setExitFee(uint256 newBps_)',
  'function setTreasury(address newTreasury_)',
  'function transferOwnership(address newOwner)',
  'function grantRole(bytes32 role, address account)',
  'function upgradeTo(address newImplementation)',
  'function upgradeToAndCall(address newImplementation, bytes data)',
  'function upgradeAndCall(address proxy, address implementation, bytes data)',
])
