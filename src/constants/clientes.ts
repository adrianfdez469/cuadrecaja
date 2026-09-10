/**
 * Every bound and every literal of the Cliente domain (F-031).
 *
 * `AGENTS.md` forbids magic numbers and magic strings, and the contract (§ 3) puts them here
 * rather than inside the store or the hook so they are importable from a test and from the
 * browser console when criteria 8 and 9 are verified.
 */

export const CLIENTES_CACHE_STORAGE_KEY = "clientes-cache";

/**
 * Where the identity of the session that wrote the cache is kept — a SEPARATE key, never a
 * fifth field inside the cache entry, so what `CLIENTES_CACHE_STORAGE_KEY` holds stays
 * exactly what criterion 8 inspects.
 */
export const CLIENTES_CACHE_OWNER_KEY = "clientes-cache-owner";

/** Bump to discard every persisted cache on its next load (criterion 9, ADR 0108). */
export const CLIENTES_CACHE_VERSION = 1;

/** Upper bound of persisted options. */
export const CLIENTES_CACHE_SIZE = 200;

/**
 * Upper bound of rows GET /api/clientes returns. It is DELIBERATELY larger than
 * CLIENTES_CACHE_SIZE: if it were not, the cache bound would never be exercised and
 * criterion 8 would pass with a broken truncation (E-008).
 */
export const CLIENTES_LIST_LIMIT = 500;

export const CLIENTES_SEARCH_DEBOUNCE_MS = 300;

/** One retry, and only one: the sole failure it can resolve is a lost race (ADR 0107). */
export const CLIENTES_UPSERT_RETRIES = 1;

/** The permission that gates every write of `api/clientes/**` and the screen's actions. */
export const CLIENTES_PERMISO_CONFIGURACION = "configuracion.clientes.acceder";

/** The permission that gates the menu entry pointing at the panel F-033 will build. */
export const CUENTAS_POR_COBRAR_PERMISO = "recuperaciones.cuentasporcobrar.acceder";

export const CLIENTES_API_ERRORS = {
  nombreRequerido: "El nombre del cliente es obligatorio",
  nombreDuplicado: "Ya existe un cliente con ese nombre",
  cuerpoInvalido: "Datos del cliente inválidos",
  saldoPendiente: (saldo: number): string =>
    `No se puede eliminar el cliente: tiene un saldo pendiente de ${saldo.toFixed(2)}`,
} as const;

/**
 * The literal copy of the three surfaces, fixed by `.agents/designs/F-031.md`, § 5.
 * `crearSinConexion` and `crearSinPermiso` are THE only source of the two texts of
 * criterion 10; no component writes a literal of its own.
 */
