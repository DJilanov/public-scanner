export interface Fetcher {
  fetch(input: string | URL, init?: RequestInit): Promise<Response>;
}

export const defaultFetcher: Fetcher = {
  fetch(input, init) {
    return fetch(input, init);
  }
};

export async function fetchText(
  fetcher: Fetcher,
  input: string | URL,
  init?: RequestInit
): Promise<string> {
  const response = await fetcher.fetch(input, init);
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status} ${response.statusText}`);
  }

  return response.text();
}

export async function fetchJson<T>(
  fetcher: Fetcher,
  input: string | URL,
  init?: RequestInit
): Promise<T> {
  const response = await fetcher.fetch(input, init);
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}
