import "./globals.css"
import { Providers } from "@/components/utility/providers"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body>
        {/* حالا دیگر خطایی نخواهید داشت */}
        <Providers attribute="class" defaultTheme="dark" enableSystem>
          {children}
        </Providers>
      </body>
    </html>
  )
}