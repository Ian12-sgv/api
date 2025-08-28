import express from "express";
import ordersRouter from "./order/routes.js"; // único módulo de orders

const app = express();
app.use(express.json());
app.use("/orders", ordersRouter);
const PORT = process.env.PORT || 3000;

app.use((req, res) => res.status(404).json({ error: "Not Found" }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
}); //manejo de errores con la conexion 

app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});
