/**
 * Colours that belong to someone else.
 *
 * These are third-party brand marks, not design decisions of ours, so they sit
 * outside `src/theme` on purpose: the palette there is a closed set of six
 * hues with one meaning each, and WhatsApp's green is not one of them. They
 * live here so they stop being magic literals inside `sx`, and so it stays
 * obvious that changing them would be wrong rather than a restyle.
 */

/** WhatsApp's brand green, for its icon and its link text. */
export const WHATSAPP_GREEN = "#25D366";
