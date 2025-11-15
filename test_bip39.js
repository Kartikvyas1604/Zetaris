const bip39 = require('@scure/bip39');
const {wordlist} = require('@scure/bip39/wordlists/english');

// Test generate
const mnemonic = bip39.generateMnemonic(wordlist, 256);
console.log('Generated:', mnemonic);
console.log('Valid:', bip39.validateMnemonic(mnemonic, wordlist));
