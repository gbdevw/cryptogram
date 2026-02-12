import '../styles/globals.css';
import '@rainbow-me/rainbowkit/styles.css';
import type { AppProps } from 'next/app';
import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';

import { config } from '../wagmi';
import { Web3PGPProvider } from '../contexts/Web3PGPContext';
import { initializeProductionMode } from '../utils/productionMode';

import { Layout } from '../components/Layout';
import FindPage from './find';
import RegisterPage from './register';
import UpdatePage from './update';
import RevokePage from './revoke';
import TermsPage from './terms';
import NetworkInfoPage from './network-info';
import PrivacyPage from './privacy';
import AboutPage from './about';

const client = new QueryClient();

function AppContent() {
  return (
    <Layout>
      <Routes>
        <Route path="/find" element={<FindPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/update" element={<UpdatePage />} />
        <Route path="/revoke" element={<RevokePage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/network-info" element={<NetworkInfoPage />} />
        <Route path="/network" element={<NetworkInfoPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/" element={<Navigate to="/find" replace />} />
      </Routes>
    </Layout>
  );
}

function MyApp({ Component, pageProps }: AppProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Initialize production mode settings (disables dev tools, console logging)
    initializeProductionMode();
  }, []);

  if (!isClient) {
    return null; // or a loading spinner
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={client}>
        <RainbowKitProvider>
          <Web3PGPProvider>
            <HashRouter>
              <AppContent />
            </HashRouter>
          </Web3PGPProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default MyApp;
