import express from "express";
import { bdHealth, bdSync, bdDebug } from "../handlers/businessDirectoryProviderHandler.js";


const businessDirectoryProviderRoutes = () => {
    console.log("working")
    const router = express.Router();

    router.get("/health", bdHealth);
    router.get("/sync", bdSync);
    router.get("/debug", bdDebug);

    return router;
}

export default businessDirectoryProviderRoutes;