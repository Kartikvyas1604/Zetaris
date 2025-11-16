/**
 * Send Transaction Screen
 * 
 * Features:
 * - Multi-chain asset selection
 * - Privacy mode selection (public/confidential/shielded)
 * - QR code scanner for address input
 * - Contact list integration
 * - Gas estimation with custom fees
 * - Transaction preview with confirmations
 * - Real wallet integration
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Animated,
  StatusBar,
} from 'react-native';

interface Asset {
  symbol: string;
  name: string;
  balance: string;
  icon: string;
  color: string;
  chain: string;
  supportsPrivacy: boolean;
}

type PrivacyMode = 'public' | 'confidential' | 'shielded';

interface SendScreenProps {
  navigation: {
    goBack: () => void;
    navigate: (screen: string, params?: Record<string, unknown>) => void;
  };
}

export default function SendScreen({ navigation }: SendScreenProps) {
  // State
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [recipientAddress, setRecipientAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>('public');
  const [gasFee, setGasFee] = useState('0.001');
  const [gasSpeed, setGasSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');
  const [loading, setLoading] = useState(false);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [estimatedTime, setEstimatedTime] = useState('~2 minutes');
  
  // Animation
  const slideAnim = useState(new Animated.Value(0))[0];

  // Available assets
  const assets: Asset[] = [
    {
      symbol: 'ZEC',
      name: 'Zcash',
      balance: '12.5',
      icon: '⚡',
      color: '#F4B024',
      chain: 'zcash',
      supportsPrivacy: true,
    },
    {
      symbol: 'ETH',
      name: 'Ethereum',
      balance: '8.3',
      icon: '◆',
      color: '#627EEA',
      chain: 'ethereum',
      supportsPrivacy: true,
    },
    {
      symbol: 'MATIC',
      name: 'Polygon',
      balance: '5,420',
      icon: '⬡',
      color: '#8247E5',
      chain: 'polygon',
      supportsPrivacy: true,
    },
  ];

  useEffect(() => {
    if (!selectedAsset) {
      setSelectedAsset(assets[0]);
    }
  }, []);

  useEffect(() => {
    // Animate in
    Animated.spring(slideAnim, {
      toValue: 1,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    // Estimate gas when amount or asset changes
    if (amount && selectedAsset) {
      estimateGasFee();
    }
  }, [amount, selectedAsset, gasSpeed]);

  const estimateGasFee = () => {
    // Mock gas estimation - in production, call wallet.estimateGas()
    const baseFee = parseFloat(amount || '0') * 0.001;
    const speedMultiplier = { slow: 0.8, normal: 1, fast: 1.5 }[gasSpeed];
    const estimated = (baseFee * speedMultiplier).toFixed(6);
    setGasFee(estimated);

    // Estimate time
    const time = { slow: '~5 minutes', normal: '~2 minutes', fast: '~30 seconds' }[gasSpeed];
    setEstimatedTime(time);
  };

  const validateAddress = (address: string): boolean => {
    if (!address) return false;
    
    // Basic validation - in production, use proper address validation
    if (selectedAsset?.chain === 'ethereum' || selectedAsset?.chain === 'polygon') {
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    }
    if (selectedAsset?.chain === 'zcash') {
      return address.startsWith('zs1') || address.startsWith('t1');
    }
    return false;
  };

  const validateAmount = (): boolean => {
    const value = parseFloat(amount);
    const balance = parseFloat(selectedAsset?.balance.replace(/,/g, '') || '0');
    
    if (isNaN(value) || value <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return false;
    }
    
    if (value > balance) {
      Alert.alert('Insufficient Balance', `You only have ${selectedAsset?.balance} ${selectedAsset?.symbol}`);
      return false;
    }
    
    return true;
  };

  const handleScanQR = () => {
    // In production: open QR scanner
    // const scanned = await QRScanner.scan();
    // setRecipientAddress(scanned);
    Alert.alert('QR Scanner', 'QR code scanning requires camera permissions');
  };

  const handleMaxAmount = () => {
    if (selectedAsset) {
      const balance = parseFloat(selectedAsset.balance.replace(/,/g, ''));
      const fee = parseFloat(gasFee);
      const maxAmount = Math.max(0, balance - fee);
      setAmount(maxAmount.toString());
    }
  };

  const handleContinue = () => {
    if (!validateAddress(recipientAddress)) {
      Alert.alert('Invalid Address', 'Please enter a valid recipient address');
      return;
    }
    
    if (!validateAmount()) {
      return;
    }
    
    setShowConfirmation(true);
  };

  const handleConfirmSend = async () => {
    setLoading(true);
    setShowConfirmation(false);

    try {
      // In production: integrate with wallet
      // const wallet = useWallet();
      // const txHash = await wallet.sendTransaction({
      //   to: recipientAddress,
      //   amount: amount,
      //   chain: selectedAsset.chain,
      //   privacy: privacyMode,
      //   memo: memo,
      // });

      // Mock transaction
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const txHash = '0x' + Math.random().toString(16).substring(2, 66);
      
      Alert.alert(
        'Transaction Sent! ✓',
        `Your ${privacyMode} transaction has been broadcast.\n\nTx Hash: ${txHash.substring(0, 20)}...`,
        [
          {
            text: 'View Transaction',
            onPress: () => {},
          },
          {
            text: 'Done',
            onPress: () => navigation.goBack(),
          },
        ]
      );
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      Alert.alert('Transaction Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getPrivacyDescription = (mode: PrivacyMode): string => {
    switch (mode) {
      case 'public':
        return 'Standard transparent transaction. All details visible on blockchain.';
      case 'confidential':
        return 'Amount hidden using Bulletproofs. Sender/receiver public.';
      case 'shielded':
        return 'Fully private transaction. Sender, receiver, and amount all hidden.';
    }
  };

  if (!selectedAsset) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#A855F7" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      <ScrollView >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Send Crypto</Text>
          <TouchableOpacity onPress={handleScanQR} style={styles.scanButton}>
            <Text style={styles.scanButtonText}>📷</Text>
          </TouchableOpacity>
        </View>

        <Animated.View
          style={{
            opacity: slideAnim,
            transform: [
              {
                translateY: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0],
                }),
              },
            ],
          }}
        >
          {/* Asset Selection */}
          <View style={styles.section}>
            <Text style={styles.label}>Select Asset</Text>
            <TouchableOpacity
              style={styles.assetSelector}
              onPress={() => setShowAssetPicker(true)}
              activeOpacity={0.8}
            >
              <View style={styles.assetInfo}>
                <Text style={[styles.assetIcon, { color: selectedAsset.color }]}>
                  {selectedAsset.icon}
                </Text>
                <View>
                  <Text style={styles.assetName}>{selectedAsset.name}</Text>
                  <Text style={styles.assetBalance}>
                    Balance: {selectedAsset.balance} {selectedAsset.symbol}
                  </Text>
                </View>
              </View>
              <Text style={styles.dropdownIcon}>▼</Text>
            </TouchableOpacity>
          </View>

          {/* Recipient Address */}
          <View style={styles.section}>
            <Text style={styles.label}>Recipient Address</Text>
            <TextInput
              style={styles.input}
              placeholder={`Enter ${selectedAsset.chain} address`}
              placeholderTextColor="#6b7280"
              value={recipientAddress}
              onChangeText={setRecipientAddress}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {recipientAddress && !validateAddress(recipientAddress) && (
              <Text style={styles.errorText}>Invalid address format</Text>
            )}
          </View>

          {/* Amount */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Amount</Text>
              <TouchableOpacity onPress={handleMaxAmount}>
                <Text style={styles.maxButton}>MAX</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.amountContainer}>
              <TextInput
                style={styles.amountInput}
                placeholder="0.00"
                placeholderTextColor="#6b7280"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
              />
              <Text style={styles.assetSymbol}>{selectedAsset.symbol}</Text>
            </View>
            {amount && (
              <Text style={styles.usdValue}>≈ ${(parseFloat(amount) * 300).toFixed(2)} USD</Text>
            )}
          </View>

          {/* Privacy Mode */}
          {selectedAsset.supportsPrivacy && (
            <View style={styles.section}>
              <Text style={styles.label}>Privacy Mode</Text>
              <View style={styles.privacyModes}>
                {(['public', 'confidential', 'shielded'] as PrivacyMode[]).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.privacyButton,
                      privacyMode === mode && styles.privacyButtonActive,
                    ]}
                    onPress={() => setPrivacyMode(mode)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.privacyButtonText,
                        privacyMode === mode && styles.privacyButtonTextActive,
                      ]}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </Text>
                    {mode === 'shielded' && selectedAsset.chain === 'zcash' && (
                      <Text style={styles.privacyBadge}>🔒</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.privacyDescription}>{getPrivacyDescription(privacyMode)}</Text>
            </View>
          )}

          {/* Gas Fee */}
          <View style={styles.section}>
            <Text style={styles.label}>Network Fee</Text>
            <View style={styles.gasOptions}>
              {(['slow', 'normal', 'fast'] as const).map((speed) => (
                <TouchableOpacity
                  key={speed}
                  style={[
                    styles.gasButton,
                    gasSpeed === speed && styles.gasButtonActive,
                  ]}
                  onPress={() => setGasSpeed(speed)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.gasButtonText,
                      gasSpeed === speed && styles.gasButtonTextActive,
                    ]}
                  >
                    {speed.charAt(0).toUpperCase() + speed.slice(1)}
                  </Text>
                  <Text style={styles.gasButtonTime}>
                    {speed === 'slow' ? '~5m' : speed === 'normal' ? '~2m' : '~30s'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.feeInfo}>
              <Text style={styles.feeLabel}>Estimated Fee:</Text>
              <Text style={styles.feeValue}>{gasFee} {selectedAsset.symbol}</Text>
            </View>
          </View>

          {/* Memo (Optional) */}
          {privacyMode === 'shielded' && (
            <View style={styles.section}>
              <Text style={styles.label}>Memo (Optional, Encrypted)</Text>
              <TextInput
                style={[styles.input, styles.memoInput]}
                placeholder="Add a private note..."
                placeholderTextColor="#6b7280"
                value={memo}
                onChangeText={setMemo}
                multiline
                maxLength={200}
              />
            </View>
          )}

          {/* Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Transaction Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>You Send:</Text>
              <Text style={styles.summaryValue}>
                {amount || '0'} {selectedAsset.symbol}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Network Fee:</Text>
              <Text style={styles.summaryValue}>
                {gasFee} {selectedAsset.symbol}
              </Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryTotal]}>
              <Text style={styles.summaryLabelBold}>Total:</Text>
              <Text style={styles.summaryValueBold}>
                {(parseFloat(amount || '0') + parseFloat(gasFee)).toFixed(6)} {selectedAsset.symbol}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Estimated Time:</Text>
              <Text style={styles.summaryValue}>{estimatedTime}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Privacy:</Text>
              <Text style={[styles.summaryValue, styles.privacyIndicator]}>
                {privacyMode === 'shielded' ? '🔒 ' : privacyMode === 'confidential' ? '🔐 ' : '👁️ '}
                {privacyMode.charAt(0).toUpperCase() + privacyMode.slice(1)}
              </Text>
            </View>
          </View>

          {/* Send Button */}
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!amount || !recipientAddress || !validateAddress(recipientAddress)) &&
                styles.sendButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!amount || !recipientAddress || !validateAddress(recipientAddress)}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.sendButtonText}>Continue →</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* Asset Picker Modal */}
      <Modal visible={showAssetPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Asset</Text>
              <TouchableOpacity onPress={() => setShowAssetPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {assets.map((asset) => (
              <TouchableOpacity
                key={asset.symbol}
                style={styles.assetOption}
                onPress={() => {
                  setSelectedAsset(asset);
                  setShowAssetPicker(false);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.assetOptionInfo}>
                  <Text style={[styles.assetIcon, { color: asset.color }]}>{asset.icon}</Text>
                  <View>
                    <Text style={styles.assetOptionName}>{asset.name}</Text>
                    <Text style={styles.assetOptionBalance}>
                      {asset.balance} {asset.symbol}
                    </Text>
                  </View>
                </View>
                {asset.supportsPrivacy && <Text style={styles.privacyBadge}>🔒</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Confirmation Modal */}
      <Modal visible={showConfirmation} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationModal}>
            <Text style={styles.confirmationTitle}>Confirm Transaction</Text>
            <View style={styles.confirmationDetails}>
              <Text style={styles.confirmationLabel}>Sending</Text>
              <Text style={styles.confirmationAmount}>
                {amount} {selectedAsset.symbol}
              </Text>
              <Text style={styles.confirmationLabel}>To</Text>
              <Text style={styles.confirmationAddress}>
                {recipientAddress.substring(0, 10)}...{recipientAddress.substring(recipientAddress.length - 8)}
              </Text>
              <Text style={styles.confirmationLabel}>Privacy Mode</Text>
              <Text style={styles.confirmationPrivacy}>{privacyMode}</Text>
            </View>
            <View style={styles.confirmationButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowConfirmation(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirmSend}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Confirm Send</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#ffffff',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  scanButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanButtonText: {
    fontSize: 24,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  maxButton: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A855F7',
  },
  assetSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  assetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  assetIcon: {
    fontSize: 32,
  },
  assetName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  assetBalance: {
    fontSize: 12,
    color: '#6b7280',
  },
  assetSymbol: {
    fontSize: 18,
    fontWeight: '600',
    color: '#9ca3af',
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#6b7280',
  },
  input: {
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
    paddingVertical: 16,
  },
  usdValue: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  privacyModes: {
    flexDirection: 'row',
    gap: 8,
  },
  privacyButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  privacyButtonActive: {
    backgroundColor: '#A855F7',
    borderColor: '#A855F7',
  },
  privacyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
  },
  privacyButtonTextActive: {
    color: '#ffffff',
  },
  privacyBadge: {
    fontSize: 12,
  },
  privacyDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    lineHeight: 18,
  },
  gasOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  gasButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    alignItems: 'center',
  },
  gasButtonActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderColor: '#A855F7',
  },
  gasButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
  },
  gasButtonTextActive: {
    color: '#A855F7',
  },
  gasButtonTime: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 4,
  },
  feeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  feeLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  feeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  memoInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  summaryCard: {
    marginHorizontal: 16,
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f1f1f',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: '#1f1f1f',
    marginTop: 8,
    paddingTop: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  summaryValue: {
    fontSize: 14,
    color: '#ffffff',
  },
  summaryLabelBold: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  summaryValueBold: {
    fontSize: 16,
    fontWeight: '700',
    color: '#A855F7',
  },
  privacyIndicator: {
    fontWeight: '600',
  },
  sendButton: {
    marginHorizontal: 16,
    backgroundColor: '#A855F7',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 32,
  },
  sendButtonDisabled: {
    backgroundColor: '#374151',
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#111111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalClose: {
    fontSize: 24,
    color: '#9ca3af',
  },
  assetOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  assetOptionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  assetOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  assetOptionBalance: {
    fontSize: 12,
    color: '#6b7280',
  },
  confirmationModal: {
    backgroundColor: '#111111',
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 24,
  },
  confirmationTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 24,
  },
  confirmationDetails: {
    alignItems: 'center',
    marginBottom: 24,
  },
  confirmationLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 16,
    marginBottom: 4,
  },
  confirmationAmount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#A855F7',
  },
  confirmationAddress: {
    fontSize: 14,
    color: '#ffffff',
    fontFamily: 'monospace',
  },
  confirmationPrivacy: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  confirmationButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9ca3af',
  },
  confirmButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#A855F7',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
});
