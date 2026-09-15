import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface InventoryItem {
  sku: string;
  description: string;
  category: string;
  totalStock: number;
  reservedQty: number;
  availableQty: number;
  unit: string;
  unitPrice: number;
  currency: string;
  reorderThreshold: number;
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  warehouseZone: string;
  lastUpdated: string;
}

const INVENTORY: InventoryItem[] = [
  {
    sku: "MED-TS-CASE",
    description: "Temperature-Sensitive Medical Supplies",
    category: "Cold-Chain & Pharma",
    totalStock: 1450,
    reservedQty: 320,
    availableQty: 1130,
    unit: "cases",
    unitPrice: 1850,
    currency: "INR",
    reorderThreshold: 300,
    status: "IN_STOCK",
    warehouseZone: "Zone A (Cold Storage - 4°C)",
    lastUpdated: "Today at 09:30 AM",
  },
  {
    sku: "GLV-NIT-BOX",
    description: "Sterile Nitrile Surgical Gloves (Box of 100)",
    category: "PPE & Consumables",
    totalStock: 850,
    reservedQty: 150,
    availableQty: 700,
    unit: "boxes",
    unitPrice: 420,
    currency: "INR",
    reorderThreshold: 200,
    status: "IN_STOCK",
    warehouseZone: "Zone B (Rack B-12)",
    lastUpdated: "Today at 08:45 AM",
  },
  {
    sku: "SAN-CON-LIT",
    description: "Industrial Sanitizer Concentrate (5L Container)",
    category: "Cleaning & Disinfectants",
    totalStock: 180,
    reservedQty: 120,
    availableQty: 60,
    unit: "containers",
    unitPrice: 950,
    currency: "INR",
    reorderThreshold: 200,
    status: "LOW_STOCK",
    warehouseZone: "Zone C (Chemical Bay)",
    lastUpdated: "Yesterday at 05:20 PM",
  },
  {
    sku: "MSK-N95-PACK",
    description: "N95 Respirator Masks (Pack of 50)",
    category: "PPE & Consumables",
    totalStock: 2200,
    reservedQty: 400,
    availableQty: 1800,
    unit: "packs",
    unitPrice: 650,
    currency: "INR",
    reorderThreshold: 500,
    status: "IN_STOCK",
    warehouseZone: "Zone B (Rack B-08)",
    lastUpdated: "Today at 07:10 AM",
  },
  {
    sku: "SYR-DIS-BOX",
    description: "Disposable Syringes 5ml (Box of 100)",
    category: "Surgical Instruments",
    totalStock: 45,
    reservedQty: 40,
    availableQty: 5,
    unit: "boxes",
    unitPrice: 380,
    currency: "INR",
    reorderThreshold: 100,
    status: "LOW_STOCK",
    warehouseZone: "Zone A (Sterile Rack)",
    lastUpdated: "Today at 10:00 AM",
  },
  {
    sku: "OXY-CYL-LIT",
    description: "Portable Oxygen Cylinders 10L",
    category: "Emergency Care",
    totalStock: 310,
    reservedQty: 80,
    availableQty: 230,
    unit: "cylinders",
    unitPrice: 4500,
    currency: "INR",
    reorderThreshold: 50,
    status: "IN_STOCK",
    warehouseZone: "Zone D (Pressurised Gas Bay)",
    lastUpdated: "Today at 09:15 AM",
  },
];

import { getSupabaseClient, hasSupabaseConfig } from "@/lib/db/supabase-client";

/** GET /api/v1/inventory — List current stock of the wholesaler */
export async function GET() {
  let itemsList = INVENTORY;
  if (hasSupabaseConfig()) {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.from("inventory").select("*");
        if (!error && data && data.length > 0) {
          itemsList = data.map((row: any) => ({
            sku: row.sku,
            description: row.description,
            category: row.category,
            totalStock: row.total_stock,
            reservedQty: row.reserved_qty,
            availableQty: row.available_qty,
            unit: row.unit,
            unitPrice: Number(row.unit_price),
            currency: row.currency || "INR",
            reorderThreshold: row.reorder_threshold,
            status: row.status,
            warehouseZone: row.warehouse_zone,
            lastUpdated: row.last_updated || "Recently",
          }));
        }
      } catch (err) {
        console.warn("Supabase inventory fetch error:", err);
      }
    }
  }

  const totalItemsCount = itemsList.reduce((sum, item) => sum + item.totalStock, 0);
  const totalValueINR = itemsList.reduce((sum, item) => sum + item.totalStock * item.unitPrice, 0);
  const lowStockCount = itemsList.filter((item) => item.status === "LOW_STOCK").length;

  return NextResponse.json({
    items: itemsList,
    summary: {
      totalSkus: itemsList.length,
      totalUnits: totalItemsCount,
      totalValueINR,
      lowStockAlerts: lowStockCount,
    },
  });
}

/** POST /api/v1/inventory — Update stock quantity for a given SKU */
export async function POST(req: Request) {
  try {
    const { sku, delta, newStock } = await req.json();
    const item = INVENTORY.find((i) => i.sku === sku);

    let updatedStock = 0;
    if (item) {
      if (typeof newStock === "number") {
        item.totalStock = Math.max(0, newStock);
      } else if (typeof delta === "number") {
        item.totalStock = Math.max(0, item.totalStock + delta);
      }
      item.availableQty = Math.max(0, item.totalStock - item.reservedQty);
      item.status = item.availableQty <= item.reorderThreshold ? "LOW_STOCK" : "IN_STOCK";
      item.lastUpdated = "Just now";
      updatedStock = item.totalStock;
    }

    if (hasSupabaseConfig()) {
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          const { data: dbItem } = await supabase.from("inventory").select("*").eq("sku", sku).single();
          if (dbItem) {
            const currentTotal = typeof newStock === "number" ? newStock : dbItem.total_stock + (delta || 0);
            const totalStock = Math.max(0, currentTotal);
            const availableQty = Math.max(0, totalStock - dbItem.reserved_qty);
            const status = availableQty <= dbItem.reorder_threshold ? "LOW_STOCK" : "IN_STOCK";

            await supabase
              .from("inventory")
              .update({
                total_stock: totalStock,
                available_qty: availableQty,
                status,
                last_updated: "Just now",
              })
              .eq("sku", sku);
          }
        } catch (err) {
          console.warn("Supabase inventory update error:", err);
        }
      }
    }

    return NextResponse.json({ success: true, item: item || { sku, totalStock: updatedStock } });
  } catch (err: unknown) {
    return NextResponse.json({ error: "Could not update stock" }, { status: 500 });
  }
}
