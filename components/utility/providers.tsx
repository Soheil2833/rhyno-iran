// components/utility/providers.tsx
"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import { ThemeProviderProps } from "next-themes" // این را اضافه کنید
import { ReactNode } from "react"

// تایپ پروپز را اصلاح کنید تا ویژگی‌های Theme را هم بپذیرد
export function Providers({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      {children}
    </NextThemesProvider>
  )
}