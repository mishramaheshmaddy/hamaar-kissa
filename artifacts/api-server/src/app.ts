import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import pinoHttp from "pino-http";
import router from "./routes";
import shareRouter from "./routes/share";
import wellKnownRouter from "./routes/wellKnown";
import { logger } from "./lib/logger";

const app: Express = express();

// Render sits in front of this app as a reverse proxy — without this,
// req.ip resolves to Render's internal proxy address instead of the real
// client IP, which breaks IP-based geolocation (see lib/geo.ts) and would
// also break any future rate-limiting keyed on IP.
app.set("trust proxy", true);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env["SESSION_SECRET"] || "hamaar-kissa-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

// Public share landing pages — must be at root (no /api prefix), since these
// URLs are shared externally (WhatsApp, etc.) as e.g. https://<domain>/share/audio/5
app.use(shareRouter);

// Android App Links verification file — must be served at exactly this root path
app.use(wellKnownRouter);

app.use("/api", router);

export default app;
