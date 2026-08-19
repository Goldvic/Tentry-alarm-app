import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

// Catches render-time crashes anywhere below it in the tree and shows a
// visible, dark-themed error screen instead of a blank white one — so if
// something still breaks, you'll see what and can tap Try Again, instead
// of just staring at an empty screen with no idea what happened.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: '#05070d' }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Text style={{ color: '#f5f6fb', fontSize: 18, fontWeight: '700', marginBottom: 12, textAlign: 'center' }}>
              Something went wrong
            </Text>
            <Text style={{ color: '#9ba3c4', fontSize: 13, marginBottom: 20, textAlign: 'center', lineHeight: 18 }}>
              {String(this.state.error?.message || this.state.error || 'Unknown error')}
            </Text>
            <TouchableOpacity
              onPress={this.handleRetry}
              style={{ backgroundColor: '#ff3b5c', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Try Again</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}
