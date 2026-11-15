import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { wagmiConfig } from './lib/wagmi'
import { Layout } from './components/Layout'
import { Landing } from './pages/Landing'
import { Overview } from './pages/Overview'
import { Guards } from './pages/Guards'
import { Activity } from './pages/Activity'
import { HowItWorks } from './pages/HowItWorks'
import { NotFound } from './pages/NotFound'
import './styles.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Landing />} />
              <Route path="/app" element={<Overview />} />
              <Route path="/app/guards" element={<Guards />} />
              <Route path="/app/activity" element={<Activity />} />
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
