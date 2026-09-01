/**
 * GS1 prefix used for the barcodes that Cuadre de Caja generates automatically.
 *
 * The range 040-049 is reserved by the GS1 General Specifications to issue
 * "Restricted Circulation Numbers within a company": no GS1 Member
 * Organisation can ever assign it to a manufacturer, so a code built on this
 * prefix is guaranteed not to collide with the real barcode of any product.
 *
 * It also stays clear of the 02 / 20-29 range, which retail scales commonly
 * use for price-embedded in-store labels.
 */
export const GENERATED_CODE_PREFIX = "040";

/** Total length of a generated code (EAN-13). */
export const GENERATED_CODE_LENGTH = 13;
