// src/orders/routes.js
import { Router } from "express";
import * as ctrl from "./controller.js";

const router = Router();

router.post("/", ctrl.createOrder);
router.get("/", ctrl.getAllOrders);
router.patch("/:id", ctrl.updateOrderStatus);
router.post("/:id/cancel", ctrl.cancelOrder);

export default router;
