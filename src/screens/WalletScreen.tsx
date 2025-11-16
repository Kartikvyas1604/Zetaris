/**
 * Enhanced Wallet Screen
 * 
 * Integrates all Meshcrypt features:
 * - Multi-chain balances (Ethereum, Zcash, Polygon)
 * - Confidential transactions
 * - NFC tap-to-pay
 * - Mesh network status
 * - Privacy indicators
 * - Real-time updates
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import Header from '../components/Header';
import BalanceCard from '../components/BalanceCard';
import AssetCard from '../components/AssetCard';
import ActionButton from '../components/ActionButton';
import TransactionItem from '../components/TransactionItem';
import PrivacyStatus from '../components/PrivacyStatus';
import MeshNetwork from '../components/MeshNetwork';
import Statistics from '../components/Statistics';

type WalletScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Wallet'>;

// Wallet integration (would be passed via context/props in production)
// import { useWallet } from '../contexts/WalletContext';

interface Asset {
  name: string;
  symbol: string;
  amount: string;
  value: string;
  icon: string;
  color: string;
  chain: string;
  privacyEnabled: boolean;
}

interface Transaction {
  id: string;
  type: 'send' | 'receive' | 'swap' | 'nfc';
  token: string;
  amount: string;
  address?: string;
  description?: string;
  time: string;
  color: string;
  isPrivate: boolean;
  confirmations?: number;
}

export default function WalletScreen() {
  const navigation = useNavigation<WalletScreenNavigationProp>();
  
  // State
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalBalance, setTotalBalance] = useState('$0.00');
  const [balanceChange, setBalanceChange] = useState('+$0.00 (0%)');
  const [privacyScore, setPrivacyScore] = useState('0%');
  
  // Animations
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];

  // Initialize wallet data
  useEffect(() => {
    loadWalletData();
    animateIn();
  }, []);

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const loadWalletData = async () => {
    try {
      setLoading(true);

      // In production: fetch from wallet instance
      // const wallet = useWallet();
      // const balances = await wallet.getAllBalances();
      
      // Mock data with privacy features
      const mockAssets: Asset[] = [
        {
          name: 'Zcash',
          symbol: 'ZEC',
          amount: '12.5',
          value: '$3,750.00',
          icon: '⚡',
          color: '#F4B024',
          chain: 'zcash',
          privacyEnabled: true, // Shielded transactions
        },
        {
          name: 'Ethereum',
          symbol: 'ETH',
          amount: '8.3',
          value: '$16,600.00',
          icon: '◆',
          color: '#627EEA',
          chain: 'ethereum',
          privacyEnabled: false, // Public by default
        },
        {
          name: 'Polygon',
          symbol: 'MATIC',
          amount: '5,420',
          value: '$4,232.50',
          icon: '⬡',
          color: '#8247E5',
          chain: 'polygon',
          privacyEnabled: false,
        },
      ];

      const mockTransactions: Transaction[] = [
        {
          id: '1',
          type: 'send',
          token: 'ZEC',
          amount: '-2.5',
          address: 'zs1abc...def789',
          time: '2 min ago',
          color: '#A855F7',
          isPrivate: true, // Shielded transaction
          confirmations: 6,
        },
        {
          id: '2',
          type: 'receive',
          token: 'ETH',
          amount: '+1.2',
          address: '0x742d...0bEb',
          time: '1 hour ago',
          color: '#10B981',
          isPrivate: false,
          confirmations: 12,
        },
        {
          id: '3',
          type: 'swap',
          token: 'ETH',
          amount: '+0.8',
          description: '500 MATIC → 0.8 ETH',
          time: '3 hours ago',
          color: '#3B82F6',
          isPrivate: false,
          confirmations: 24,
        },
        {
          id: '4',
          type: 'nfc',
          token: 'ETH',
          amount: '-0.01',
          description: 'Coffee Shop (NFC)',
          time: 'Yesterday',
          color: '#F59E0B',
          isPrivate: false,
          confirmations: 100,
        },
      ];

      setAssets(mockAssets);
      setTransactions(mockTransactions);
      setTotalBalance('$24,582.50');
      setBalanceChange('+$2,741.23 (12.4%)');
      
      // Calculate privacy score
      const privateAssetValue = mockAssets
        .filter(a => a.privacyEnabled)
        .reduce((sum, a) => sum + parseFloat(a.value.replace(/[$,]/g, '')), 0);
      const totalValue = mockAssets
        .reduce((sum, a) => sum + parseFloat(a.value.replace(/[$,]/g, '')), 0);
      const score = Math.round((privateAssetValue / totalValue) * 100);
      setPrivacyScore(`${score}%`);

    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load wallet data:', error);
      Alert.alert('Error', 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWalletData();
    setRefreshing(false);
  };

  const handleSend = () => {
    navigation.navigate('Send');
  };

  const handleReceive = () => {
    navigation.navigate('Receive');
  };

  const handleSwap = () => {
    navigation.navigate('Swap');
  };

  const handleNFCPay = () => {
    Alert.alert(
      'NFC Payment',
      'Tap your device to another phone to send crypto',
      [
        {
          text: 'Start NFC Session',
          onPress: () => Alert.alert('NFC', 'Waiting for tap... (Requires react-native-nfc-manager)'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleAssetPress = (asset: Asset) => {
    Alert.alert(
      asset.name,
      `${asset.amount} ${asset.symbol}\n` +
      `Value: ${asset.value}\n` +
      `Chain: ${asset.chain}\n` +
      `Privacy: ${asset.privacyEnabled ? 'Enabled ✓' : 'Disabled'}`,
      [
        {
          text: asset.privacyEnabled ? 'Disable Privacy' : 'Enable Privacy',
          onPress: () => {
            // Toggle privacy for this asset
            setAssets(prev => prev.map(a =>
              a.symbol === asset.symbol
                ? { ...a, privacyEnabled: !a.privacyEnabled }
                : a
            ));
          },
        },
        { text: 'View Details', onPress: () => {} },
        { text: 'Close', style: 'cancel' },
      ]
    );
  };

  const handleTransactionPress = (tx: Transaction) => {
    Alert.alert(
      `Transaction ${tx.type.toUpperCase()}`,
      `Amount: ${tx.amount} ${tx.token}\n` +
      `${tx.address ? `Address: ${tx.address}\n` : ''}` +
      `${tx.description ? `Description: ${tx.description}\n` : ''}` +
      `Time: ${tx.time}\n` +
      `Privacy: ${tx.isPrivate ? 'Private (Shielded)' : 'Public'}\n` +
      `Confirmations: ${tx.confirmations || 0}`,
      [
        { text: 'View on Explorer', onPress: () => {} },
        { text: 'Close', style: 'cancel' },
      ]
    );
  };

  // Filter transactions
  const filteredTransactions = transactions.filter(tx => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Sent') return tx.type === 'send';
    if (activeFilter === 'Received') return tx.type === 'receive';
    return true;
  });

  if (loading && assets.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A855F7" />
          <Text style={styles.loadingText}>Loading wallet...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#A855F7"
          />
        }
      >
        <Header />

        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* Balance Section */}
          <View style={styles.section}>
            <BalanceCard
              totalBalance={totalBalance}
              change={balanceChange}
              privacyScore={privacyScore}
              balanceHidden={balanceHidden}
              onToggleBalance={() => setBalanceHidden(!balanceHidden)}
            />

            {/* Assets Grid */}
            <View style={styles.assetsGrid}>
              {assets.map((asset, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleAssetPress(asset)}
                  activeOpacity={0.8}
                >
                  <AssetCard {...asset} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.section}>
            <View style={styles.actionsGrid}>
              <ActionButton
                icon="send"
                label="Send"
                color="#A855F7"
                onPress={handleSend}
              />
              <ActionButton
                icon="receive"
                label="Receive"
                color="#10B981"
                onPress={handleReceive}
              />
              <ActionButton
                icon="swap"
                label="Swap"
                color="#3B82F6"
                onPress={handleSwap}
              />
              <ActionButton
                icon="nfc"
                label="NFC Pay"
                color="#F59E0B"
                onPress={handleNFCPay}
              />
            </View>
          </View>

          {/* Bottom Content */}
          <View style={styles.bottomContent}>
            {/* Transactions */}
            <View style={styles.transactionsCard}>
              <View style={styles.transactionsHeader}>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                <View style={styles.filterButtons}>
                  {['All', 'Sent', 'Received'].map((filter) => (
                    <TouchableOpacity
                      key={filter}
                      style={[
                        styles.filterButton,
                        activeFilter === filter && styles.filterButtonActive,
                      ]}
                      onPress={() => setActiveFilter(filter)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.filterButtonText,
                          activeFilter === filter && styles.filterButtonTextActive,
                        ]}
                      >
                        {filter}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.transactionsList}>
                {filteredTransactions.length > 0 ? (
                  filteredTransactions.map((tx) => (
                    <TouchableOpacity
                      key={tx.id}
                      onPress={() => handleTransactionPress(tx)}
                      activeOpacity={0.7}
                    >
                      <TransactionItem {...tx} />
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>
                      No {activeFilter.toLowerCase()} transactions
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Sidebar Cards */}
            <View style={styles.sidebar}>
              <PrivacyStatus />
              <MeshNetwork />
              <Statistics />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#9ca3af',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  assetsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  bottomContent: {
    paddingHorizontal: 16,
    gap: 16,
    marginBottom: 32,
  },
  transactionsCard: {
    backgroundColor: '#111111',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f1f1f',
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  filterButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterButtonText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },
  transactionsList: {
    gap: 12,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
  },
  sidebar: {
    gap: 16,
  },
});

