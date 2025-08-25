// src/order/routes.js
import { Router } from "express";
import * as ctrl from "./controller.js";

const router = Router();

router.post("/", ctrl.createOrder);
router.get("/", ctrl.getAllOrders);
router.get("/:id", ctrl.getOrderById);        // ← añade esta línea
router.patch("/:id", ctrl.updateOrderStatus);
router.delete("/:id", ctrl.deleteOrder);

export default router;
