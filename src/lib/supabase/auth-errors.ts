type AuthFailure = {
  code?: unknown;
  status?: unknown;
  name?: unknown;
  message?: unknown;
};
function details(error: unknown): AuthFailure {
  return error && typeof error === "object" ? (error as AuthFailure) : {};
}
export function isAuthServiceUnavailable(error: unknown) {
  const value = details(error);
  const message =
    typeof value.message === "string" ? value.message.toLowerCase() : "";
  return (
    value.name === "AuthRetryableFetchError" ||
    value.name === "TimeoutError" ||
    value.name === "AbortError" ||
    (typeof value.status === "number" &&
      (value.status === 0 || value.status >= 500)) ||
    /fetch failed|failed to fetch|network request failed|networkerror|network error|econnrefused|etimedout/.test(
      message,
    )
  );
}
export function authErrorMessage(error: unknown) {
  const value = details(error);
  if (
    value.status === 429 ||
    value.code === "over_request_rate_limit" ||
    value.code === "over_email_send_rate_limit"
  ) {
    return "Se alcanzó el límite de intentos. Esperá unos minutos antes de volver a intentar.";
  }
  if (isAuthServiceUnavailable(error)) {
    return "El servicio de acceso no está disponible en este momento. No pudimos verificar tus credenciales; intentá más tarde.";
  }
  const message =
    typeof value.message === "string" ? value.message.toLowerCase() : "";
  if (
    value.code === "invalid_credentials" ||
    message.includes("invalid login credentials")
  ) {
    return "El email o la contraseña no son correctos.";
  }
  if (
    value.code === "email_not_confirmed" ||
    message.includes("email not confirmed")
  ) {
    return "Confirmá tu email antes de entrar.";
  }
  if (
    value.code === "user_already_exists" ||
    value.code === "email_exists" ||
    message.includes("user already registered")
  ) {
    return "Ese email ya tiene una cuenta. Probá iniciar sesión.";
  }
  return "No se pudo completar la autenticación. Intentá nuevamente.";
}
