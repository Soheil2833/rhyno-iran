import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// خواندن اطلاعات از env
const ARVAN_ACCESS_KEY = process.env.ARVAN_ACCESS_KEY;
const ARVAN_SECRET_KEY = process.env.ARVAN_SECRET_KEY;

const endpoints = [
  process.env.ARVAN_ENDPOINT_THR || "https://s3.ir-thr-at1.arvanstorage.ir",
  process.env.ARVAN_ENDPOINT_TBZ || "https://s3.ir-tbz-sh1.arvanstorage.ir"
];

// چک کردن وجود کلیدها برای جلوگیری از خطای زمان اجرا
if (!ARVAN_ACCESS_KEY || !ARVAN_SECRET_KEY) {
  console.warn("⚠️ هشدار: کلیدهای Arvan S3 در فایل .env.local تنظیم نشده‌اند.");
}

function createS3Client(endpoint: string) {
  return new S3Client({
    region: "ir-thr-at1",
    endpoint: endpoint,
    credentials: {
      accessKeyId: ARVAN_ACCESS_KEY!,
      secretAccessKey: ARVAN_SECRET_KEY!,
    },
    forcePathStyle: true,
  });
}

export async function uploadToArvanS3(
  file: File,
  bucket: string = "finance-docs"
) {
  // ... باقی کد مشابه قبل
  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "")}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  for (const endpoint of endpoints) {
    try {
      const client = createS3Client(endpoint);
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: fileName,
        Body: buffer,
        ContentType: file.type,
      });

      await client.send(command);
      return `${endpoint}/${bucket}/${fileName}`;
    } catch (error) {
      console.error(`❌ Failed to upload to ${endpoint}:`, error);
      continue;
    }
  }
  throw new Error("آپلود ناموفق بود.");
}