import "dotenv/config";
import { app } from "./app.js";

const port = Number(process.env.PORT || 8585);

app.listen(port, () => {
  console.log(`Spedicija API slusa na http://localhost:${port}`);
});
