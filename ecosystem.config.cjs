module.exports = {
  apps: [
    {
      name: 'rhynoai',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 2, 
      exec_mode: 'cluster',
      
      // اختصاص رم بیشتر (۶ گیگابایت از ۸ گیگابایت سرور)
      node_args: '--max-old-space-size=6144', 
      
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      
      // تنظیمات پایداری برای جلوگیری از ۵۰۴ و هنگ کردن
      exp_backoff_restart_delay: 100, // فاصله بین ریستارت‌ها در صورت کرش
      max_memory_restart: '7G',       // اگر به هر دلیلی رم پر شد، خودکار ریستارت کن
      kill_timeout: 4000,             // زمان دادن به پروسه برای بستن کانکشن‌ها
      listen_timeout: 10000           // زمان انتظار برای بالا آمدن
    },
  ],
};