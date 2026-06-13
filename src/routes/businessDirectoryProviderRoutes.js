import express from "express";
import { bdHealth, bdSync } from "../handlers/businessDirectoryProviderHandler.js";
import { AuthMiddleware } from "../middlewares/authMiddleware.js";


const businessDirectoryProviderRoutes = (services = {}) => {
    console.log("working")
    const router = express.Router();

    router.get("/health", bdHealth);
    router.get("/sync", AuthMiddleware(services), bdSync);

    return router;
}

export default businessDirectoryProviderRoutes;