export const CLIENTES_COPY = {
  /* ---- The screen ---- */
  pageTitle: "Clientes",
  pageSubtitle: "Los clientes a los que el negocio les fía, y cuánto debe cada uno.",
  breadcrumbInicio: "Inicio",
  breadcrumbConfiguracion: "Configuración",
  seccionEtiqueta: "Clientes del negocio",
  listaTitulo: "Lista de clientes",
  recargar: "Actualizar la lista",

  statTotal: "Clientes activos",
  statConSaldo: "Con saldo pendiente",

  nuevoCliente: "Nuevo cliente",
  editarCliente: "Editar cliente",
  desactivarCliente: "Desactivar cliente",
  verTodos: "Ver todos",
  sinContacto: "Sin contacto",
  sinSaldo: "—",

  columnaCliente: "Cliente",
  columnaContacto: "Contacto",
  columnaSaldo: "Saldo",
  columnaAcciones: "Acciones",

  /* ---- List states ---- */
  vacioTitulo: "Todavía no hay clientes",
  vacioDescripcion: "Crea el primero para poder fiarle una venta.",
  sinResultadosTitulo: "Ningún cliente coincide",
  sinResultadosDescripcion: "Revisa el nombre, o vuelve a la lista completa.",
  errorTitulo: "No se pudo cargar la lista de clientes",
  errorDescripcion:
    "Vuelve a intentarlo. Si sigue fallando, avisa a un administrador del negocio.",
  listaSinConexion:
    "La lista completa se lee del servidor. Sin conexión solo puedes elegir entre los clientes que quedaron guardados en este dispositivo.",

  /* ---- The form ---- */
  formTituloNuevo: "Nuevo cliente",
  formTituloEditar: "Editar cliente",
  formNombre: "Nombre del cliente",
  formNombrePlaceholder: "Ej: Ana Pérez, Taller El Sol…",
  formTelefono: "Teléfono",
  formTelefonoPlaceholder: "Ej: +53 5555 5555",
  formDireccion: "Dirección",
  formDescripcion: "Nota",
  formDescripcionPlaceholder:
    "Para qué se le fía, quién lo trajo, lo que haga falta recordar.",
  formGuardar: "Guardar",

  /* ---- Outcomes ---- */
  creado: "Cliente creado.",
  reactivado:
    "Ese cliente estaba desactivado y se volvió a activar con los datos nuevos.",
  actualizado: "Cliente actualizado.",
  desactivado: "Cliente desactivado.",

  /* ---- The two selector surfaces ---- */
  selectorTitulo: "Elegir cliente",
  selectorCampoEtiqueta: "Cliente",
  selectorBuscarAbrir: "Buscar un cliente",
  selectorBuscarPlaceholder: "Escribe un nombre…",
  selectorLimpiar: "Quitar el cliente elegido",
  selectorCargando: "Buscando…",
  selectorSinResultadosTitulo: "Ningún cliente coincide",
  selectorSinResultadosDescripcion: "Revisa el nombre, o créalo aquí mismo.",
  selectorSinClientes: "Todavía no hay clientes guardados.",
  selectorError: "No se pudo buscar en el servidor.",
  selectorDesdeCache:
    "Sin conexión: estos son los clientes guardados en este dispositivo, con el saldo de la última vez que se pudo consultar.",

  /* ---- Quick create ---- */
  crearNuevo: "Crear un cliente nuevo",

  /* ---- Criterion 10: the visible reason. THE only source of these two texts ---- */
  crearSinConexion:
    "Sin conexión no se puede crear un cliente desde aquí. Elige uno de los que quedaron guardados en este dispositivo, o créalo cuando vuelva la conexión.",
  crearSinPermiso:
    "Tu usuario no puede crear clientes. Pídeselo a un administrador del negocio.",
} as const;

/**
 * Copy the design's § 5 block does not carry, kept OUT of `CLIENTES_COPY` so that object stays
 * exactly the one the design fixed. Same rule applies: no component writes its own literal.
 */
export const CLIENTES_EXTRA_COPY = {
  /** The short form the selector unfolds in place (design § 4b). */
  quickNombre: "Nombre",
  quickTelefono: "Teléfono",
  quickCrear: "Crear",
  quickCancelar: "Cancelar",
  /** Shown when the create request fails without a message of its own. */
  errorCrear: "No se pudo crear el cliente.",
  /** The 500 body of the five routes: a FIXED string, never the exception message (E-031). */
  errorInterno: "Error interno del servidor",
} as const;

/** Cut of the name inside the label of the create action. */
export const CLIENTE_CREATE_LABEL_MAX_CHARS = 28;

/** Reading width of the two selection surfaces, in px. */
export const CLIENTE_SELECTOR_MAX_WIDTH = 420;

/**
 * The eleven location classes. They exist so a verification finds each piece without depending
 * on an internal MUI class (E-011), and they are matched with `classList.contains` and never by
 * prefix: `cc-cliente-create` is a prefix of `cc-cliente-create-reason` (E-016).
 */
export const CLIENTES_DOM = Object.freeze({
  section: "cc-clientes-section",
  selector: "cc-cliente-selector",
  autocomplete: "cc-cliente-autocomplete",
  searchTrigger: "cc-cliente-search-trigger",
  sheet: "cc-cliente-sheet",
  sheetRow: "cc-cliente-sheet-row",
  list: "cc-clientes-list",
  row: "cc-cliente-row",
  createAction: "cc-cliente-create",
  createReason: "cc-cliente-create-reason",
  cacheNotice: "cc-cliente-cache-notice",
} as const);
