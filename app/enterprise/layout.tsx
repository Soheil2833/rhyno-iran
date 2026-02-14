// app/enterprise/layout.tsx

// نیازی به ایمپورت ThemeProvider یا Toaster نیست چون در RootLayout وجود دارند
import "@/app/globals.css"

export default function EnterpriseLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    // فقط استایل‌های کلی مربوط به بخش سازمانی را اینجا می‌دهیم
    <div className="min-h-screen w-full bg-gray-50 font-sans text-gray-900 dark:bg-[#0f1018] dark:text-gray-100">
      {children}
    </div>
  )
}
