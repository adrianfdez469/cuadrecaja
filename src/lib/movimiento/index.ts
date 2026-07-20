import { prisma } from "../prisma";
import { isMovimientoBaja } from "@/utils/tipoMovimiento";
import { calcularCPP, requiereCPP } from "../cpp-calculator";
import { convertToBase, convertFromBase, buildTasaSnapshot } from "../currency";
import { calcularEfectivoDisponiblePorMoneda } from "./caja";
import { DEFAULT_CURRENCY } from "@/constants/billDenominations";
import type {
  IAdvertenciaCajaInsuficiente,
  IMovimientoCreate,
  IFormaPagoCompra,
  ITipoMovimiento,
} from "@/schemas/movimiento";

// CreateMoviento es de uso interno del servidor: acepta el enum COMPLETO de
// tipos (a diferencia de movimientoDataSchema, que restringe qué tipos puede
// crear el endpoint HTTP genérico). Rutas dedicadas y confiables — como
// /api/venta/[tiendaId]/devolucion/[ventaId] — la invocan directamente con
// tipos como DEVOLUCION_VENTA que el endpoint genérico no permite.
// usuarioId nunca se acepta del cliente: los llamadores del servidor lo
// fuerzan siempre desde la sesión autenticada antes de invocar esta función.
type ICreateMovimientoData = {
  tipo: ITipoMovimiento;
  tiendaId: string;
  usuarioId: string;
  referenciaId?: string;
  motivo?: string;
  proveedorId?: string;
  destinationId?: string;
  formaPago?: IFormaPagoCompra;
};

