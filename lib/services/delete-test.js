// delete-test.js (روی سرور ویندوز اجرا کنید)
const fetch = require('node-fetch'); // اگر نصب نیست: npm install node-fetch

async function deleteLastTestVoucher() {
  const url = 'http://localhost:3000/run-query';
  const apiKey = 'soheil1371';

  // این کوئری آخرین سندی که در شرح آن "هوش مصنوعی" دارد را پیدا و حذف می‌کند
  const deleteQuery = `
    DECLARE @VoucherID bigint;

    -- 1. پیدا کردن آخرین سند تستی
    SELECT TOP 1 @VoucherID = VoucherID 
    FROM [FIN3].[Voucher] 
    WHERE Description LIKE N'%هوش مصنوعی%' 
    ORDER BY VoucherID DESC;

    IF @VoucherID IS NOT NULL
    BEGIN
        -- 2. حذف ردیف‌های سند (اول باید این‌ها پاک شوند)
        DELETE FROM [FIN3].[VoucherItem] WHERE VoucherRef = @VoucherID;

        -- 3. حذف خود سند
        DELETE FROM [FIN3].[Voucher] WHERE VoucherID = @VoucherID;

        SELECT 'Deleted Voucher ID: ' + CAST(@VoucherID AS nvarchar(50)) AS Message;
    END
    ELSE
    BEGIN
        SELECT 'No test voucher found to delete.' AS Message;
    END
  `;

  console.log("🗑️ Deleting last test voucher...");

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-proxy-key': apiKey
      },
      body: JSON.stringify({ query: deleteQuery })
    });

    const result = await response.json();
    
    if (result.success && result.recordset) {
        console.log("✅ نتیجه:", result.recordset[0].Message);
    } else {
        console.log("⚠️ چیزی برای پاک کردن پیدا نشد یا خطا رخ داد.");
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

deleteLastTestVoucher();