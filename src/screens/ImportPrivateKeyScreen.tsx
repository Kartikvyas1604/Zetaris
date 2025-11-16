/**
 * Import Private Key Screen
 * Import single account from private key
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MeshcryptWalletCore, ChainType } from '../core/meshcryptWalletCore';

interface ImportPrivateKeyScreenProps {
  navigation: {
    navigate: (screen: string) => void;
    goBack: () => void;
    reset: (config: { index: number; routes: Array<{ name: string }> }) => void;
  };
}

export default function ImportPrivateKeyScreen({ navigation }: ImportPrivateKeyScreenProps) {
  const [privateKey, setPrivateKey] = useState('');
  const [selectedChain, setSelectedChain] = useState<ChainType>(ChainType.ETHEREUM);
  const [accountName, setAccountName] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [derivedAddress, setDerivedAddress] = useState('');

  const chains = [
    { value: ChainType.ETHEREUM, label: 'Ethereum' },
    { value: ChainType.POLYGON, label: 'Polygon' },
    { value: ChainType.SOLANA, label: 'Solana' },
    { value: ChainType.BITCOIN, label: 'Bitcoin' },
  ];

  const handlePrivateKeyChange = async (text: string) => {
    setPrivateKey(text);
    setError('');
    
    // Try to derive address for preview
    if (text.length > 30) {
      try {
        const walletCore = new MeshcryptWalletCore();
        const account = await walletCore.importPrivateKey(text.trim(), selectedChain);
        setDerivedAddress(account.address);
      } catch {
        setDerivedAddress('');
      }
    } else {
      setDerivedAddress('');
    }
  };

  const handleImport = async () => {
    const trimmedKey = privateKey.trim();
    
    if (!trimmedKey) {
      setError('Please enter a private key');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const walletCore = new MeshcryptWalletCore();
      const account = await walletCore.importPrivateKey(trimmedKey, selectedChain);
      
      // Set default name if not provided
      if (accountName.trim()) {
        account.name = accountName.trim();
      }
      
      // Save imported account
      const existingWallet = await AsyncStorage.getItem('meshcrypt_wallet');
      if (existingWallet) {
        const wallet = JSON.parse(existingWallet);
        wallet.accounts.push({ ...account, isImported: true });
        await AsyncStorage.setItem('meshcrypt_wallet', JSON.stringify(wallet));
      } else {
        // Create new wallet with just this imported account
        const newWallet = {
          accounts: [{ ...account, isImported: true }],
          unifiedAddress: '',
          createdAt: Date.now(),
        };
        await AsyncStorage.setItem('meshcrypt_wallet', JSON.stringify(newWallet));
        await AsyncStorage.setItem('meshcrypt_has_wallet', 'true');
      }
      
      // Navigate to main wallet
      navigation.reset({
        index: 0,
        routes: [{ name: 'Wallet' }],
      });
      
      Alert.alert(
        'Success', 
        `Account imported!\nAddress: ${account.address.substring(0, 10)}...`
      );
    } catch (err) {
      setError('Invalid private key format for selected network');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Import Private Key</Text>
          <Text style={styles.subtitle}>
            Import a single account from its private key
          </Text>
        </View>

        {/* Network Selector */}
        <View style={styles.section}>
          <Text style={styles.label}>Select Network</Text>
          <View style={styles.chipContainer}>
            {chains.map((chain) => (
              <TouchableOpacity
                key={chain.value}
                style={[
                  styles.chip,
                  selectedChain === chain.value && styles.chipSelected,
                ]}
                onPress={() => {
                  setSelectedChain(chain.value);
                  setDerivedAddress('');
                }}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedChain === chain.value && styles.chipTextSelected,
                  ]}
                >
                  {chain.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Account Name */}
        <View style={styles.section}>
          <Text style={styles.label}>Account Name (Optional)</Text>
          <TextInput
            style={styles.input}
            value={accountName}
            onChangeText={setAccountName}
            placeholder="My Imported Account"
            placeholderTextColor="#6B7280"
          />
        </View>

        {/* Private Key Input */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Private Key</Text>
            <TouchableOpacity onPress={() => setShowKey(!showKey)}>
              <Text style={styles.toggleText}>{showKey ? '🙈 Hide' : '👁️ Show'}</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.textArea}
            value={privateKey}
            onChangeText={handlePrivateKeyChange}
            placeholder="Enter your private key"
            placeholderTextColor="#6B7280"
            multiline
            numberOfLines={4}
            secureTextEntry={!showKey}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.helperText}>
            {selectedChain === ChainType.ETHEREUM || selectedChain === ChainType.POLYGON
              ? 'Hex format (with or without 0x prefix)'
              : selectedChain === ChainType.SOLANA
              ? 'Base58 format'
              : 'WIF format (Wallet Import Format)'}
          </Text>
        </View>

        {/* Address Preview */}
        {derivedAddress ? (
          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>This will import address:</Text>
            <Text style={styles.previewAddress}>{derivedAddress}</Text>
          </View>
        ) : null}

        {/* Warning */}
        <View style={styles.warningBox}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <View style={styles.warningTextContainer}>
            <Text style={styles.warningTitle}>Important Security Notice</Text>
            <Text style={styles.warningText}>
              This account is NOT backed up by your seed phrase. Make sure to export and securely store this private key separately.
            </Text>
          </View>
        </View>

        {/* Error Message */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Import Button */}
        <TouchableOpacity
          style={[styles.button, (loading || !privateKey.trim()) && styles.buttonDisabled]}
          onPress={handleImport}
          disabled={loading || !privateKey.trim()}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Importing...' : 'Import Account'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    marginBottom: 16,
  },
  backButtonText: {
    color: '#7C3AED',
    fontSize: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  toggleText: {
    color: '#7C3AED',
    fontSize: 14,
    fontWeight: '500',
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    borderRadius: 8,
  },
  chipSelected: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  chipText: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  textArea: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#FFFFFF',
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    fontFamily: 'monospace',
  },
  helperText: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 6,
  },
  previewBox: {
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  previewLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 6,
  },
  previewAddress: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: '500',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  warningIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    color: '#FBBF24',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  warningText: {
    color: '#FCD34D',
    fontSize: 12,
    lineHeight: 18,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#7C3AED',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