export const CreateMoviento = async (
  data: ICreateMovimientoData,
  items: IMovimientoCreate[],
) => {
  const {
    tipo,
    tiendaId,
    usuarioId,
    referenciaId,
    motivo,
    proveedorId,
    destinationId,
    formaPago,
  } = data;

  // Fetch exchange rates once for the whole batch
  const tiendaWithNegocio = await prisma.tienda.findUnique({
    where: { id: tiendaId },
    select: { negocio: { select: { monedaBase: true, id: true } } },
  });
  const monedaBase = tiendaWithNegocio?.negocio?.monedaBase ?? DEFAULT_CURRENCY;
  const negocioId = tiendaWithNegocio?.negocio?.id;

  const tasasCambio = negocioId
    ? await prisma.tasaCambio.findMany({
        where: { negocioId },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const tasas = buildTasaSnapshot(tasasCambio);

  const esCompraEfectivoCaja =
    tipo === "COMPRA" && formaPago === "EFECTIVO_CAJA";
  const advertenciasCaja: IAdvertenciaCajaInsuficiente[] = [];

  await prisma.$transaction(
    async (tx) => {
      // Lock de aplicación por tienda: serializa transacciones concurrentes que
      // comprometen efectivo de caja para que no lean el mismo "disponible"
      // antes de que la otra confirme (evitaría dejar la caja en negativo).
      // Se libera solo al terminar esta transacción (xact_lock).
      if (esCompraEfectivoCaja) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tiendaId})::bigint)`;
      }

      // Efectivo realmente disponible por moneda, calculado DENTRO de la
      // transacción y bajo el lock anterior — ya no puede quedar stale frente
      // a otra compra concurrente. Si la compra supera lo disponible, se cubre
      // lo que se pueda de caja y el resto queda como fondeo externo (MIXTO).
      const restanteDisponible: Record<string, number> = esCompraEfectivoCaja
        ? await calcularEfectivoDisponiblePorMoneda(tiendaId, monedaBase, tx)
        : {};

      for (const movimiento of items) {
        const {
          productoId,
          cantidad,
          costoUnitario,
          monedaCompra,
          proveedorId: itemProveedorId,
          movimientoOrigenId,
          fechaVencimiento,
          monedaOriginal,
          montoOriginal,
          tasaUsada: tasaUsadaItem,
          costoTotal: costoTotalOverride, // MERMA (opcional) y DEVOLUCION_VENTA (requerido): valor en moneda base
          montoReembolso, // Solo DEVOLUCION_VENTA
        } = movimiento;

        // 0. Si es COMPRA con EFECTIVO_CAJA, topear al efectivo realmente
        // disponible en esa moneda; el excedente pasa a fondeo externo (MIXTO).
        let formaPagoItem = formaPago;
        let montoEfectivoCajaItem: number | undefined;
        if (tipo === "COMPRA" && formaPago === "EFECTIVO_CAJA") {
          const montoCompra =
            montoOriginal ??
            (costoUnitario && cantidad ? costoUnitario * cantidad : 0);
          const moneda = monedaOriginal ?? monedaBase;
          const disponibleMoneda = Math.max(0, restanteDisponible[moneda] ?? 0);

          if (montoCompra > disponibleMoneda) {
            formaPagoItem = disponibleMoneda > 0 ? "MIXTO" : "EXTERNO";
            montoEfectivoCajaItem =
              disponibleMoneda > 0 ? disponibleMoneda : undefined;
            restanteDisponible[moneda] = 0;
            advertenciasCaja.push({
              moneda,
              solicitado: montoCompra,
              disponible: disponibleMoneda,
              tomadoDeCaja: montoEfectivoCajaItem ?? 0,
              fondeoExterno: montoCompra - (montoEfectivoCajaItem ?? 0),
            });
          } else {
            montoEfectivoCajaItem = montoCompra;
            restanteDisponible[moneda] = disponibleMoneda - montoCompra;
          }
        }

        // 1. Obtener el productoTienda existente
        let existenciaAnterior = 0;
        const productoTiendaExistente = await tx.productoTienda.findFirst({
          where: {
            tiendaId,
            productoId,
            proveedorId: itemProveedorId || proveedorId || null,
            deletedAt: null,
          },
        });

        let productoTienda;
        let calculoCPP = null;
        // Moneda efectiva del costo para este movimiento
        const monedaEfectiva = monedaCompra ?? monedaBase;

        if (productoTiendaExistente) {
          existenciaAnterior = productoTiendaExistente.existencia;

          let nuevoCosto = productoTiendaExistente.costo;
          let nuevaMonedaCosto = productoTiendaExistente.monedaCostoCode;

          if (requiereCPP(tipo) && costoUnitario) {
            // Resolver la moneda actual del producto (null = monedaBase)
            const monedaActual =
              productoTiendaExistente.monedaCostoCode ?? monedaBase;

            // Si la moneda cambia, convertir el costo anterior a la nueva moneda
            const costoAnteriorEnNuevaMoneda =
              monedaActual === monedaEfectiva
                ? productoTiendaExistente.costo
                : convertFromBase(
                    convertToBase(
                      productoTiendaExistente.costo,
                      monedaActual,
                      tasas,
                      monedaBase,
                    ),
                    monedaEfectiva,
                    tasas,
                    monedaBase,
                  );

            try {
              calculoCPP = calcularCPP(
                existenciaAnterior,
                costoAnteriorEnNuevaMoneda,
                cantidad,
                costoUnitario,
              );
              nuevoCosto = calculoCPP.costoNuevo;
              nuevaMonedaCosto = monedaEfectiva;
            } catch (error) {
              console.error("❌ Error calculando CPP:", error.message);
              nuevoCosto = productoTiendaExistente.costo;
            }
          }

          // Calcular fecha de vencimiento mínima
          let minFechaVencimiento: Date | undefined = undefined;
          if (!isMovimientoBaja(tipo) && fechaVencimiento) {
            const nuevaFecha = new Date(fechaVencimiento);
            minFechaVencimiento = productoTiendaExistente.fechaVencimiento
              ? new Date(
                  Math.min(
                    productoTiendaExistente.fechaVencimiento.getTime(),
                    nuevaFecha.getTime(),
                  ),
                )
              : nuevaFecha;
          }

          productoTienda = await tx.productoTienda.update({
            where: { id: productoTiendaExistente.id },
            data: {
              existencia: {
                ...(isMovimientoBaja(tipo)
                  ? { decrement: cantidad }
                  : { increment: cantidad }),
              },
              ...(requiereCPP(tipo) &&
                costoUnitario && {
                  costo: nuevoCosto,
                  monedaCostoCode: nuevaMonedaCosto,
                }),
              ...(minFechaVencimiento && {
                fechaVencimiento: minFechaVencimiento,
              }),
            },
          });
        } else {
          // Producto nuevo en esta tienda
          productoTienda = await tx.productoTienda.create({
            data: {
              tiendaId,
              productoId,
              costo: costoUnitario || 0,
              precio: 0,
              existencia: cantidad,
              monedaCostoCode: costoUnitario ? monedaEfectiva : null,
              proveedorId: itemProveedorId || proveedorId || null,
              ...(!isMovimientoBaja(tipo) &&
                fechaVencimiento && {
                  fechaVencimiento: new Date(fechaVencimiento),
                }),
            },
          });

          if (requiereCPP(tipo) && costoUnitario) {
            calculoCPP = {
              costoAnterior: 0,
              costoNuevo: costoUnitario,
              valorInventarioAnterior: 0,
              valorInventarioNuevo: cantidad * costoUnitario,
              existenciaAnterior: 0,
              existenciaNueva: cantidad,
              cantidadCompra: cantidad,
              costoUnitarioCompra: costoUnitario,
              costoTotalCompra: cantidad * costoUnitario,
            };
          }
        }

        // 2b. Valorización de MERMA / DEVOLUCION_VENTA (no participan del CPP)
        let valorMermaODevolucion: number | undefined;
        if (tipo === "MERMA") {
          if (costoTotalOverride != null) {
            valorMermaODevolucion = costoTotalOverride;
          } else {
            const costoVigente =
              productoTiendaExistente?.costo ?? costoUnitario;
            if (costoVigente == null) {
              throw new Error(
                `No se pudo valorizar la MERMA del producto ${productoId}: no existe stock previo en esta tienda ni se indicó costoUnitario/costoTotal.`,
              );
            }
            // El costo del producto puede estar en una moneda distinta a monedaBase
            // (monedaCostoCode) — convertir antes de valorizar la pérdida.
            const costoVigenteBase = convertToBase(
              costoVigente,
              productoTiendaExistente?.monedaCostoCode ?? monedaBase,
              tasas,
              monedaBase,
            );
            valorMermaODevolucion = cantidad * costoVigenteBase;
          }
        } else if (tipo === "DEVOLUCION_VENTA") {
          // Requerido: el llamador calcula el costo histórico de la venta original
          valorMermaODevolucion = costoTotalOverride ?? 0;
        }

        // 3. Actualizar productos fraccionados
        const productosFraccionados = await tx.producto.findMany({
          where: { fraccionDeId: productoId },
        });

        for (const productoFraccion of productosFraccionados) {
          const productoTiendaFraccionado = await tx.productoTienda.findFirst({
            where: { productoId: productoFraccion.id, tiendaId },
          });
          if (calculoCPP) {
            const costoFraccion =
              calculoCPP.costoNuevo / productoFraccion.unidadesPorFraccion;
            if (productoTiendaFraccionado) {
              await tx.productoTienda.update({
                where: { id: productoTiendaFraccionado.id },
                data: {
                  costo: costoFraccion,
                  ...(monedaEfectiva && { monedaCostoCode: monedaEfectiva }),
                },
              });
            } else {
              await tx.productoTienda.create({
                data: {
                  productoId: productoFraccion.id,
                  tiendaId,
                  costo: costoFraccion,
                  precio: 0,
                  existencia: 0,
                  monedaCostoCode: monedaEfectiva,
                  proveedorId: itemProveedorId || proveedorId || null,
                },
              });
            }
          }
        }

        // 4. Crear el movimiento
        await tx.movimientoStock.create({
          data: {
            tipo,
            cantidad,
            productoTiendaId: productoTienda.id,
            tiendaId,
            usuarioId,
            existenciaAnterior,

            ...(calculoCPP && {
              costoUnitario: calculoCPP.costoUnitarioCompra,
              costoTotal: calculoCPP.costoTotalCompra,
              costoAnterior: calculoCPP.costoAnterior,
              costoNuevo: calculoCPP.costoNuevo,
            }),
            ...(valorMermaODevolucion !== undefined && {
              costoTotal: valorMermaODevolucion,
            }),

            ...(referenciaId && { referenciaId }),
            ...(motivo && { motivo }),
            ...(proveedorId && { proveedorId }),
            ...(itemProveedorId && { proveedorId: itemProveedorId }),
            ...(destinationId && { destinationId }),
            ...(tipo === "TRASPASO_SALIDA" && { state: "PENDIENTE" }),
            ...(monedaOriginal && {
              monedaOriginal,
              montoOriginal,
              tasaUsada: tasaUsadaItem,
            }),
            ...(tipo === "COMPRA" &&
              formaPagoItem && { formaPago: formaPagoItem }),
            ...(tipo === "COMPRA" &&
              montoEfectivoCajaItem !== undefined && {
                montoEfectivoCaja: montoEfectivoCajaItem,
              }),
            ...(tipo === "DEVOLUCION_VENTA" &&
              montoReembolso !== undefined && { montoReembolso }),
          },
        });

        if (tipo === "TRASPASO_ENTRADA") {
          await tx.movimientoStock.update({
            where: { id: movimientoOrigenId },
            data: { state: "APROBADO" },
          });
        }
      }
    },
    esCompraEfectivoCaja ? { timeout: 15000, maxWait: 10000 } : undefined,
  );

  return { advertenciasCaja };
};
