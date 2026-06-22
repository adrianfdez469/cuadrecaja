type NegocioConPlan = {
  id: string;
  nombre: string;
  limitTime: Date;
  planId: string | null;
  monedaBase?: string | null;
  monedaFuerte?: string | null;
  plan?: {
    limiteLocales: number;
    limiteUsuarios: number;
    limiteProductos: number;
  } | null;
};

export type INegocioParaApp = {
  id: string;
  nombre: string;
  limitTime: Date;
  planId: string | null;
  monedaBase: string;
  monedaFuerte: string;
  locallimit: number;
  userlimit: number;
  productlimit: number;
};

export function buildNegocioParaApp(negocio: NegocioConPlan): INegocioParaApp {
  return {
    id: negocio.id,
    nombre: negocio.nombre,
    limitTime: negocio.limitTime,
    planId: negocio.planId,
    monedaBase: negocio.monedaBase ?? "CUP",
    monedaFuerte: negocio.monedaFuerte ?? "CUP",
    locallimit: negocio.plan?.limiteLocales ?? -1,
    userlimit: negocio.plan?.limiteUsuarios ?? -1,
    productlimit: negocio.plan?.limiteProductos ?? -1,
  };
}
