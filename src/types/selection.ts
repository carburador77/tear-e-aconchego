export type SelectionItem = {
  productId: string;
  variantId: string | null;
  quantity: number;
};

export type SelectionWhatsAppItem = {
  productName: string;
  variantName?: string | null;
  quantity: number;
};
