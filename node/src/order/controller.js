// Controlador de /orders (en memoria) — ESM
// Asegúrate de tener "type": "module" en package.json

const ORDERS = new Map(); // id -> order

const nowISO = () => new Date().toISOString();
const newId = () =>
  "o_" +
  (globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2, 10));

const ALLOWED = new Set(["created", "paid", "canceled"]);

/**
 * POST /orders
 * body: { userId: string, amount: number, status?: "created"|"paid"|"canceled", items?: any[] }
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
    return res
      .status(422)
      .json({ error: `status inválido (válidos: ${[...ALLOWED].join(", ")})` });
  }

  const id = newId();
  const order = {
    id,
    userId,
    amount,
    status: status ?? "created",
    items: Array.isArray(items) ? items : undefined,
    createdAt: nowISO(),
  };
  ORDERS.set(id, order);

  return res.status(201).location(`/orders/${id}`).json(order);
}

/**
 * GET /orders/:id
 */
export async function getAllOrders(req, res) {
  const orders = [...ORDERS.values()];
  return res.json(orders);
}

/**
 * PATCH /orders/:id
 * body: puede incluir { status, amount, userId }
 * Reglas:
 *  - no permitir cambiar una orden 'paid' a otro estado
 *  - no permitir reabrir una 'canceled'
 */
export async function updateOrderStatus(req, res) {
  const id = req.params.id;
  const order = ORDERS.get(id);
  if (!order) return res.status(404).json({ error: "Not Found" });

  const { status, amount, userId } = req.body ?? {};

  if (status !== undefined) {
    if (!ALLOWED.has(status)) {
      return res
        .status(422)
        .json({ error: `status inválido (${[...ALLOWED].join(", ")})` });
    }
    if (order.status === "paid" && status !== "paid") {
      return res
        .status(409)
        .json({ error: "no se puede modificar una orden pagada" });
    }
    if (order.status === "canceled" && status !== "canceled") {
      return res
        .status(409)
        .json({ error: "no se puede reabrir una orden cancelada" });
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
  ORDERS.set(id, order);
  return res.json(order);
}

/**
 * POST /orders/:id/cancel
 * Idempotente: si ya está cancelada, devuelve 200 con el recurso
 * Si está pagada → 409
 */
export async function cancelOrder(req, res) {
  const id = req.params.id;
  const order = ORDERS.get(id);
  if (!order) return res.status(404).json({ error: "Not Found" });
  if (order.status === "paid") {
    return res
      .status(409)
      .json({ error: "no se puede cancelar una orden pagada" });
  }
  if (order.status !== "canceled") {
    order.status = "canceled";
    order.canceledAt = nowISO();
    ORDERS.set(id, order);
  }
  return res.json(order);
}

// (opcional) export default si prefieres importar como objeto
export default { createOrder, getOrderById, updateOrderStatus, cancelOrder };
