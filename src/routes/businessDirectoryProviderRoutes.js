import express from "express";

const businessDirectoryProviderRoutes = () => {
    const router = express.Router();

      router.get("/health", );
      router.get("/sync", );
      router.get("/debug", );

      return router;
}

export default businessDirectoryProviderRoutes;