import express from "express";
import { eventController } from "./event.controller";
import auth from "../../middlewares/auth";

const router = express.Router();

router.post("/", auth(), eventController.createEvent);

router.get("/", eventController.getAllEvents);

router.get("/featured", eventController.getFeaturedEvents);

router.get("/:id", eventController.getEventById);


router.patch("/:id/featured", eventController.toggleFeatured);

router.delete("/:id", eventController.deleteEvent);

export const eventRoutes = router;