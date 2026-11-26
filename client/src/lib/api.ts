/** Cliente HTTP da API do SunHost, com uma sessão isolada por aba. */

const TOKEN_KEY = "sunhost-token";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function getToken() {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}
export function setToken(token: string) {
  try {
    if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* navegação privada sem armazenamento */
  }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export async function api<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {}
): Promise<T> {
  const token = getToken();
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method || "GET",
      headers: {
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") throw error;
    throw new ApiError(
      0,
      "Sem conexão com o servidor. Verifique se a API está rodando (npm run dev)."
    );
  }
  const isJson = (response.headers.get("content-type") || "").includes(
    "application/json"
  );
  const data = isJson ? await response.json().catch(() => null) : null;
  if (!response.ok) {
    if (response.status === 401 && token) onUnauthorized?.();
    throw new ApiError(
      response.status,
      (data && (data as { error?: string }).error) ||
        "Não foi possível concluir a ação."
    );
  }
  return data as T;
}

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Algo deu errado.";
