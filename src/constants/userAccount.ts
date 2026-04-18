/** JWT de invitación (varios enlaces válidos hasta expirar). */
export const USER_ACCOUNT_JWT_INVITE_EXPIRES_IN = "4h" as const;

/** JWT de restablecimiento de contraseña (olvidé mi contraseña). */
export const USER_ACCOUNT_JWT_RESET_EXPIRES_IN = "1h" as const;

/** Clave sessionStorage compartida con la página de login (prefill tras activación). */
export const LOGIN_CREDENTIALS_SESSION_KEY = "prefill_login_credentials";

export const ACTIVAR_USUARIO_PATH = "/activar-usuario";
/** Solo ASCII en la ruta (evita 404 en algunos hosts/proxies con `ñ` en el path). */
export const RESTABLECER_CONTRASEÑA_PATH = "/restablecer-contrasena";
export const OLVIDE_CONTRASEÑA_PATH = "/olvide-contrasena";
