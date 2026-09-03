const IDENTITY_MODULE = 'https://esm.sh/@semaphore-protocol/identity@4.14.2'
const PROOF_MODULE = 'https://esm.sh/@semaphore-protocol/proof@4.14.2'
const GROUP_MODULE = 'https://esm.sh/@semaphore-protocol/group@4.14.2'
const ETHERS_MODULE = 'https://esm.sh/ethers@5.8.0'

let proofLibs = null

async function loadProofLibs() {
  if (proofLibs) {
    return proofLibs
  }

  const [identityMod, proofMod, groupMod, ethersMod] = await Promise.all([
    import(IDENTITY_MODULE),
    import(PROOF_MODULE),
    import(GROUP_MODULE),
    import(ETHERS_MODULE),
  ])

  const ethers = ethersMod.ethers ?? ethersMod.default
  if (ethers?.utils == null) {
    throw new Error('activation-proof: ethers.utils is missing from the CDN module')
  }

  if (typeof identityMod.Identity !== 'function') {
    throw new Error('activation-proof: Identity export is missing from the CDN module')
  }

  if (typeof proofMod.generateProof !== 'function') {
    throw new Error('activation-proof: generateProof export is missing from the CDN module')
  }

  if (typeof groupMod.Group !== 'function') {
    throw new Error('activation-proof: Group export is missing from the CDN module')
  }

  proofLibs = {
    Identity: identityMod.Identity,
    generateProof: proofMod.generateProof,
    Group: groupMod.Group,
    ethers,
  }

  return proofLibs
}

function createIdentity(libs, userSecret, label) {
  const identitySecret = libs.ethers.utils.keccak256(
    libs.ethers.utils.solidityPack(['bytes32', 'string'], [userSecret, label]),
  )
  return new libs.Identity(identitySecret)
}

export async function generateActivationProof({
  userSecret,
  label,
  commitments,
  scope,
  expectedMerkleTreeRoot,
}) {
  if (!Array.isArray(commitments) || commitments.length === 0) {
    throw new Error('generateActivationProof: group-members returned no commitments[]')
  }

  const libs = await loadProofLibs()
  const identity = createIdentity(libs, userSecret, label)
  const group = new libs.Group()

  for (const commitment of commitments) {
    group.addMember(BigInt(commitment))
  }

  if (group.indexOf(identity.commitment) === -1) {
    throw new Error('Activation secret does not match the current claim group')
  }

  const groupRoot = group.root.toString()
  if (expectedMerkleTreeRoot && groupRoot !== expectedMerkleTreeRoot) {
    throw new Error(
      `Claim group root mismatch. Client root ${groupRoot} does not match chain root ${expectedMerkleTreeRoot}`,
    )
  }

  const message = libs.ethers.BigNumber.from(
    libs.ethers.utils.formatBytes32String(label),
  ).toString()

  const proof = await libs.generateProof(identity, group, message, scope)

  return {
    merkleTreeDepth: proof.merkleTreeDepth,
    merkleTreeRoot: String(proof.merkleTreeRoot),
    nullifier: String(proof.nullifier),
    message: String(proof.message),
    scope: String(proof.scope),
    points: proof.points.map(String),
  }
}
