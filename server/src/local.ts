/** Local dev entrypoint: `npm run dev` → http://localhost:5000 */
import app from "./index.js";

const port = Number(process.env.PORT ?? 5000);
app.listen(port, () => {
  console.log(`[studygen-api] listening on http://localhost:${port}`);
});
