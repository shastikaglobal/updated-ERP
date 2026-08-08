export async function apiFetch(url: string, options: RequestInit = {}, retries = 2, timeoutMs = 15000): Promise<Response> {
  let attempt = 0;
  const finalUrl = url;

  while (attempt <= retries) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(finalUrl, {
        ...options,
        credentials: options.credentials || 'include',
        signal: controller.signal
      });

      clearTimeout(id);

      if (!response.ok) {
        let errorMsg = `HTTP Error: ${response.status}`;
        try {
          const errData = await response.json();
          if (errData && errData.error) errorMsg = errData.error;
        } catch (e) {}

        if (response.status >= 400 && response.status < 500) {
          throw new Error(errorMsg);
        }
        throw Object.assign(new Error(errorMsg), { retryable: true });
      }

      return response;
    } catch (error: any) {
      attempt++;
      const isRetryable = error.retryable || error.name === 'AbortError';
      if (!isRetryable || attempt > retries) {
        if (error.name === 'AbortError') {
          console.error('[API] Request timed out:', url);
          throw new Error('Connection error. Please check your internet or try again.');
        }
        if (error.retryable) {
          console.error('[API] Fetch failed:', error.message);
          throw new Error('Connection error. Please check your internet or try again.');
        }
        throw error;
      }
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }

  throw new Error('Connection error. Please check your internet or try again.');
}
