import { Router, type IRouter } from "express";
import healthRouter from "./health";
import neuralLinkRouter from "./neural-link";

const router: IRouter = Router();

router.use(healthRouter);
router.use(neuralLinkRouter);

export default router;
