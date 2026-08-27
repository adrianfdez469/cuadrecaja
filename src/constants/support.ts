import {
  LANDING_CONTACTS,
  buildWhatsAppUrl,
  type ILandingContactPhone,
} from "./landingContact";

/**
 * How to reach a human when the app will not let you in.
 *
 * The login screen used to carry the three phone numbers written out twice,
 * once per error case, with the WhatsApp message URL-encoded by hand in six
 * `href`s. They are the same people the landing lists, so they are read from
 * the same place — a number that changes now changes everywhere.
 */

/** Every reachable number, in one flat list. */
export const SUPPORT_PHONES: ILandingContactPhone[] = LANDING_CONTACTS.flatMap(
  (person) => person.phones,
);

/** The address shown when a user still has to be set up by an administrator. */
export const SUPPORT_EMAIL = LANDING_CONTACTS[0].email;

/** What the message says, depending on why the door is closed. */
export const SUPPORT_MESSAGES = {
  unconfiguredUser:
    "Hola, mi usuario no está completamente configurado en Cuadre de Caja. ¿Podrían ayudarme?",
  expiredSubscription:
    "Hola, necesito renovar la suscripción de mi negocio en Cuadre de Caja. ¿Podrían ayudarme?",
} as const;

export type SupportTopic = keyof typeof SUPPORT_MESSAGES;

export function buildSupportWhatsAppUrl(
  phone: string,
  topic: SupportTopic,
): string {
  return buildWhatsAppUrl(phone, SUPPORT_MESSAGES[topic]);
}
