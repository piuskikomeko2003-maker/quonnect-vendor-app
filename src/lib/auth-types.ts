export interface SignupInput {
  ownerName: string;
  phone: string;
  email: string;
  password: string;
  businessName: string;
  category: string;
  location: string;
  motto: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  whatsapp: string;
  logoDataUrl: string | null;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  needsConfirmation?: boolean;
}
