export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface SessionUser {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
  authMethod?: string;
}

export interface SessionPayload {
  user: SessionUser | null;
  tier: 'public' | 'pin' | 'google';
}
