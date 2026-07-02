import { seedGoogleOAuthForE2E } from './helpers/google-oauth';

export default async function globalSetup(): Promise<void> {
  process.env.ENCRYPTION_KEY ??= 'a'.repeat(64);
  await seedGoogleOAuthForE2E();
}
