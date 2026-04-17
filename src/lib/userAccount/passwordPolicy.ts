/**
 * Valida política de contraseña (alineada con cambiar-password).
 * @returns mensaje de error o null si es válida.
 */
export function validatePasswordPolicy(password: string): string | null {
  if (password.length < 8) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return "La contraseña debe contener mayúsculas, minúsculas y números.";
  }
  return null;
}
