interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  retryCondition?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringWindow: number;
}

enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

class CircuitBreaker {
  private state = CircuitBreakerState.CLOSED;
  private failures = 0;
  private lastFailureTime = 0;
  private successes = 0;

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.options.resetTimeout) {
        this.state = CircuitBreakerState.HALF_OPEN;
        console.log('Circuit breaker: transitioning to half-open');
      } else {
        throw new Error('Circuit breaker is OPEN - requests are blocked');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= 2) {
        this.state = CircuitBreakerState.CLOSED;
        this.failures = 0;
        this.successes = 0;
        console.log('Circuit breaker: reset to closed state');
      }
    } else {
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.options.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
      console.log('Circuit breaker: opened due to failure threshold');
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failures;
  }
}

export class TimeoutError extends Error {
  constructor(message: string, public timeoutMs: number) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class NetworkError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Fetch with timeout and automatic retries
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const {
    timeout = 10000,
    retries = 3,
    retryDelay = 1000,
    retryCondition = (error: any) => 
      error instanceof TimeoutError || 
      error instanceof NetworkError ||
      (error.name === 'TypeError' && error.message.includes('fetch')),
    onRetry,
    ...fetchOptions
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await executeWithTimeout(url, fetchOptions, timeout);
    } catch (error) {
      lastError = error;
      
      if (attempt === retries || !retryCondition(error)) {
        throw error;
      }

      const delayMs = retryDelay * Math.pow(2, attempt); // Exponential backoff
      
      if (onRetry) {
        onRetry(attempt + 1, error);
      }

      console.warn(`Fetch attempt ${attempt + 1} failed, retrying in ${delayMs}ms:`, error);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

async function executeWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new NetworkError(
        `HTTP ${response.status}: ${response.statusText}`,
        response
      );
    }

    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new TimeoutError(`Request timeout after ${timeoutMs}ms`, timeoutMs);
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new NetworkError(`Network error: ${error.message}`, error);
    }

    throw error;
  }
}

/**
 * JSON fetch with timeout and retries
 */
export async function fetchJsonWithTimeout<T = any>(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<T> {
  const response = await fetchWithTimeout(url, options);
  
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create a circuit breaker for API endpoints
 */
export function createCircuitBreaker(options: Partial<CircuitBreakerOptions> = {}): CircuitBreaker {
  return new CircuitBreaker({
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    monitoringWindow: 300000, // 5 minutes
    ...options
  });
}

/**
 * Utility for creating fetch requests with consistent error handling
 */
export class ApiClient {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  
  constructor(
    private baseUrl: string,
    private defaultOptions: FetchWithTimeoutOptions = {}
  ) {}

  async request<T = any>(
    endpoint: string,
    options: FetchWithTimeoutOptions = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const circuitBreakerKey = new URL(url).origin;
    
    if (!this.circuitBreakers.has(circuitBreakerKey)) {
      this.circuitBreakers.set(circuitBreakerKey, createCircuitBreaker());
    }
    
    const circuitBreaker = this.circuitBreakers.get(circuitBreakerKey)!;
    
    return circuitBreaker.execute(async () => {
      return fetchJsonWithTimeout<T>(url, {
        ...this.defaultOptions,
        ...options,
        onRetry: (attempt, error) => {
          console.warn(`API request retry ${attempt} for ${url}:`, error);
          if (options.onRetry) {
            options.onRetry(attempt, error);
          }
        }
      });
    });
  }

  async get<T = any>(endpoint: string, options: FetchWithTimeoutOptions = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T = any>(
    endpoint: string, 
    data?: any, 
    options: FetchWithTimeoutOptions = {}
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  }

  async put<T = any>(
    endpoint: string, 
    data?: any, 
    options: FetchWithTimeoutOptions = {}
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  }

  async delete<T = any>(endpoint: string, options: FetchWithTimeoutOptions = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  getCircuitBreakerStatus(): Record<string, { state: CircuitBreakerState; failures: number }> {
    const status: Record<string, { state: CircuitBreakerState; failures: number }> = {};
    
    for (const [key, breaker] of this.circuitBreakers) {
      status[key] = {
        state: breaker.getState(),
        failures: breaker.getFailureCount()
      };
    }
    
    return status;
  }
}

/**
 * Utility function to determine if an error should trigger a retry
 */
export function isRetryableError(error: any): boolean {
  // Network timeouts and connection issues
  if (error instanceof TimeoutError || error instanceof NetworkError) {
    return true;
  }
  
  // Fetch API errors (network issues)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }
  
  // HTTP status codes that should be retried
  if (error.response && error.response.status) {
    const status = error.response.status;
    return status >= 500 || status === 408 || status === 429;
  }
  
  return false;
}

/**
 * Create a debounced version of an async function
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number
): T {
  let timeoutId: NodeJS.Timeout;
  let resolveWaiting: Array<{
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];

  return ((...args: any[]) => {
    return new Promise((resolve, reject) => {
      // Clear existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Add to waiting queue
      resolveWaiting.push({ resolve, reject });

      // Set new timeout
      timeoutId = setTimeout(async () => {
        const currentWaiting = resolveWaiting;
        resolveWaiting = [];

        try {
          const result = await fn(...args);
          currentWaiting.forEach(({ resolve }) => resolve(result));
        } catch (error) {
          currentWaiting.forEach(({ reject }) => reject(error));
        }
      }, delay);
    });
  }) as T;
}
