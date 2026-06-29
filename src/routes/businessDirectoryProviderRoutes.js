import express from "express";
import { bdHealth, bdSync, sendQuoteRequest } from "../handlers/businessDirectoryProviderHandler.js";
import { AuthMiddleware } from "../middlewares/authMiddleware.js";


const businessDirectoryProviderRoutes = (services = {}) => {
    console.log("[FixBee][ProviderRoute] business directory provider routes ready")
    const router = express.Router();

    router.get("/health", bdHealth);
    router.get("/sync", AuthMiddleware(services), bdSync);
    router.post("/quote-requests/send", AuthMiddleware(services), sendQuoteRequest);

    return router;
}

export default businessDirectoryProviderRoutes;
