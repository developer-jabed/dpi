import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Application, NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import globalErrorHandler from './app/middlewares/globalErrorHandler';
import router from './app/routes';
import pg from 'pg';

const app: Application = express();

app.use(cookieParser());
app.use(cors({
    origin: ['http://localhost:3000', 'https://cst-inky.vercel.app'],
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


app.use((req: Request, res: Response, next: NextFunction) => {
    res.setTimeout(600000);
    req.setTimeout(600000);
    next();
});

// Replace your current diagnostic in app.ts with this
const originalQuery = pg.Client.prototype.query;
(pg.Client.prototype as any).query = function (...args: any[]) {
  if ((this as any)._queryable === false || (this as any)._ending) {
    console.error('=== PG DOUBLE QUERY STACK ===');
    console.trace();
  }
  return (originalQuery as any).apply(this, args);
};

(process as NodeJS.EventEmitter).on('warning', (warning: Error) => {
  if (warning.message?.includes('client.query')) {
    console.error('=== WARNING STACK ===');
    console.trace(warning);
  }
});

app.get('/', (req: Request, res: Response) => {
    res.send({
        Message: "Dinajpur Polytechnic server...."
    })
});

app.use('/api/v1', router);

app.use(globalErrorHandler);

app.use((req: Request, res: Response, next: NextFunction) => {
    res.status(httpStatus.NOT_FOUND).json({
        success: false,
        message: "API NOT FOUND!",
        error: {
            path: req.originalUrl,
            message: "Your requested path is not found!"
        }
    })
});

export default app;