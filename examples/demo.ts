import { MeshcryptWallet } from '../src/wallet';

async function demoBasicOperations() {
  console.log('=== Meshcrypt Wallet Demo ===\n');

  const wallet = new MeshcryptWallet({
    network: 'testnet',
    enableMesh: true,
    enableNFC: true,
    privacyLevel: 'maximum',
    meshProtocols: ['bluetooth', 'wifi', 'lora']
  });

  console.log('1. Initializing wallet with new mnemonic...');
  await wallet.initialize();
  console.log('   ✓ Wallet initialized');
  console.log('   Meta Address:', wallet.getMetaAddress());

  console.log('\n2. Getting multi-chain balances...');
  const balances = await wallet.getBalance();
  for (const balance of balances) {
    console.log(`   ${balance.chain}: ${balance.confirmed} ${balance.token}`);
  }

  console.log('\n3. Retrieving chain-specific addresses...');
  const ethAddress = await wallet.getAddress('ethereum');
  const zcashAddress = await wallet.getAddress('zcash');
  console.log(`   Ethereum: ${ethAddress}`);
  console.log(`   Zcash: ${zcashAddress}`);

  console.log('\n4. Mesh network status...');
  const peers = await wallet.getMeshPeers();
  console.log(`   Connected to ${peers.length} peers`);
  for (const peer of peers.slice(0, 3)) {
    console.log(`   - ${peer.protocol}: ${peer.id.substring(0, 8)}... (latency: ${peer.latency}ms)`);
  }

  console.log('\n5. Creating cross-chain payment intent...');
  const intentId = await wallet.createCrossChainIntent(
    'ethereum',
    'ETH',
    '1.0',
    'zcash',
    'ZEC',
    '0.95'
  );
  console.log(`   Intent created: ${intentId}`);

  console.log('\n6. Fetching solver proposals...');
  const proposals = await wallet.getIntentProposals(intentId);
  console.log(`   Received ${proposals.length} proposals`);
  for (const proposal of proposals.slice(0, 2)) {
    console.log(`   - Solver ${proposal.solverId.substring(0, 8)}...`);
    console.log(`     Output: ${proposal.outputAmount}, Fee: ${proposal.fee}`);
    console.log(`     Reputation: ${proposal.reputation.toFixed(1)}`);
  }

  console.log('\n7. Generating stealth address...');
  const recipientKey = await wallet.getAddress('ethereum');
  const recipientBytes = new TextEncoder().encode(recipientKey);
  const stealth = await wallet.generateStealthAddress(recipientBytes);
  console.log(`   Stealth address: ${stealth.stealthAddress.substring(0, 20)}...`);

  console.log('\n8. Estimating transaction fee...');
  const fee = await wallet.estimateFee({
    to: ethAddress,
    amount: '0.1',
    chain: 'ethereum'
  });
  console.log(`   Estimated fee: ${fee} ETH`);

  console.log('\n9. Exporting wallet...');
  const exportData = await wallet.exportWallet('secure-password');
  console.log(`   Wallet exported (${exportData.length} bytes)`);

  console.log('\n10. Cleanup...');
  await wallet.destroy();
  console.log('   ✓ Wallet destroyed securely');

  console.log('\n=== Demo Complete ===');
}

async function demoCrossChainSwap() {
  console.log('\n=== Cross-Chain Swap Demo ===\n');

  const wallet = new MeshcryptWallet({
    network: 'testnet',
    enableMesh: false,
    enableNFC: false,
    privacyLevel: 'balanced'
  });

  await wallet.initialize();

  console.log('Creating intent to swap 1 ETH for ZEC...');
  const intentId = await wallet.createCrossChainIntent(
    'ethereum',
    'ETH',
    '1.0',
    'zcash',
    'ZEC',
    '15.0'
  );

  console.log(`Intent ID: ${intentId}\n`);

  console.log('Waiting for solver proposals...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  const proposals = await wallet.getIntentProposals(intentId);
  console.log(`Received ${proposals.length} proposals:\n`);

  for (let i = 0; i < proposals.length; i++) {
    const p = proposals[i];
    console.log(`Proposal ${i + 1}:`);
    console.log(`  Solver: ${p.solverId}`);
    console.log(`  Output: ${p.outputAmount} ZEC`);
    console.log(`  Fee: ${p.fee} ETH`);
    console.log(`  Time: ~${p.estimatedTime}s`);
    console.log(`  Route: ${p.route.length} hops`);
    console.log(`  Reputation: ${p.reputation.toFixed(1)}/100\n`);
  }

  if (proposals.length > 0) {
    const bestProposal = proposals[0];
    console.log(`Accepting best proposal from ${bestProposal.solverId}...`);
    
    const accepted = await wallet.acceptIntentProposal(intentId, bestProposal.solverId);
    console.log(accepted ? '✓ Proposal accepted' : '✗ Proposal rejected');
  }

  await wallet.destroy();
}

async function demoPrivacyFeatures() {
  console.log('\n=== Privacy Features Demo ===\n');

  const wallet = new MeshcryptWallet({
    network: 'testnet',
    enableMesh: true,
    enableNFC: false,
    privacyLevel: 'maximum'
  });

  await wallet.initialize();

  console.log('1. Shielded transaction on Zcash:');
  console.log('   Using zk-SNARKs to hide sender, receiver, and amount');
  console.log('   Transaction will be completely private on-chain\n');

  console.log('2. Stealth addresses:');
  const recipientKey = new Uint8Array(33).fill(1);
  const stealth1 = await wallet.generateStealthAddress(recipientKey);
  const stealth2 = await wallet.generateStealthAddress(recipientKey);
  console.log(`   Address 1: ${stealth1.stealthAddress.substring(0, 30)}...`);
  console.log(`   Address 2: ${stealth2.stealthAddress.substring(0, 30)}...`);
  console.log('   Each transaction uses a unique unlinkable address\n');

  console.log('3. Mesh network privacy:');
  const peers = await wallet.getMeshPeers();
  console.log(`   Routing through ${peers.length} intermediate peers`);
  console.log('   End-to-end encrypted with forward secrecy');
  console.log('   Onion-style layered encryption hides source\n');

  console.log('4. Meta-address resolution:');
  const metaAddr = wallet.getMetaAddress();
  console.log(`   Public meta-address: ${metaAddr}`);
  console.log('   Maps to chain-specific addresses via encrypted lookup');
  console.log('   Prevents linking different chain identities\n');

  console.log('5. Privacy-preserving analytics:');
  console.log('   Transaction data encrypted with homomorphic encryption');
  console.log('   Allows aggregate statistics without revealing individual txs');
  console.log('   Differential privacy adds calibrated noise\n');

  await wallet.destroy();
}

async function main() {
  try {
    await demoBasicOperations();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await demoCrossChainSwap();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await demoPrivacyFeatures();
  } catch (error) {
    console.error('Demo error:', error);
  }
}

main();
