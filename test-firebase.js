const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    env[key] = value;
  }
});

let projectId = env.FIREBASE_ADMIN_PROJECT_ID;
let clientEmail = env.FIREBASE_ADMIN_CLIENT_EMAIL;
let privateKey = env.FIREBASE_ADMIN_PRIVATE_KEY;

if (projectId?.startsWith('"') && projectId?.endsWith('"')) projectId = projectId.substring(1, projectId.length - 1);
if (clientEmail?.startsWith('"') && clientEmail?.endsWith('"')) clientEmail = clientEmail.substring(1, clientEmail.length - 1);
if (privateKey?.startsWith('"') && privateKey?.endsWith('"')) privateKey = privateKey.substring(1, privateKey.length - 1);
if (privateKey) privateKey = privateKey.replace(/\\n/g, '\n');

async function test() {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      })
    });

    console.log("Testing (default) database...");
    const db1 = admin.firestore();
    try {
      await db1.listCollections();
      console.log("(default) database works!");
    } catch (e) {
      console.log("(default) database failed:", e.message);
    }

    console.log("Testing project-named database [" + projectId + "]...");
    try {
      const db2 = admin.firestore(projectId);
      await db2.listCollections();
      console.log("project-named database works!");
    } catch (e) {
      console.log("project-named database failed:", e.message);
    }
  } catch (err) {
    console.error("Setup error:", err.message);
  }
}

test();
