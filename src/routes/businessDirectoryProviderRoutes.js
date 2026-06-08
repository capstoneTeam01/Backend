import express from "express";
import { bdHealth, bdSync } from "../handlers/businessDirectoryProviderHandler.js";


const businessDirectoryProviderRoutes = () => {
    console.log("working")
    const router = express.Router();

    router.get("/health", bdHealth);
    router.get("/sync", bdSync);

    return router;
}

export default businessDirectoryProviderRoutes;