export const WHOLESALE_COORDINATION_RESULT_SCHEMA = {
  type: "object",
  required: ["contact_reached", "stock_status", "next_action"],
  properties: {
    contact_reached: { type: "string", enum: ["yes", "no", "wrong_person", "voicemail", "unknown"] },
    stock_status: { type: "string", enum: ["confirmed", "partial", "unavailable", "unknown"] },
    confirmed_quantity: { type: "number" },
    remaining_quantity: { type: "number" },
    unit_price: { type: "number" },
    currency: { type: "string" },
    dispatch_date: { type: "string" },
    delivery_eta: { type: "string" },
    delay_reason: { type: "string" },
    callback_requested_at: { type: "string" },
    requires_approval: { type: "boolean" },
    verbatim_commitment: { type: "string" },
    next_action: {
      type: "string",
      enum: [
        "CONFIRM_ORDER",
        "PARTIAL_CONFIRMATION",
        "REQUEST_APPROVAL",
        "SCHEDULE_CALLBACK",
        "ESCALATE_NEXT_CONTACT",
        "HUMAN_REVIEW",
      ],
    },
  },
} as const;

export interface WholesaleCallContext {
  contactName: string;
  phoneE164: string;
  companyName: string;
  orderReference: string;
  product: string;
  requestedQuantity: number;
  requiredBy: string;
}

export function buildWholesaleTaskPrompt(context: WholesaleCallContext): string {
  return `
Call ${context.contactName} at ${context.phoneE164}, our customer/vendor contact for ${context.companyName}.
You are the automated operations line calling on behalf of Northgate Wholesale Distributors.

OBJECTIVE
Check in with ${context.contactName} regarding their inventory stock and supply requirements.
Inquire about what stock or items they are currently lacking or running low on at their end, and determine what quantities they need supplied by us.

ASK
1. "Hello ${context.contactName}, this is the automated operations line from Northgate Wholesale. Are you currently in need of any stock or inventory replenishment?"
2. "What items or stock are you running low on or lacking at your shop/store right now?"
3. "What quantities do you need us to supply to you for ${context.product} (or other items), and by when do you need delivery?"
4. "Can I confirm the required quantity and preferred delivery timeframe with you?"

RULES
- Identify yourself clearly as an automated operations line calling from Northgate Wholesale.
- Listen carefully to what items and quantities the customer says they need supplied.
- Capture the specific quantities and items they state are lacking on their end.
- If the contact asks for a callback, note their preferred callback time.
- Keep the conversation concise, professional, and friendly.
`.trim();
}