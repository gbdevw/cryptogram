import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'

import App from './App.tsx'
import { config } from './wagmi.ts'
import { BlockchainServiceProvider } from './contexts/BlockchainServiceContext'
import { WellKnownKeysProvider } from './contexts/WellKnownKeysContext'

import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Disable automatic refetching on window focus/reconnect
      // This prevents unnecessary RPC calls after successful verification
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      // Keep data fresh for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Keep unused data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <WellKnownKeysProvider>
          <BlockchainServiceProvider>
            <App />
          </BlockchainServiceProvider>
        </WellKnownKeysProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
)
