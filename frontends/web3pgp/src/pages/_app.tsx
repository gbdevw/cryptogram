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
import { Layout } from '../components/Layout';
import FindPage from './find';
import RegisterPage from './register';
import RevokePage from './revoke';

const client = new QueryClient();

function AppContent() {
  return (
    <Layout>
      <Routes>
        <Route path="/find" element={<FindPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/revoke" element={<RevokePage />} />
        <Route path="/" element={<Navigate to="/find" replace />} />
      </Routes>
    </Layout>
  );
}

function MyApp({ Component, pageProps }: AppProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
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
