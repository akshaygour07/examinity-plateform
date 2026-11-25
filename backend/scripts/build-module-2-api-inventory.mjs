import { readFile, mkdir } from "node:fs/promises";
import ExcelJS from "exceljs";

const collection = JSON.parse(await readFile("postman/Examinity-Admin-QA.postman_collection.json", "utf8"));
const module2 = collection.item.find((item) => item.name === "14 - Module 2: Taxonomy, Examination Master & Cycles");
const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet("Module 2 APIs");
sheet.columns = [{ header: "Folder", key: "folder", width: 32 }, { header: "API name", key: "name", width: 38 }, { header: "Method", key: "method", width: 12 }, { header: "Endpoint", key: "endpoint", width: 76 }];
sheet.getRow(1).font = { bold: true };
for (const folder of module2.item) for (const item of folder.item) sheet.addRow({ folder: folder.name, name: item.name, method: item.request.method, endpoint: item.request.url });
sheet.autoFilter = "A1:D1";
await mkdir("docs", { recursive: true });
await workbook.xlsx.writeFile("docs/Examinity-M2-API-Inventory.xlsx");
console.log("Wrote docs/Examinity-M2-API-Inventory.xlsx");
