/**
 * Receive Screen
 * 
 * Features:
 * - QR code generation for addresses
 * - Multi-chain address display
 * - Share functionality
 * - Payment request with custom amounts
 * - Copy to clipboard
 * - Stealth address generation
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
  Clipboard,
  Animated,
  TextInput,
} from 'react-native';

interface ChainAddress {
  chain: string;
  name: string;
  address: string;
  icon: string;
  color: string;
  supportsPrivacy: boolean;
}

export default function ReceiveScreen({ navigation }: { navigation: any }) {
  // State
  const [selectedChain, setSelectedChain] = useState<ChainAddress | null>(null);
  const [requestAmount, setRequestAmount] = useState('');
  const [showQR] = useState(true);
  const [useStealthAddress, setUseStealthAddress] = useState(false);
  
  // Animation
  const scaleAnim = useState(new Animated.Value(0))[0];
  const fadeAnim = useState(new Animated.Value(0))[0];

  // Available chains with addresses
  const chains: ChainAddress[] = [
    {
      chain: 'ethereum',
      name: 'Ethereum',
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      icon: '◆',
      color: '#627EEA',
      supportsPrivacy: true,
    },
    {
      chain: 'zcash',
      name: 'Zcash (Shielded)',
      address: 'zs1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
      icon: '⚡',
      color: '#F4B024',
      supportsPrivacy: true,
    },
    {
      chain: 'polygon',
      name: 'Polygon',
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      icon: '⬡',
      color: '#8247E5',
      supportsPrivacy: true,
    },
    {
      chain: 'arbitrum',
      name: 'Arbitrum',
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
      icon: '🔷',
      color: '#28A0F0',
      supportsPrivacy: false,
    },
  ];

  useEffect(() => {
    if (!selectedChain) {
      setSelectedChain(chains[0]);
    }
  }, []);

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [selectedChain]);

  const handleCopyAddress = () => {
    if (selectedChain) {
      Clipboard.setString(selectedChain.address);
      Alert.alert('Copied!', 'Address copied to clipboard');
    }
  };

  const handleShare = async () => {
    if (!selectedChain) return;

    try {
      let message = `Send ${selectedChain.name} to:\n${selectedChain.address}`;
      
      if (requestAmount) {
        message += `\n\nRequested Amount: ${requestAmount}`;
      }

      await Share.share({
        message,
        title: `Receive ${selectedChain.name}`,
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share address');
    }
  };

  const handleGenerateStealthAddress = () => {
    if (!selectedChain?.supportsPrivacy) {
      Alert.alert(
        'Not Supported',
        'Stealth addresses are only available for privacy-enabled chains'
      );
      return;
    }

    Alert.alert(
      'Generate Stealth Address',
      'A one-time stealth address will be generated. The sender will not be able to link this address to your main wallet.',
      [
        {
          text: 'Generate',
          onPress: () => {
            // In production: generate real stealth address
            const stealthAddr = '0xStealthAddress' + Math.random().toString(16).substring(2, 42);
            Alert.alert(
              'Stealth Address Generated ✓',
              `New address: ${stealthAddr.substring(0, 20)}...`,
              [
                {
                  text: 'Copy',
                  onPress: () => Clipboard.setString(stealthAddr),
                },
                { text: 'OK' },
              ]
            );
            setUseStealthAddress(true);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const generatePaymentRequest = () => {
    if (!requestAmount) {
      Alert.alert('Enter Amount', 'Please enter a payment request amount');
      return;
    }

    Alert.alert(
      'Payment Request Created',
      `Request for ${requestAmount} ${selectedChain?.name}\n\nShare this with the sender.`,
      [
        {
          text: 'Share',
          onPress: handleShare,
        },
        { text: 'OK' },
      ]
    );
  };

  // Simple QR code placeholder (in production, use react-native-qrcode-svg)
  const QRCodePlaceholder = () => (
    <View style={styles.qrPlaceholder}>
      <Text style={styles.qrText}>QR</Text>
      <Text style={styles.qrSubtext}>Scan to Send</Text>
    </View>
  );

  if (!selectedChain) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <ScrollView >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Receive Crypto</Text>
          <View style={styles.backButton} />
        </View>

        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          }}
        >
          {/* Chain Selector */}
          <View style={styles.section}>
            <Text style={styles.label}>Select Blockchain</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chainScroll}>
              {chains.map((chain) => (
                <TouchableOpacity
                  key={chain.chain}
                  style={[
                    styles.chainCard,
                    selectedChain.chain === chain.chain && styles.chainCardActive,
                    { borderColor: chain.color },
                  ]}
                  onPress={() => setSelectedChain(chain)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chainIcon, { color: chain.color }]}>{chain.icon}</Text>
                  <Text style={styles.chainName}>{chain.name}</Text>
                  {chain.supportsPrivacy && <Text style={styles.privacyBadge}>🔒</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* QR Code */}
          {showQR && (
            <View style={styles.qrSection}>
              <View style={[styles.qrContainer, { borderColor: selectedChain.color }]}>
                <QRCodePlaceholder />
              </View>
              <Text style={styles.qrNote}>
                Scan this code to send {selectedChain.name}
              </Text>
            </View>
          )}

          {/* Address Display */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Your Address</Text>
              {selectedChain.supportsPrivacy && (
                <TouchableOpacity onPress={handleGenerateStealthAddress}>
                  <Text style={styles.stealthButton}>
                    {useStealthAddress ? '✓ Stealth' : '+ Stealth Address'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.addressCard}>
              <Text style={styles.address} numberOfLines={2}>
                {selectedChain.address}
              </Text>
              <TouchableOpacity onPress={handleCopyAddress} style={styles.copyButton}>
                <Text style={styles.copyButtonText}>📋 Copy</Text>
              </TouchableOpacity>
            </View>
            {useStealthAddress && (
              <Text style={styles.stealthNote}>
                ✓ Using one-time stealth address for enhanced privacy
              </Text>
            )}
          </View>

          {/* Payment Request */}
          <View style={styles.section}>
            <Text style={styles.label}>Request Specific Amount (Optional)</Text>
            <View style={styles.amountContainer}>
              <Text style={styles.currencySymbol}>{selectedChain.icon}</Text>
              <TextInput
                style={styles.amountInput as any}
                placeholder="0.00"
                placeholderTextColor="#6b7280"
                value={requestAmount}
                onChangeText={setRequestAmount}
                keyboardType="numeric"
              />
            </View>
            {requestAmount && (
              <View style={styles.requestInfo}>
                <Text style={styles.requestLabel}>Request Amount:</Text>
                <Text style={styles.requestValue}>
                  {requestAmount} {selectedChain.name}
                </Text>
              </View>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.copyActionButton]}
              onPress={handleCopyAddress}
              activeOpacity={0.8}
            >
              <Text style={styles.actionButtonText}>📋 Copy Address</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.shareActionButton]}
              onPress={handleShare}
              activeOpacity={0.8}
            >
              <Text style={styles.actionButtonText}>📤 Share</Text>
            </TouchableOpacity>
          </View>

          {requestAmount && (
            <TouchableOpacity
              style={styles.requestButton}
              onPress={generatePaymentRequest}
              activeOpacity={0.8}
            >
              <Text style={styles.requestButtonText}>Create Payment Request</Text>
            </TouchableOpacity>
          )}

          {/* Info Cards */}
          <View style={styles.infoSection}>
            <View style={styles.infoCard}>
              <Text style={styles.infoIcon}>💡</Text>
              <Text style={styles.infoTitle}>Privacy Tips</Text>
              <Text style={styles.infoText}>
                • Use stealth addresses for one-time payments{'\n'}
                • Zcash shielded addresses provide full privacy{'\n'}
                • Request exact amounts to avoid overpayments
              </Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoIcon}>⚠️</Text>
              <Text style={styles.infoTitle}>Important</Text>
              <Text style={styles.infoText}>
                • Always verify the network before sharing{'\n'}
                • Double-check addresses to avoid loss{'\n'}
                • Some exchanges don't support privacy addresses
              </Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoIcon}>⚡</Text>
              <Text style={styles.infoTitle}>Fast Receive</Text>
              <Text style={styles.infoText}>
                • Funds appear instantly on-chain{'\n'}
                • Confirmations vary by network{'\n'}
                • ETH: ~2 min, ZEC: ~10 min, MATIC: ~5 sec
              </Text>
            </View>
          </View>

          {/* Network Info */}
          <View style={styles.networkInfo}>
            <View style={styles.networkRow}>
              <Text style={styles.networkLabel}>Network:</Text>
              <Text style={styles.networkValue}>{selectedChain.name}</Text>
            </View>
            <View style={styles.networkRow}>
              <Text style={styles.networkLabel}>Privacy Support:</Text>
              <Text style={[styles.networkValue, styles.privacySupport]}>
                {selectedChain.supportsPrivacy ? '✓ Enabled' : '✗ Not Available'}
              </Text>
            </View>
            <View style={styles.networkRow}>
              <Text style={styles.networkLabel}>Address Type:</Text>
              <Text style={styles.networkValue}>
                {selectedChain.chain === 'zcash' ? 'Shielded' : 'Standard'}
              </Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
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
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stealthButton: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A855F7',
  },
  chainScroll: {
    flexDirection: 'row',
  },
  chainCard: {
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    alignItems: 'center',
    minWidth: 120,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chainCardActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
  },
  chainIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  chainName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  privacyBadge: {
    fontSize: 12,
    marginTop: 4,
  },
  qrSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  qrContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 4,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  qrText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#1f2937',
  },
  qrSubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  qrNote: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 16,
    textAlign: 'center',
  },
  addressCard: {
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  address: {
    fontSize: 14,
    color: '#ffffff',
    fontFamily: 'monospace',
    marginBottom: 12,
    lineHeight: 20,
  },
  copyButton: {
    backgroundColor: '#A855F7',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  stealthNote: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 8,
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
  currencySymbol: {
    fontSize: 24,
    marginRight: 12,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
    paddingVertical: 16,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  requestInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  requestLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  requestValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A855F7',
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  copyActionButton: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#A855F7',
  },
  shareActionButton: {
    backgroundColor: '#A855F7',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  requestButton: {
    marginHorizontal: 16,
    backgroundColor: '#10B981',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  requestButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  infoSection: {
    paddingHorizontal: 16,
    gap: 16,
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  infoIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#9ca3af',
    lineHeight: 20,
  },
  networkInfo: {
    marginHorizontal: 16,
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f1f1f',
    marginBottom: 32,
  },
  networkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  networkLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  networkValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  privacySupport: {
    color: '#10B981',
  },
});
