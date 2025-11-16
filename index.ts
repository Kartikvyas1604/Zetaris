import 'react-native-gesture-handler';
import 'react-native-get-random-values'; // MUST be imported before any crypto libraries
import { registerRootComponent } from 'expo';
import { Buffer } from 'buffer';

// Polyfill Buffer globally for crypto libraries
global.Buffer = Buffer;

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
