/**
 * Swap/Exchange Screen
 * 
 * Features:
 * - Cross-chain atomic swaps
 * - DEX integration (Uniswap, SushiSwap, etc.)
 * - Privacy-preserving swaps via bridge
 * - Slippage protection
 * - Price impact calculation
 * - Best route finding
 * - Real-time price quotes
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

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
} from 'react-native';

interface Token {
  symbol: string;
  name: string;
  balance: string;
  icon: string;
  color: string;
  chain: string;
  price: number;
}

interface SwapRoute {
  fromToken: Token;
  toToken: Token;
  fromAmount: string;
  toAmount: string;
  rate: number;
  priceImpact: number;
  fee: string;
  route: string[];
  estimatedTime: string;
  isPrivate: boolean;
}

export default function SwapScreen({ navigation }: { navigation: any }) {
  // State
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [slippage, setSlippage] = useState('0.5');
  const [usePrivacyBridge, setUsePrivacyBridge] = useState(false);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [bestRoute, setBestRoute] = useState<SwapRoute | null>(null);
  const [priceRefreshTimer, setPriceRefreshTimer] = useState(30);
  
  // Animation
  const rotateAnim = useState(new Animated.Value(0))[0];

  // Available tokens
  const tokens: Token[] = [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      balance: '8.3',
      icon: '◆',
      color: '#627EEA',
      chain: 'ethereum',
      price: 2000,
    },
    {
      symbol: 'ZEC',
      name: 'Zcash',
      balance: '12.5',
      icon: '⚡',
      color: '#F4B024',
      chain: 'zcash',
      price: 300,
    },
    {
      symbol: 'MATIC',
      name: 'Polygon',
      balance: '5,420',
      icon: '⬡',
      color: '#8247E5',
      chain: 'polygon',
      price: 0.78,
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      balance: '10,000',
      icon: '$',
      color: '#2775CA',
      chain: 'ethereum',
      price: 1,
    },
    {
      symbol: 'USDT',
      name: 'Tether',
      balance: '5,000',
      icon: '$',
      color: '#26A17B',
      chain: 'polygon',
      price: 1,
    },
  ];

  useEffect(() => {
    if (!fromToken || !toToken) {
      setFromToken(tokens[0]);
      setToToken(tokens[1]);
    }
  }, []);

  useEffect(() => {
    // Price refresh countdown
    const timer = setInterval(() => {
      setPriceRefreshTimer((prev) => {
        if (prev <= 1) {
          if (fromAmount && fromToken && toToken) {
            calculateSwap(fromAmount);
          }
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fromAmount, fromToken, toToken]);

  useEffect(() => {
    if (fromAmount && fromToken && toToken) {
      calculateSwap(fromAmount);
    }
  }, [fromAmount, fromToken, toToken, usePrivacyBridge]);

  const calculateSwap = async (amount: string) => {
    if (!amount || !fromToken || !toToken || parseFloat(amount) <= 0) {
      setToAmount('');
      setBestRoute(null);
      return;
    }

    setLoading(true);

    try {
      // In production: call DEX aggregator API
      // Mock calculation
      await new Promise((resolve) => setTimeout(resolve, 800));

      const fromValue = parseFloat(amount) * fromToken.price;
      const fee = fromValue * 0.003; // 0.3% fee
      const toValue = fromValue - fee;
      const calculated = (toValue / toToken.price).toFixed(6);

      setToAmount(calculated);

      // Calculate best route
      const isCrossChain = fromToken.chain !== toToken.chain;
      const priceImpact = (fee / fromValue) * 100;

      const route: SwapRoute = {
        fromToken,
        toToken,
        fromAmount: amount,
        toAmount: calculated,
        rate: toToken.price / fromToken.price,
        priceImpact,
        fee: fee.toFixed(2),
        route: isCrossChain
          ? [fromToken.chain, 'bridge', toToken.chain, toToken.symbol]
          : [fromToken.chain, 'dex', toToken.symbol],
        estimatedTime: isCrossChain ? '~5 minutes' : '~30 seconds',
        isPrivate: usePrivacyBridge && isCrossChain,
      };

      setBestRoute(route);
    } catch (error) {
      Alert.alert('Error', 'Failed to calculate swap rate');
    } finally {
      setLoading(false);
    }
  };

  const handleSwapTokens = () => {
    // Animate rotation
    Animated.timing(rotateAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      rotateAnim.setValue(0);
    });

    // Swap tokens
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const handleMaxAmount = () => {
    if (fromToken) {
      const balance = parseFloat(fromToken.balance.replace(/,/g, ''));
      setFromAmount(balance.toString());
    }
  };

  const handleExecuteSwap = async () => {
    if (!bestRoute) {
      Alert.alert('Error', 'No swap route available');
      return;
    }

    const balance = parseFloat(fromToken?.balance.replace(/,/g, '') || '0');
    const amount = parseFloat(fromAmount);

    if (amount > balance) {
      Alert.alert('Insufficient Balance', `You only have ${fromToken?.balance} ${fromToken?.symbol}`);
      return;
    }

    Alert.alert(
      'Confirm Swap',
      `Swap ${fromAmount} ${fromToken?.symbol} for ${toAmount} ${toToken?.symbol}?\n\n` +
        `Rate: 1 ${fromToken?.symbol} = ${bestRoute.rate.toFixed(6)} ${toToken?.symbol}\n` +
        `Fee: $${bestRoute.fee}\n` +
        `Price Impact: ${bestRoute.priceImpact.toFixed(2)}%\n` +
        `Route: ${bestRoute.route.join(' → ')}\n` +
        `${usePrivacyBridge ? '\n🔒 Privacy-preserving swap via bridge' : ''}`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Confirm Swap',
          onPress: async () => {
            setLoading(true);
            try {
              // In production: execute swap via SDK
              // await sdk.swap({ ... });
              
              await new Promise((resolve) => setTimeout(resolve, 2000));
              
              Alert.alert(
                'Swap Successful! ✓',
                `Swapped ${fromAmount} ${fromToken?.symbol} for ${toAmount} ${toToken?.symbol}`,
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
            } catch (error: any) {
              Alert.alert('Swap Failed', error.message || 'An error occurred');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  if (!fromToken || !toToken) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#A855F7" />
      </View>
    );
  }

  const isCrossChain = fromToken.chain !== toToken.chain;

  return (
    <View style={styles.container}>
      <ScrollView >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Swap</Text>
          <TouchableOpacity onPress={() => setPriceRefreshTimer(30)} style={styles.refreshButton}>
            <Text style={styles.refreshText}>🔄 {priceRefreshTimer}s</Text>
          </TouchableOpacity>
        </View>

        {/* From Token */}
        <View style={styles.section}>
          <Text style={styles.label}>From</Text>
          <TouchableOpacity
            style={styles.tokenCard}
            onPress={() => setShowFromPicker(true)}
            activeOpacity={0.8}
          >
            <View style={styles.tokenInfo}>
              <Text style={[styles.tokenIcon, { color: fromToken.color }]}>{fromToken.icon}</Text>
              <View>
                <Text style={styles.tokenSymbol}>{fromToken.symbol}</Text>
                <Text style={styles.tokenChain}>{fromToken.chain}</Text>
              </View>
            </View>
            <Text style={styles.dropdownIcon}>▼</Text>
          </TouchableOpacity>

          <View style={styles.amountContainer}>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor="#6b7280"
              value={fromAmount}
              onChangeText={setFromAmount}
              keyboardType="numeric"
            />
            <TouchableOpacity onPress={handleMaxAmount}>
              <Text style={styles.maxButton}>MAX</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Balance: {fromToken.balance}</Text>
            {fromAmount && (
              <Text style={styles.usdValue}>≈ ${(parseFloat(fromAmount) * fromToken.price).toFixed(2)}</Text>
            )}
          </View>
        </View>

        {/* Swap Button */}
        <View style={styles.swapButtonContainer}>
          <TouchableOpacity onPress={handleSwapTokens} style={styles.swapButton} activeOpacity={0.8}>
            <Animated.Text style={[styles.swapIcon, { transform: [{ rotate: spin }] }]}>
              ⇅
            </Animated.Text>
          </TouchableOpacity>
        </View>

        {/* To Token */}
        <View style={styles.section}>
          <Text style={styles.label}>To (Estimated)</Text>
          <TouchableOpacity
            style={styles.tokenCard}
            onPress={() => setShowToPicker(true)}
            activeOpacity={0.8}
          >
            <View style={styles.tokenInfo}>
              <Text style={[styles.tokenIcon, { color: toToken.color }]}>{toToken.icon}</Text>
              <View>
                <Text style={styles.tokenSymbol}>{toToken.symbol}</Text>
                <Text style={styles.tokenChain}>{toToken.chain}</Text>
              </View>
            </View>
            <Text style={styles.dropdownIcon}>▼</Text>
          </TouchableOpacity>

          <View style={styles.amountContainer}>
            <TextInput
              style={[styles.amountInput, styles.amountInputDisabled]}
              placeholder="0.00"
              placeholderTextColor="#6b7280"
              value={loading ? 'Calculating...' : toAmount}
              editable={false}
            />
          </View>

          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Balance: {toToken.balance}</Text>
            {toAmount && (
              <Text style={styles.usdValue}>≈ ${(parseFloat(toAmount) * toToken.price).toFixed(2)}</Text>
            )}
          </View>
        </View>

        {/* Cross-Chain Privacy Option */}
        {isCrossChain && (
          <View style={styles.privacyOption}>
            <View style={styles.privacyInfo}>
              <Text style={styles.privacyTitle}>🔒 Privacy Bridge</Text>
              <Text style={styles.privacyDesc}>Use zero-knowledge proofs for cross-chain swap</Text>
            </View>
            <TouchableOpacity
              style={[styles.toggle, usePrivacyBridge && styles.toggleActive]}
              onPress={() => setUsePrivacyBridge(!usePrivacyBridge)}
              activeOpacity={0.8}
            >
              <View style={[styles.toggleKnob, usePrivacyBridge && styles.toggleKnobActive]} />
            </TouchableOpacity>
          </View>
        )}

        {/* Slippage Settings */}
        <View style={styles.section}>
          <Text style={styles.label}>Slippage Tolerance</Text>
          <View style={styles.slippageOptions}>
            {['0.1', '0.5', '1.0', '3.0'].map((value) => (
              <TouchableOpacity
                key={value}
                style={[styles.slippageButton, slippage === value && styles.slippageButtonActive]}
                onPress={() => setSlippage(value)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.slippageButtonText,
                    slippage === value && styles.slippageButtonTextActive,
                  ]}
                >
                  {value}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Swap Details */}
        {bestRoute && (
          <View style={styles.detailsCard}>
            <Text style={styles.detailsTitle}>Swap Details</Text>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Rate:</Text>
              <Text style={styles.detailValue}>
                1 {fromToken.symbol} = {bestRoute.rate.toFixed(6)} {toToken.symbol}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Price Impact:</Text>
              <Text
                style={[
                  styles.detailValue,
                  bestRoute.priceImpact > 5 ? styles.detailWarning : styles.detailSuccess,
                ]}
              >
                {bestRoute.priceImpact.toFixed(2)}%
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Network Fee:</Text>
              <Text style={styles.detailValue}>${bestRoute.fee}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Estimated Time:</Text>
              <Text style={styles.detailValue}>{bestRoute.estimatedTime}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Route:</Text>
              <Text style={styles.detailRoute}>{bestRoute.route.join(' → ')}</Text>
            </View>

            {isCrossChain && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Type:</Text>
                <Text style={styles.detailValue}>
                  {usePrivacyBridge ? '🔒 Private Cross-Chain' : 'Standard Cross-Chain'}
                </Text>
              </View>
            )}

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Min. Received:</Text>
              <Text style={styles.detailValue}>
                {(parseFloat(toAmount) * (1 - parseFloat(slippage) / 100)).toFixed(6)} {toToken.symbol}
              </Text>
            </View>
          </View>
        )}

        {/* Swap Button */}
        <TouchableOpacity
          style={[styles.executeButton, (!fromAmount || !toAmount || loading) && styles.executeButtonDisabled]}
          onPress={handleExecuteSwap}
          disabled={!fromAmount || !toAmount || loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.executeButtonText}>
              {isCrossChain ? 'Execute Cross-Chain Swap' : 'Execute Swap'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Info Note */}
        <View style={styles.infoNote}>
          <Text style={styles.infoIcon}>💡</Text>
          <Text style={styles.infoText}>
            {isCrossChain
              ? 'Cross-chain swaps take longer but enable seamless transfers between blockchains.'
              : 'Best price found across multiple DEXs. Prices update every 30 seconds.'}
          </Text>
        </View>
      </ScrollView>

      {/* Token Picker Modal (From) */}
      <Modal visible={showFromPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Token to Swap</Text>
              <TouchableOpacity onPress={() => setShowFromPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {tokens
              .filter((t) => t.symbol !== toToken.symbol)
              .map((token) => (
                <TouchableOpacity
                  key={token.symbol}
                  style={styles.tokenOption}
                  onPress={() => {
                    setFromToken(token);
                    setShowFromPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.tokenOptionInfo}>
                    <Text style={[styles.tokenIcon, { color: token.color }]}>{token.icon}</Text>
                    <View>
                      <Text style={styles.tokenOptionName}>{token.name}</Text>
                      <Text style={styles.tokenOptionBalance}>
                        {token.balance} {token.symbol}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.tokenPrice}>${token.price}</Text>
                </TouchableOpacity>
              ))}
          </View>
        </View>
      </Modal>

      {/* Token Picker Modal (To) */}
      <Modal visible={showToPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Token to Receive</Text>
              <TouchableOpacity onPress={() => setShowToPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {tokens
              .filter((t) => t.symbol !== fromToken.symbol)
              .map((token) => (
                <TouchableOpacity
                  key={token.symbol}
                  style={styles.tokenOption}
                  onPress={() => {
                    setToToken(token);
                    setShowToPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.tokenOptionInfo}>
                    <Text style={[styles.tokenIcon, { color: token.color }]}>{token.icon}</Text>
                    <View>
                      <Text style={styles.tokenOptionName}>{token.name}</Text>
                      <Text style={styles.tokenOptionBalance}>
                        {token.balance} {token.symbol}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.tokenPrice}>${token.price}</Text>
                </TouchableOpacity>
              ))}
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
  refreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#111111',
    borderRadius: 8,
  },
  refreshText: {
    fontSize: 12,
    color: '#A855F7',
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 8,
  },
  tokenCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f1f1f',
    marginBottom: 12,
  },
  tokenInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tokenIcon: {
    fontSize: 32,
  },
  tokenSymbol: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  tokenChain: {
    fontSize: 12,
    color: '#6b7280',
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#6b7280',
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
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    paddingVertical: 16,
  },
  amountInputDisabled: {
    color: '#6b7280',
  },
  maxButton: {
    fontSize: 14,
    fontWeight: '700',
    color: '#A855F7',
    paddingHorizontal: 12,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  balanceLabel: {
    fontSize: 13,
    color: '#9ca3af',
  },
  usdValue: {
    fontSize: 13,
    color: '#6b7280',
  },
  swapButtonContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  swapButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#A855F7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  swapIcon: {
    fontSize: 24,
    color: '#ffffff',
  },
  privacyOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f1f1f',
    marginBottom: 16,
  },
  privacyInfo: {
    flex: 1,
  },
  privacyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  privacyDesc: {
    fontSize: 12,
    color: '#9ca3af',
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#374151',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#A855F7',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  toggleKnobActive: {
    alignSelf: 'flex-end',
  },
  slippageOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  slippageButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    alignItems: 'center',
  },
  slippageButtonActive: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    borderColor: '#A855F7',
  },
  slippageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  slippageButtonTextActive: {
    color: '#A855F7',
  },
  detailsCard: {
    marginHorizontal: 16,
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f1f1f',
    marginBottom: 16,
    marginTop: 8,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  detailWarning: {
    color: '#ef4444',
  },
  detailSuccess: {
    color: '#10B981',
  },
  detailRoute: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A855F7',
    maxWidth: '60%',
    textAlign: 'right',
  },
  executeButton: {
    marginHorizontal: 16,
    backgroundColor: '#A855F7',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  executeButtonDisabled: {
    backgroundColor: '#374151',
  },
  executeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  infoNote: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f1f1f',
    marginBottom: 32,
    gap: 12,
  },
  infoIcon: {
    fontSize: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#9ca3af',
    lineHeight: 20,
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
    maxHeight: '70%',
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
  tokenOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },
  tokenOptionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tokenOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  tokenOptionBalance: {
    fontSize: 12,
    color: '#6b7280',
  },
  tokenPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#A855F7',
  },
});
