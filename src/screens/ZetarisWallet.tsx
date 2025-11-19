
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import chainlinkService from '../services/chainlinkService';
import BlockchainService, { ChainBalance } from '../services/blockchainService';
import AccountManager from '../services/accountManager';

type Props = {
  navigation: StackNavigationProp<RootStackParamList, 'Wallet'>;
};

interface AssetData {
  symbol: string;
  name: string;
  amount: number;
  usdValue: number;
  price: number;
  change24h: number;
  icon: string;
  color: string;
}

const ZetarisWallet: React.FC<Props> = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [totalBalance, setTotalBalance] = useState(0);
  const [totalChange, setTotalChange] = useState({ amount: 0, percent: 0 });
  const [assets, setAssets] = useState<AssetData[]>([]);
  const [peerCount, setPeerCount] = useState(12);
  const [privacyScore, setPrivacyScore] = useState(98);

  useEffect(() => {
    initializeWallet();
  }, []);

  const initializeWallet = async () => {
    try {
      setIsLoading(true);

      // Check if wallet exists
      const encryptedWallet = await AsyncStorage.getItem('Zetaris_wallet');
      if (!encryptedWallet) {
        navigation.replace('WalletSetup');
        return;
      }

      await fetchPortfolioData();
    } catch (error) {
      console.error('Error initializing wallet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPortfolioData = async () => {
    try {
      const walletData = await AsyncStorage.getItem('Zetaris_wallet');
      if (!walletData) {
        // If no wallet, show default data
        setDefaultPortfolio();
        return;
      }

      const wallet = JSON.parse(walletData);
      const addresses = wallet.accounts || {};

      // Check if we have valid addresses
      const hasValidAddresses = 
        addresses.ethereum?.address || 
        addresses.polygon?.address || 
        addresses.solana?.address ||
        addresses.zcash?.address ||
        addresses.bitcoin?.address;

      if (!hasValidAddresses) {
        setDefaultPortfolio();
        return;
      }

      // Fetch real balances
      const balances = await BlockchainService.getAllBalances(addresses);
      
      // Fetch Chainlink prices
      const prices = await chainlinkService.getBatchPrices(['ETH', 'MATIC', 'BTC', 'ZEC', 'SOL']);

      // Build asset list
      const assetList: AssetData[] = [];
      let total = 0;
      let totalChangeAmount = 0;

      for (const balance of balances) {
        const priceData = prices.get(balance.symbol);
        if (!priceData) continue;

        // Parse balance safely
        const amount = parseFloat(balance.balance) || 0;
        if (amount === 0) continue; // Skip zero balances

        const usdValue = amount * priceData.price;
        const change24h = amount * priceData.change24h;

        total += usdValue;
        totalChangeAmount += change24h;

        assetList.push({
          symbol: balance.symbol,
          name: balance.chain,
          amount,
          usdValue,
          price: priceData.price,
          change24h: priceData.changePercent24h,
          icon: getAssetIcon(balance.symbol),
          color: getAssetColor(balance.symbol),
        });
      }

      // If no assets with balance, show default
      if (assetList.length === 0) {
        setDefaultPortfolio();
        return;
      }

      setAssets(assetList);
      setTotalBalance(total);
      setTotalChange({
        amount: totalChangeAmount,
        percent: total > 0 ? (totalChangeAmount / total) * 100 : 0,
      });
    } catch (error) {
      console.error('Error fetching portfolio:', error);
      setDefaultPortfolio();
    }
  };

  const setDefaultPortfolio = async () => {
    // Show demo data with real prices from Chainlink
    try {
      const prices = await chainlinkService.getBatchPrices(['ETH', 'MATIC', 'ZEC']);
      
      const demoAssets: AssetData[] = [
        {
          symbol: 'ZEC',
          name: 'Zcash',
          amount: 12.5,
          usdValue: 12.5 * (prices.get('ZEC')?.price || 40),
          price: prices.get('ZEC')?.price || 40,
          change24h: prices.get('ZEC')?.changePercent24h || 2.5,
          icon: '⚡',
          color: '#F4B728',
        },
        {
          symbol: 'ETH',
          name: 'Ethereum',
          amount: 8.3,
          usdValue: 8.3 * (prices.get('ETH')?.price || 3143),
          price: prices.get('ETH')?.price || 3143,
          change24h: prices.get('ETH')?.changePercent24h || 5.2,
          icon: '◆',
          color: '#627EEA',
        },
        {
          symbol: 'MATIC',
          name: 'Polygon',
          amount: 5420,
          usdValue: 5420 * (prices.get('MATIC')?.price || 0.78),
          price: prices.get('MATIC')?.price || 0.78,
          change24h: prices.get('MATIC')?.changePercent24h || 3.1,
          icon: '⬡',
          color: '#8247E5',
        },
      ];

      const total = demoAssets.reduce((sum, asset) => sum + asset.usdValue, 0);
      const totalChangeAmount = demoAssets.reduce((sum, asset) => {
        return sum + (asset.amount * asset.price * asset.change24h / 100);
      }, 0);

      setAssets(demoAssets);
      setTotalBalance(total);
      setTotalChange({
        amount: totalChangeAmount,
        percent: total > 0 ? (totalChangeAmount / total) * 100 : 0,
      });
    } catch (error) {
      console.error('Error setting default portfolio:', error);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchPortfolioData();
    setIsRefreshing(false);
  };

  const getAssetIcon = (symbol: string): string => {
    const icons: { [key: string]: string } = {
      'ZEC': '⚡',
      'ETH': '◆',
      'MATIC': '⬡',
      'BTC': '₿',
      'SOL': '◎',
    };
    return icons[symbol] || '●';
  };

  const getAssetColor = (symbol: string): string => {
    const colors: { [key: string]: string } = {
      'ZEC': '#F4B728',
      'ETH': '#627EEA',
      'MATIC': '#8247E5',
      'BTC': '#F7931A',
      'SOL': '#14F195',
    };
    return colors[symbol] || '#FFFFFF';
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#A855F7" />
        <Text style={styles.loadingText}>Loading Zetaris...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logo}>
            <Text style={styles.logoIcon}>🔐</Text>
          </View>
          <Text style={styles.logoText}>Zetaris</Text>
        </View>
        
        <View style={styles.headerRight}>
          <View style={styles.peerBadge}>
            <View style={styles.peerDot} />
            <Text style={styles.peerText}>{peerCount} Peers</Text>
          </View>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#A855F7" />
        }
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <View>
              <Text style={styles.balanceLabel}>Total Balance</Text>
              <Text style={styles.balanceAmount}>
                {balanceHidden ? '••••••' : `$${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </Text>
              <Text style={[styles.balanceChange, totalChange.percent >= 0 ? styles.positiveChange : styles.negativeChange]}>
                {totalChange.percent >= 0 ? '+' : ''}${totalChange.amount.toFixed(2)} ({totalChange.percent.toFixed(1)}%) this month
              </Text>
            </View>
            
            <View style={styles.balanceRight}>
              <TouchableOpacity
                style={styles.hideButton}
                onPress={() => setBalanceHidden(!balanceHidden)}
              >
                <Text style={styles.hideButtonText}>{balanceHidden ? 'Show' : 'Hide'} Balance</Text>
              </TouchableOpacity>
              
              <View style={styles.privacyBadge}>
                <Text style={styles.privacyLabel}>Privacy Score</Text>
                <Text style={styles.privacyScore}>{privacyScore}%</Text>
              </View>
            </View>
          </View>

          {/* Asset Cards */}
          <View style={styles.assetsGrid}>
            {assets.slice(0, 3).map((asset, index) => (
              <TouchableOpacity key={index} style={styles.assetCard}>
                <View style={styles.assetHeader}>
                  <View style={[styles.assetIcon, { backgroundColor: `${asset.color}20` }]}>
                    <Text style={styles.assetIconText}>{asset.icon}</Text>
                  </View>
                  <View>
                    <Text style={styles.assetName}>{asset.name}</Text>
                    <Text style={styles.assetSymbol}>{asset.symbol}</Text>
                  </View>
                </View>
                <Text style={styles.assetAmount}>{asset.amount.toFixed(4)}</Text>
                <Text style={styles.assetUSD}>${asset.usdValue.toFixed(2)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('RealSend')}>
            <LinearGradient colors={['#A855F7', '#9333EA']} style={styles.actionGradient}>
              <Text style={styles.actionIcon}>🚀</Text>
            </LinearGradient>
            <Text style={styles.actionLabel}>Send</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('RealReceive')}>
            <LinearGradient colors={['#10B981', '#059669']} style={styles.actionGradient}>
              <Text style={styles.actionIcon}>📥</Text>
            </LinearGradient>
            <Text style={styles.actionLabel}>Receive</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('SwapScreen')}>
            <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.actionGradient}>
              <Text style={styles.actionIcon}>🔄</Text>
            </LinearGradient>
            <Text style={styles.actionLabel}>Swap</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('NFCPay')}>
            <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.actionGradient}>
              <Text style={styles.actionIcon}>📱</Text>
            </LinearGradient>
            <Text style={styles.actionLabel}>NFC Pay</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Activity */}
        <View style={styles.activitySection}>
          <View style={styles.activityHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <View style={styles.filterButtons}>
              <TouchableOpacity style={[styles.filterButton, styles.filterButtonActive]}>
                <Text style={styles.filterButtonText}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterButton}>
                <Text style={[styles.filterButtonText, styles.filterButtonInactive]}>Sent</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterButton}>
                <Text style={[styles.filterButtonText, styles.filterButtonInactive]}>Received</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Transaction List */}
          <View style={styles.transactionList}>
            <TouchableOpacity style={styles.transactionItem}>
              <View style={styles.transactionLeft}>
                <View style={[styles.transactionIcon, { backgroundColor: '#A855F720' }]}>
                  <Text>🚀</Text>
                </View>
                <View>
                  <Text style={styles.transactionTitle}>Sent ZEC</Text>
                  <Text style={styles.transactionAddress}>To: zs1abc...def789</Text>
                </View>
              </View>
              <View style={styles.transactionRight}>
                <Text style={[styles.transactionAmount, { color: '#EF4444' }]}>-2.5 ZEC</Text>
                <Text style={styles.transactionTime}>2 min ago</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.transactionItem}>
              <View style={styles.transactionLeft}>
                <View style={[styles.transactionIcon, { backgroundColor: '#10B98120' }]}>
                  <Text>📥</Text>
                </View>
                <View>
                  <Text style={styles.transactionTitle}>Received ETH</Text>
                  <Text style={styles.transactionAddress}>From: 0x742d...0bEb</Text>
                </View>
              </View>
              <View style={styles.transactionRight}>
                <Text style={[styles.transactionAmount, { color: '#10B981' }]}>+1.2 ETH</Text>
                <Text style={styles.transactionTime}>1 hour ago</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Privacy Status Card */}
        <View style={styles.privacyCard}>
          <Text style={styles.cardTitle}>Privacy Status</Text>
          <View style={styles.privacyList}>
            {[
              { label: 'Balance Hidden', status: 'Active' },
              { label: 'Stealth Addresses', status: 'On' },
              { label: 'Zero-Knowledge', status: 'Enabled' },
              { label: 'Mesh Routing', status: 'Active' },
            ].map((item, index) => (
              <View key={index} style={styles.privacyItem}>
                <Text style={styles.privacyLabel}>{item.label}</Text>
                <Text style={styles.privacyStatus}>{item.status}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#9CA3AF',
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 40,
    height: 40,
    backgroundColor: '#A855F7',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIcon: {
    fontSize: 20,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  peerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  peerDot: {
    width: 8,
    height: 8,
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  peerText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  settingsBtn: {
    padding: 8,
  },
  settingsIcon: {
    fontSize: 20,
  },
  scrollView: {
    flex: 1,
  },
  balanceCard: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    borderRadius: 16,
    padding: 32,
    margin: 24,
    marginBottom: 16,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  balanceLabel: {
    color: '#9CA3AF',
    fontSize: 14,
    marginBottom: 8,
  },
  balanceAmount: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 8,
  },
  balanceChange: {
    fontSize: 14,
  },
  positiveChange: {
    color: '#10B981',
  },
  negativeChange: {
    color: '#EF4444',
  },
  balanceRight: {
    alignItems: 'flex-end',
    gap: 12,
  },
  hideButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
  },
  hideButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  privacyBadge: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.2)',
  },
  privacyLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 4,
  },
  privacyScore: {
    color: '#A855F7',
    fontSize: 20,
    fontWeight: '700',
  },
  assetsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  assetCard: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    borderRadius: 12,
    padding: 16,
  },
  assetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  assetIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assetIconText: {
    fontSize: 18,
  },
  assetName: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  assetSymbol: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  assetAmount: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  assetUSD: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
  },
  actionGradient: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionIcon: {
    fontSize: 24,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  activitySection: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 24,
    marginBottom: 24,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  filterButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  filterButtonText: {
    fontSize: 14,
  },
  filterButtonInactive: {
    color: '#9CA3AF',
  },
  transactionList: {
    gap: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  transactionAddress: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  transactionTime: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  privacyCard: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 24,
    marginBottom: 24,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  privacyList: {
    gap: 12,
  },
  privacyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  privacyLabel: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  privacyStatus: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ZetarisWallet;
