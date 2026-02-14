import OpenAI from 'openai';


// کلاینت مربوط به مدل GPT-5 Mini
export const gpt5Client = new OpenAI({
  apiKey: process.env.ARVAN_API_KEY,
  baseURL: "https://arvancloudai.ir/gateway/models/GPT-5-Mini/00CY8lXKXPAsfYWSXH3FELsumI_9aePBgcOxxQ6rsDS1hlhp_8BjWAGz2vsKEfzpiPXdWvQ9HqXj7hsuur36Wto8tV6WSvSASE__KEAm-O1C90o5GYddPRjvKRHEadEzvymkVTQRf2wltLCpt4uD_RvN3uGc05Ma0FmhnnUY7Kri18vgC5UE-KEFhfWjWp6iWOUqQt2k23hfGpJYgKOZoBFfW9dDAYuzyosT6sOIORC6xCbagPzWoQHo/v1"
});

// کلاینت مربوط به مدل Gemini 2.5 Pro
export const geminiClient = new OpenAI({
  apiKey: process.env.ARVAN_API_KEY,
  baseURL: "https://arvancloudai.ir/gateway/models/Gemini-2.5-Pro/1_JS1NTxmEW4GkOR_6rOkB4LeL4VYdgfmDe6IvW1B6aH8m-6On7cHNaT7Vk5jb42YAeFbZPMr0ZglWI8Dhf9JqC9eHZrOpBSlvvIWfvYtDFagF4I2rnhgutxiiFJlLOz8KLOpt5TqmoXnDoKQ0_TF25Qi74gmoOOV3HgCZG8HCZNEX_fXsOAPMUoWra9sRCdL0fkmpi8QPp-xvW5rxCTZeL2qnc9HVNOH640aRTvQHYXEXBXKiSYNeDZpqR-UmPoKCM/v1"
});


export const embeddingClient = new OpenAI({
  apiKey: process.env.ARVAN_API_KEY, // کلید خود را در .env قرار دهید
  baseURL:"https://arvancloudai.ir/gateway/models/Embedding-3-Large/MAgwqIh8Mq5Wr6rRyslDSVzfV1QQWfTIT492MaiZOqQ7mVSBclPqTeoayoMgjuLL4JNfUb53cn5GYCtIhufoiFHg5636fkx_BfBNwa_L2et7kvdwyoymBe7sNJdFJphqFp1cnRPLJiG2G9ULW7RdVs2KDnhq6KjqaB2iovAmDeIl2StqmhSH81CHcPz2wK1wlNRwRLTLLFGteuwLh2-xdtV4__na-6ehivqoMUmrB27asgoTE2dXg5RuQnrMMi_1m3BP66kXOQY/v1"
});



// تعریف ثابت نام مدل‌ها برای جلوگیری از غلط املایی در فایل‌های دیگر
export const AI_MODELS = {
  GPT5_MINI: "GPT-5-Mini-w92wh",
  GEMINI_PRO: "Gemini-2-5-Pro-toh3v",
  Embeddings:"Embedding-3-Large-c12yn"
} as const;