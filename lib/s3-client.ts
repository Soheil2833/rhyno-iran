import { S3Client } from "@aws-sdk/client-s3";

export const s3Client = new S3Client({
  region: "default",
  endpoint: "https://s3.ir-thr-at1.arvanstorage.ir", // آدرس دیتاسنتر تهران طبق env شما
  credentials: {
    accessKeyId: process.env.ARVAN_ACCESS_KEY || "d046d1fc-70d9-4793-a40c-eca0e0f7f6e6",
    secretAccessKey: process.env.ARVAN_SECRET_KEY || "ac20aa10bbcf010d5d29d7c268d6be480283979b95b10b2cc99dc4a25145fc44",
  },
});