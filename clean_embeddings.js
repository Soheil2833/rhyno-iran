import fs from "fs";
import readline from "readline";

const input = "./rahkaran_entities.csv";
const output = "clean.csv";

const rl = readline.createInterface({
  input: fs.createReadStream(input),
  crlfDelay: Infinity
});

const out = fs.createWriteStream(output);

let buffer = "";
let insideEmbedding = false;

for await (const line of rl) {
  if (line.includes(',"[')) {
    insideEmbedding = true;
    buffer = line;
    continue;
  }

  if (insideEmbedding) {
    buffer += line.trim();
    if (line.includes(']"')) {
      out.write(buffer + "\n");
      buffer = "";
      insideEmbedding = false;
    }
  } else {
    out.write(line + "\n");
  }
}

console.log("✅ clean.csv generated");
