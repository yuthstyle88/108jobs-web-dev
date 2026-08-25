/**
 * สคริปต์แปลง snake_case → camelCase
 *
 * วิธีรัน
 *   pnpm ts-node scripts/convert-to-camel.ts
 *
 * หมายเหตุ
 * - แก้เฉพาะชื่อพร็อปเพอร์ตีใน type/interface เท่านั้น
 * - เขียนไฟล์คืนเฉพาะกรณีที่มีการเปลี่ยนแปลง
 */

import fs from 'node:fs';
import path from 'node:path';

// ---------- helper ----------
const TS_GLOB = /\.ts$/;

/** แปลง snake_case → camelCase  */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g,
    (_match, char: string) => char.toUpperCase());
}

/**
 * แก้ชื่อพร็อปเพอร์ตีที่เป็น snake_case ข้างหน้า `?:` หรือ `:` ภายในไฟล์
 *  ตัวอย่าง: `updated_at?: string;` → `updatedAt?: string;`
 */
function transformContent(src: string): string {
  const propNameRegex = /\b([a-zA-Z]\w*)(?=\s*[?:])/g;

  return src.replace(propNameRegex,
    (match) => {
      // ข้ามถ้าไม่มี underscore
      return match.includes('_') ? snakeToCamel(match) : match;
    });
}

/** ประมวลผลไฟล์เดียว */
function processFile(filePath: string) {
  const original = fs.readFileSync(filePath,
    'utf8');
  const transformed = transformContent(original);

  if (original !== transformed) {
    fs.writeFileSync(filePath,
      transformed,
      'utf8');
    console.log(`✔ แปลงแล้ว: ${path.relative(process.cwd(),
      filePath)}`);
  }
}

/** เดินทุกแฟ้มในไดเรกทอรี (recursive) */
function walkDir(dir: string) {
  for (const entry of fs.readdirSync(dir,
    {withFileTypes: true})) {
    const full = path.join(dir,
      entry.name);
    if (entry.isDirectory()) {
      walkDir(full);
    } else if (entry.isFile() && TS_GLOB.test(entry.name)) {
      processFile(full);
    }
  }
}

// --------- main ---------
const TYPES_DIR = path.join(process.cwd(),
  './src/types'); // เปลี่ยนตามโครงสร้างโปรเจกต์
if (!fs.existsSync(TYPES_DIR)) {
  console.error('ไม่พบโฟลเดอร์ types/');
  process.exit(1);
}

walkDir(TYPES_DIR);
console.log('🎉 เสร็จสิ้นการแปลงชื่อพร็อปเพอร์ตีทั้งหมด');