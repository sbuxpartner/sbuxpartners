import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import serverless from "serverless-http";
import { registerRoutes } from "../../server/routes";
import { log } from "../../server/static";

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

function logAzureConfiguration() {
  const endpoint = process.env.AZURE_CV_ENDPOINT;
  const apiKey = process.env.AZURE_CV_KEY;

  if (endpoint && apiKey) {
    try {
      const hostname = new URL(endpoint).hostname;
      log(`Azure Computer Vision configured for ${hostname}`);
    } catch (error) {
      log(`Azure Computer Vision configured but endpoint is not a valid URL: ${endpoint}`);
    }
  } else {
    log('Azure Computer Vision credentials missing. Set AZURE_CV_ENDPOINT and AZURE_CV_KEY.');
  }
}

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
    if (capturedJsonResponse) {
      logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
    }

    if (logLine.length > 80) {
      logLine = logLine.slice(0, 79) + "…";
    }

    log(logLine);
  });

  next();
});

// Initialize routes
let routesInitialized = false;

async function initializeRoutes() {
  if (!routesInitialized) {
    await registerRoutes(app);
    
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      
      console.error('Error:', err);
      res.status(status).json({ message });
    });
    
    routesInitialized = true;
  }
}

// Initialize routes on cold start
initializeRoutes();
logAzureConfiguration();

// Export the serverless handler
export const handler = serverless(app);

