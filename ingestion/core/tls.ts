import tls from 'node:tls'

import { GODADDY_G2_INTERMEDIATE } from '../certs/godaddy-g2-intermediate'

/**
 * Some sources serve an incomplete certificate chain: Dollarcity sends only
 * its own certificate, without GoDaddy's intermediate. Browsers and Windows
 * fetch the missing piece on their own; Node does not, and refuses with
 * UNABLE_TO_VERIFY_LEAF_SIGNATURE (ING-009).
 *
 * The fix adds that PUBLIC intermediate to the trusted set. It does NOT turn
 * verification off: the chain is still checked up to a root Node already
 * trusts.
 */
export function trustMissingIntermediates(): void {
  tls.setDefaultCACertificates([...tls.getCACertificates('default'), GODADDY_G2_INTERMEDIATE])
}
