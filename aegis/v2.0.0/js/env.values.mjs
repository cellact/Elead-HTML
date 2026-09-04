/**
 * Public product config. Override locally with js/env.local.mjs.
 * Keep this file free of secrets.
 */
export const envValues = {
  productLabel: 'Aegis',
  productDescription:
    'A private line to the service provider. No phone. No email.',
  productImage: '',
  packageType: 'ENS',
  sessionRange: 50,
  messageRange: 40,
  groupMembersUrl: 'https://elead-backend-309305771885.us-central1.run.app/group-members',
  activateUrl: 'https://elead-backend-309305771885.us-central1.run.app/activateWithProof',
  ensRpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
  publicResolver: '0x7f011d304B63654d190717D1f77F29FAB21a858b',
  ensChainId: 11155111,
  inboxFeedUrl: 'https://elead-backend-309305771885.us-central1.run.app/inboxFeed',
}
