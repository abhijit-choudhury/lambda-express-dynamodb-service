import express, { Express, Request, Response } from "express";
import serverless from "serverless-http";
import basketRouter from "./routes/basket";
import cookieParser from "cookie-parser";

const app: Express = express();

app.use(express.json());
app.use(cookieParser());

app.get("/test", async function (req: Request, res: Response) {
  console.log("hello world");
  res.status(200).json({ hello: "world" });
});

app.use('/basket', basketRouter);

app.use((req: Request, res: Response) => {
  return res.status(404).json({
    error: "Not Found",
  });
});


module.exports.handler = serverless(app);
