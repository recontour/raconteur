import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

function getAdminApp(): App {
  const apps = getApps();
  if (apps.length > 0) return apps[0];

  let projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  let clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  // Strip quotes and trim whitespace if present
  if (projectId?.startsWith('"') && projectId?.endsWith('"')) {
    projectId = projectId.substring(1, projectId.length - 1);
  }
  projectId = projectId?.trim();

  if (clientEmail?.startsWith('"') && clientEmail?.endsWith('"')) {
    clientEmail = clientEmail.substring(1, clientEmail.length - 1);
  }
  clientEmail = clientEmail?.trim();

  if (privateKey?.startsWith('"') && privateKey?.endsWith('"')) {
    privateKey = privateKey.substring(1, privateKey.length - 1);
  }
  privateKey = privateKey?.trim();

  if (privateKey && privateKey.includes("\\n")) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  if (!projectId || !clientEmail || !privateKey) {
    console.error("[FIREBASE-ADMIN] Missing configuration variables:", {
      projectId: projectId || "MISSING",
      clientEmail: clientEmail || "MISSING",
      hasPrivateKey: !!privateKey
    });
  } else {
    // Log with brackets to see any hidden spaces
    console.log(`[FIREBASE-ADMIN] Initializing with Project: [${projectId}]`);
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    })
  });
}

// Initialize the app once
const app = getAdminApp();

const databaseId = process.env.FIREBASE_ADMIN_DATABASE_ID || '(default)';
export const adminDb = getFirestore(app, databaseId);
export const adminAuth = getAuth(app);
