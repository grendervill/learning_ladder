import React from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter } from "react-router-dom"
import "@fontsource-variable/literata"
import "@fontsource-variable/literata/wght-italic.css"
import "@fontsource-variable/golos-text"
import "@fontsource-variable/jetbrains-mono"
import "./styles/tokens.css"
import "./styles/base.css"
import { App } from "./App"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
