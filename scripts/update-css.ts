#!/usr/bin/env bun
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { readFileSync } from 'fs';
import { eq } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL!;
const sql = postgres(DATABASE_URL);
const db = drizzle(sql);

const cssPath = process.argv[2];
const packId = process.argv[3];

if (!cssPath || !packId) {
  console.error('Usage: bun update-css.ts <css-file-path> <pack-id>');
  process.exit(1);
}

const css = readFileSync(cssPath, 'utf-8');

const result = await sql`
  UPDATE beautification_packs
  SET global_css = ${css}, updated_at = NOW()
  WHERE id = ${packId}
  RETURNING id, LENGTH(global_css) as new_length
`;

console.log('✅ CSS updated:');
console.log(result[0]);

await sql.end();
