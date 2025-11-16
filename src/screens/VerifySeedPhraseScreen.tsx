/**
 * Verify Seed Phrase Screen
 * User confirms they saved the phrase by entering 3 random words
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MeshcryptWalletCore } from '../core/meshcryptWalletCore';

interface VerifySeedPhraseScreenProps {
  route: {
    params: {
      seedPhrase: string;
    };
  };
  navigation: {
    navigate: (screen: string) => void;
    goBack: () => void;
    reset: (config: { index: number; routes: Array<{ name: string }> }) => void;
  };
}

export default function VerifySeedPhraseScreen({ route, navigation }: VerifySeedPhraseScreenProps) {
  const { seedPhrase } = route.params;
  const words = seedPhrase.split(' ');
  
  // Select 3 random indices
  const [indices] = useState(() => {
    const selected: number[] = [];
    while (selected.length < 3) {
      const rand = Math.floor(Math.random() * 24);
      if (!selected.includes(rand)) {
        selected.push(rand);
      }
    }
    return selected.sort((a, b) => a - b);
  });

  const [inputs, setInputs] = useState<string[]>(['', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInputChange = (text: string, index: number) => {
    const newInputs = [...inputs];
    newInputs[index] = text;
    setInputs(newInputs);
    setError('');
  };

  const handleVerify = async () => {
    // Check if all words match
    const correct = indices.every((wordIndex, i) => 
      inputs[i].toLowerCase().trim() === words[wordIndex]
    );

    if (!correct) {
      setError('Incorrect words. Please try again.');
      setInputs(['', '', '']);
      return;
    }

    // Save wallet
    setLoading(true);
    try {
      const walletCore = new MeshcryptWalletCore();
      const wallet = await walletCore.importWallet(seedPhrase);
      
      // Save to AsyncStorage
      await AsyncStorage.setItem('meshcrypt_wallet', JSON.stringify(wallet));
      await AsyncStorage.setItem('meshcrypt_has_wallet', 'true');
      
      // Navigate to main wallet
      navigation.reset({
        index: 0,
        routes: [{ name: 'Wallet' }],
      });
      
      Alert.alert('Success', 'Your wallet has been created!');
    } catch (err) {
      Alert.alert('Error', 'Failed to save wallet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Verify Recovery Phrase</Text>
            <Text style={styles.subtitle}>
              Enter the following words to confirm you've saved them
            </Text>
          </View>

          {/* Input Fields */}
          <View style={styles.inputContainer}>
            {indices.map((wordIndex, i) => (
              <View key={i} style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Word #{wordIndex + 1}</Text>
                <TextInput
                  style={styles.input}
                  value={inputs[i]}
                  onChangeText={(text) => handleInputChange(text, i)}
                  placeholder="Enter word"
                  placeholderTextColor="#6B7280"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            ))}
          </View>

          {/* Error Message */}
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Verify Button */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Creating Wallet...' : 'Verify & Continue'}
            </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }const styles = StyleSheet.create({
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
  inputContainer: {
    marginBottom: 24,
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    color: '#9CA3AF',
    fontSize: 14,
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
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
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
