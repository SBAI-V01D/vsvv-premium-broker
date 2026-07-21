import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: process.env.NEXT_PUBLIC_BASE44_SERVER_URL || 'https://api.base44.com',
  requiresAuth: false,
  appBaseUrl
});
