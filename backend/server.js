require("dotenv").config();
const app = require("./src/app");
const port = process.env.PORT || 8000;
const assetsRoutes = require("./src/routes/assets.routes");
app.use("/api/assets", assetsRoutes);
app.listen(port, () => {
  console.log(`[SERVER] Mulai...`);
  console.log(`[SERVER] Berjalan di http://localhost:${port}`);
  console.log(`[SERVER] Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`[SERVER] Version: ${require("./package.json").version}`);
  console.log(`[SERVER] Terhubung ke PostgreSQL`);
});
