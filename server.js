/**
 * Minimal Express server demonstrating:
 * - storing API keys (demo using lowdb JSON file)
 * - creating an invoice with Xendit
 * - webhook endpoint to receive invoice updates
 *
 * Environment:
 * - MASTER_ENC_KEY (used to symmetrically encrypt stored keys in demo)
 * - For real use, use hosting-managed secrets and a real DB
 */

const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Low, JSONFile } = require('lowdb');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple lowdb storage (demo). In prod use Postgres.
const adapter = new JSONFile('db.json');
const db = new Low(adapter);

async function initDb() {
  await db.read();
  db.data ||= { keys: [], invoices: [] };
  await db.write();
}
initDb();

// Simple encrypt/decrypt using MASTER_ENC_KEY (demo only)
const MASTER_KEY = process.env.MASTER_ENC_KEY || 'dev-master-key-please-change';
function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', crypto.createHash('sha256').update(MASTER_KEY).digest(), iv);
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted}`;
}
function decrypt(payload) {
  const [ivB, tagB, encrypted] = payload.split('.');
  const iv = Buffer.from(ivB, 'base64');
  const tag = Buffer.from(tagB, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', crypto.createHash('sha256').update(MASTER_KEY).digest(), iv);
  decipher.setAuthTag(tag);
  let out = decipher.update(encrypted, 'base64', 'utf8');
  out += decipher.final('utf8');
  return out;
}

// Admin: add an Xendit key (label + key + env)
app.post('/admin/keys', async (req, res) => {
  const { label,*

