import { Logging } from '@google-cloud/logging';
import dotenv from 'dotenv';

dotenv.config();

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY;

let gcpLogging: Logging | null = null;
let gcpLog: any = null;

if (projectId && clientEmail && privateKey) {
  try {
    gcpLogging = new Logging({
      projectId,
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      }
    });
    gcpLog = gcpLogging.log('typhoon-resilience-vault-telemetry');
    console.log('[Telemetry] Google Cloud Logging stream initialized and active.');
  } catch (err) {
    console.warn('[Telemetry] Failed to initialize Google Cloud Logging client:', err);
  }
} else {
  console.log('[Telemetry] Missing GCP environment credentials. Streaming logs in local simulation mode.');
}

export const logEvent = async (
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'NOTICE',
  message: string,
  metadata: Record<string, any> = {}
) => {
  const timestamp = new Date();
  
  // Colorful Terminal Output
  const colorMap = {
    INFO: '\x1b[36m[INFO]\x1b[0m',
    WARNING: '\x1b[33m[WARN]\x1b[0m',
    ERROR: '\x1b[31m[ERROR]\x1b[0m',
    NOTICE: '\x1b[32m[NOTICE]\x1b[0m',
  };
  
  console.log(
    `${colorMap[severity]} ${timestamp.toISOString()} - ${message}`, 
    Object.keys(metadata).length ? JSON.stringify(metadata) : ''
  );

  // Stream directly to GCP Cloud Logging service
  if (gcpLog) {
    try {
      const metadataEntry = {
        resource: { type: 'global' },
        severity: severity,
        timestamp: timestamp,
      };
      const entry = gcpLog.entry(metadataEntry, {
        message,
        ...metadata,
      });
      await gcpLog.write(entry);
    } catch (err: any) {
      if (err.code === 7 || (err.message && err.message.includes('PERMISSION_DENIED'))) {
        console.warn('[Telemetry] Permission denied for Google Cloud Logging. Switching to local-only logging.');
        gcpLog = null; // Disable future attempts to prevent spam
      } else {
        console.warn('[Telemetry] Failed to write event to Google Cloud Logging stream:', err);
      }
    }
  }
};

export const logger = {
  info: (msg: string, meta?: any) => logEvent('INFO', msg, meta),
  warn: (msg: string, meta?: any) => logEvent('WARNING', msg, meta),
  error: (msg: string, meta?: any) => logEvent('ERROR', msg, meta),
  notice: (msg: string, meta?: any) => logEvent('NOTICE', msg, meta),
};
