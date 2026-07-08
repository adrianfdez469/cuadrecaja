export const LANDING_CTA_SECTION_ID = 'contact-section';
export const LANDING_CONTACT_INFO_SECTION_ID = 'contact-info-section';

export interface ILandingContactPhone {
  display: string;
  whatsapp: string;
  label?: string;
}

export interface ILandingContactPerson {
  name: string;
  role: string;
  phones: ILandingContactPhone[];
  email: string;
}

export const LANDING_WHATSAPP_DEFAULT_MESSAGE =
  'Hola, me interesa conocer más sobre Cuadre de Caja. ¿Podrían ayudarme?';

export const LANDING_CONTACTS: ILandingContactPerson[] = [
  {
    name: 'Adrián Fernández',
    role: 'Desarrollador',
    phones: [
      { display: '+53 53334449', whatsapp: '5353334449' },
      { display: '+598 97728107', whatsapp: '59897728107', label: 'Número alternativo' },
    ],
    email: 'adrianfdez469@gmail.com',
  },
  {
    name: 'Carlos Fernández',
    role: 'Desarrollador',
    phones: [{ display: '+53 54319958', whatsapp: '5354319958' }],
    email: 'olimac9010@gmail.com',
  },
];

export function buildWhatsAppUrl(phone: string, message = LANDING_WHATSAPP_DEFAULT_MESSAGE): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function scrollToLandingSection(sectionId: string): void {
  const el = document.getElementById(sectionId);
  if (!el) return;

  const headerReservePx = (): number => {
    const appBar = document.querySelector('.MuiAppBar-root');
    if (appBar instanceof HTMLElement) {
      return Math.ceil(appBar.getBoundingClientRect().height) + 16;
    }
    return 104;
  };

  const reserve = headerReservePx();
  const top = el.getBoundingClientRect().top + window.scrollY - reserve;
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}
