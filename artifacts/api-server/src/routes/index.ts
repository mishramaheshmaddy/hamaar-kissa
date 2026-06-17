import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import statsRouter from "./stats";
import categoriesRouter from "./categories";
import audioStoriesRouter from "./audioStories";
import videosRouter from "./videos";
import mediaRouter from "./media";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(statsRouter);
router.use(categoriesRouter);
router.use(audioStoriesRouter);
router.use(videosRouter);
router.use(mediaRouter);
router.use(storageRouter);

export default router;
