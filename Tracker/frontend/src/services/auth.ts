import { createAuth0Client } from '@auth0/auth0-spa-js';
import type { Auth0Client } from '@auth0/auth0-spa-js';

export interface AuthConfig {
  domain: string;
  clientId: string;
  audience: string;
  redirectUri: string;
}

const authConfig: AuthConfig = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN || 'your-auth0-domain.auth0.com',
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID || 'your-auth0-client-id',
  audience: import.meta.env.VITE_AUTH0_AUDIENCE || 'https://sales-tax-tracker-api',
  redirectUri: window.location.origin,
};

export class AuthService {
  private static instance: AuthService;
  private auth0Client: Auth0Client | null = null;
  private initialized = false;

  private constructor() {}

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  async init(): Promise<Auth0Client> {
    if (this.auth0Client && this.initialized) {
      return this.auth0Client;
    }

    // Check if Auth0 credentials are properly configured
    if (authConfig.domain === 'your-auth0-domain.auth0.com' || 
        authConfig.clientId === 'your-auth0-client-id') {
      console.warn('Auth0 credentials not configured, authentication disabled');
      throw new Error('Auth0 not configured');
    }

    this.auth0Client = await createAuth0Client({
      domain: authConfig.domain,
      clientId: authConfig.clientId,
      authorizationParams: {
        redirect_uri: authConfig.redirectUri,
        audience: authConfig.audience,
      },
      cacheLocation: 'localstorage',
    });

    this.initialized = true;
    return this.auth0Client;
  }

  async login(): Promise<void> {
    const client = await this.init();
    await client.loginWithRedirect();
  }

  async logout(): Promise<void> {
    const client = await this.init();
    await client.logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  }

  async getToken(): Promise<string | undefined> {
    const client = await this.init();
    try {
      return await client.getTokenSilently();
    } catch (error) {
      console.error('Error getting token:', error);
      return undefined;
    }
  }

  async getUser() {
    const client = await this.init();
    return await client.getUser();
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      const client = await this.init();
      return await client.isAuthenticated();
    } catch (error) {
      console.error('Authentication check failed:', error);
      return false;
    }
  }

  async handleRedirectCallback() {
    const client = await this.init();
    return await client.handleRedirectCallback();
  }
}

export const authService = AuthService.getInstance();
