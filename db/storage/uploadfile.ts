import { s3Client } from "@/lib/s3-client";
import { PutObjectCommand } from "@aws-sdk/client-s3";

export const uploadFileToArvan = async (
  file: File,
  metadata: {
    user_id: string;
    workspace_id: string;
  }
) => {
  const bucketName = "rhyno"; // نام باکت شما در آروان

  // ایجاد مسیر فایل
  const fileExtension = file.name.split(".").pop();
  const filePath = `${metadata.user_id}/${metadata.workspace_id}/${crypto.randomUUID()}.${fileExtension}`;

  try {
    // تبدیل فایل به ArrayBuffer برای ارسال به S3
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: filePath,
      Body: buffer,
      ContentType: file.type, // مهم برای نمایش درست فایل در مرورگر
    });

    await s3Client.send(command);

    // برگرداندن مسیر یا لینک فایل
    return filePath; 
  } catch (error: any) {
    throw new Error(`خطا در آپلود به آروان: ${error.message}`);
  }
};