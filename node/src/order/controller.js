// src/order/controller.js
// Controlador de /orders (en memoria) — ESM
// Asegúrate de tener "type": "module" en package.json

//creacion de ordenes post
const ORDERS = new Map(); // almacén en memoria

const nowISO = () => new Date().toISOString(); // fecha actual en ISO 8601
const newId =
  () => "o_" + (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 10));// id aleatorio

const ALLOWED = new Set(["created", "paid", "canceled"]);// estados válidos

// --- ETags --- get 
// Recurso: ETag basado en versión del documento si se agrego una vueva o si se elimino o si se modifico
const etagOf = (o) => `W/"${o.version ?? 1}"`;
// Colección: cambia si cambia cualquier orden (usa máx versión + cantidad)
const etagOfCollection = () => {
  const items = [...ORDERS.values()];
  const maxVer = items.reduce((m, x) => Math.max(m, x.version ?? 1), 0);
  return `W/"collection:${maxVer}-${items.length}"`;
};

/**
 * POST /orders
 * body: { userId: string, amount: number, status?: "created"|"paid"|"canceled", items?: any[] }
 * 201 Created + Location
 */
export async function createOrder(req, res) {
  const { userId, amount, status, items } = req.body ?? {};

  if (typeof userId !== "string" || !userId.trim()) {
    return res.status(422).json({ error: "userId requerido (string)" });
  }
  if (typeof amount !== "number" || !(amount >= 0)) {
    return res.status(422).json({ error: "amount debe ser número >= 0" });
  }
  if (status && !ALLOWED.has(status)) {
    return res.status(422).json({ error: `status inválido (válidos: ${[...ALLOWED].join(", ")})` });
  }

  const id = newId();
  const order = {
    id,
    userId,
    amount,
    status: status ?? "created",
    items: Array.isArray(items) ? items : undefined,
    createdAt: nowISO(),
    version: 1, // ← iniciamos versión
  };
  ORDERS.set(id, order);

  return res.status(201).location(`/orders/${id}`).json(order);
}

/**
 * GET /orders
 * Lista todas las órdenes con ETag de colección.
 * Si If-None-Match coincide → 304 (nada cambió en la colección).
 */
export async function getAllOrders(req, res) {
  const colTag = etagOfCollection();
  if (req.headers["if-none-match"] === colTag) {
    return res.status(304).end();
  }
  res.set("ETag", colTag);
  const orders = [...ORDERS.values()];
  return res.json(orders);
}

/**
 * GET /orders/:id
 * 200/404 — con ETag de recurso y 304 si coincide If-None-Match.
 */
export async function getOrderById(req, res) {
  const order = ORDERS.get(req.params.id);
  if (!order) return res.status(404).json({ error: "Not Found" });

  const tag = etagOf(order);
  if (req.headers["if-none-match"] === tag) {
    return res.status(304).end();
  }
  return res.set("ETag", tag).json(order);
}

/**
 * PATCH /orders/:id
 * body: { status?, amount?, userId? }
 * Reglas:
 *  - no permitir cambiar una orden 'paid' a otro estado
 *  - no permitir reabrir una 'canceled'
 * Concurrencia optimista opcional: respeta If-Match si viene.
 */
export async function updateOrderStatus(req, res) {
  const id = req.params.id;
  const order = ORDERS.get(id);
  if (!order) return res.status(404).json({ error: "Not Found" });

  // Si cliente envía If-Match y no coincide, devolvemos 412
  const currentTag = etagOf(order);
  const ifMatch = req.headers["if-match"];
  if (ifMatch && ifMatch !== currentTag) {
    return res.status(412).json({ error: "Precondition Failed (ETag mismatch)" });
  }

  const { status, amount, userId } = req.body ?? {};

  if (status !== undefined) {
    if (!ALLOWED.has(status)) {
      return res.status(422).json({ error: `status inválido (${[...ALLOWED].join(", ")})` });
    }
    if (order.status === "paid" && status !== "paid") {
      return res.status(409).json({ error: "no se puede modificar una orden pagada" });
    }
    if (order.status === "canceled" && status !== "canceled") {
      return res.status(409).json({ error: "no se puede reabrir una orden cancelada" });
    }
    order.status = status;
  }

  if (amount !== undefined) {
    if (typeof amount !== "number" || !(amount >= 0)) {
      return res.status(422).json({ error: "amount debe ser número >= 0" });
    }
    order.amount = amount;
  }

  if (userId !== undefined) {
    if (typeof userId !== "string" || !userId.trim()) {
      return res.status(422).json({ error: "userId debe ser string" });
    }
    order.userId = userId;
  }

  order.updatedAt = nowISO();
  order.version = (order.version ?? 1) + 1; // ← incrementa versión al cambiar
  ORDERS.set(id, order);

  // Nuevo ETag del recurso modificado
  res.set("ETag", etagOf(order));
  // También cambia el ETag de colección automáticamente (se recalcula al leer)
  return res.json(order);
}

/**
 * POST /orders/:id/cancel
 * Idempotente: si ya está cancelada → 200 con el recurso.
 * Si está pagada → 409.
 * Incrementa versión si cancela por primera vez.
 */
export async function deleteOrder(req, res) {
  // Log para ver qué id llega y qué ids hay
  console.log('DELETE /orders/:id =>', JSON.stringify(req.params.id));
  console.log('ORDERS keys =>', [...ORDERS.keys()]);

  // Normaliza por si llega con espacios o codificación rara
  const id = decodeURIComponent(String(req.params.id || '')).trim();

  if (!ORDERS.has(id)) return res.status(404).json({ error: "Not Found" });
  ORDERS.delete(id);
  return res.status(204).end();
}


// Importa en routes.js así:
//   import * as ctrl from './controller.js'
