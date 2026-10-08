import { requireRole } from "@/lib/auth";
import { CSV_COLUMNS } from "@/lib/csv";
import { ImportTool } from "./ImportTool";

export const metadata = { title: "Import / Export" };

export default async function ImportPage() {
  await requireRole("admin");
  return (
    <>
      <ImportTool />
      <div className="panel">
        <h3>Export inventory</h3>
        <p className="muted" style={{ margin: "0 0 14px", fontSize: 15 }}>Download your products as a spreadsheet. Edit it in Excel or Google Sheets and import it back to make mass changes.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a className="btn" href="/admin/export">Export all products</a>
          <a className="btn" href="/admin/export?type=bulk">Export bulk only</a>
          <a className="btn" href="/admin/export?type=template">Blank template</a>
        </div>
        <p className="muted mono" style={{ fontSize: 12.5, margin: "14px 0 0", overflowWrap: "anywhere" }}>Columns: {CSV_COLUMNS.join(", ")}</p>
      </div>
    </>
  );
}
