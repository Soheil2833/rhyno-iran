import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: "ir-thr-at1", // ریجن دقیق شما طبق لینک
  endpoint: "https://s3.ir-thr-at1.arvanstorage.ir", // اندپوینت صحیح برای API آروان
  credentials: {
    accessKeyId: process.env.ARVAN_ACCESS_KEY!,
    secretAccessKey: process.env.ARVAN_SECRET_KEY!,
  },
  forcePathStyle: true, // برای سازگاری کامل با آروان
});

export async function POST(req: Request) {
  const requestId = Math.random().toString(36).substring(7);

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: "فایلی دریافت نشد" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // پاک‌سازی نام فایل برای جلوگیری از ارورهای S3
    const extension = file.name.split('.').pop();
    const sanitizedName = file.name.split('.')[0]
      .replace(/[^\x00-\x7F]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9]/g, "_");

    const fileName = `${Date.now()}_${sanitizedName}.${extension}`;

    const params = {
      Bucket: "rhyno", // نام باکت شما طبق لینک
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
      ACL: "public-read" as const, // بسیار مهم برای دسترسی عمومی به لینک
    };

    await s3Client.send(new PutObjectCommand(params));
    
    // لینک مستقیم برای نمایش فایل
    const publicUrl = `https://rhyno.s3.ir-thr-at1.arvanstorage.ir/${fileName}`;
    
    console.log(`[${requestId}] ✅ فایل در استوریج rhyno ذخیره شد`);
    return NextResponse.json({ url: publicUrl });

  } catch (error: any) {
    console.error(`[${requestId}] ❌ خطا:`, error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}