// FILE: components/utility/client-toaster.tsx

"use client"

// We import the Toaster from the library with an alias
import { Toaster as SonnerToaster } from "sonner"

// We create our own simple client component
export default function ClientToaster() {
  return <SonnerToaster richColors position="top-center" duration={3000} />
}
