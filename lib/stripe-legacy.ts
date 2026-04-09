/**
 * Stripe legado (conta TamoWork app antigo)
 * Usado apenas para verificar se um email tem assinatura ativa do produto prod_TuJkKNyyvhIzTT
 */

const LEGACY_PRODUCT_IDS = new Set([
  "prod_TFRnT2OZsgZeOo",
  "prod_TFRoCpiSQsiFCx",
  "prod_TFh2aa3gPhsIKQ",
  "prod_TFivRpr3KACBZT",
  "prod_TFtP6GdvWUwxPM",
  "prod_TFuBv9wQQDmSJV",
  "prod_TFuCrFVQ0V6noa",
  "prod_TR4YK3tmumlncc",
  "prod_TRSACw3CiM63gs",
  "prod_TXJYc3UOMyOEiU",
  "prod_TaK0mhppcWAOsF",
  "prod_TcwHQRN07JJSwO",
  "prod_TuJkKNyyvhIzTT",
]);

export async function checkLegacyStripeSubscription(email: string): Promise<boolean> {
  const key = process.env.STRIPE_LEGACY_SECRET_KEY;
  if (!key) return false;

  try {
    // Busca cliente pelo email
    const searchRes = await fetch(
      `https://api.stripe.com/v1/customers/search?query=email:'${encodeURIComponent(email)}'&limit=5`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
    const searchData = await searchRes.json();
    const customers: { id: string }[] = searchData.data ?? [];
    if (customers.length === 0) return false;

    // Verifica assinaturas ativas de qualquer cliente com esse email
    for (const customer of customers) {
      const subRes = await fetch(
        `https://api.stripe.com/v1/subscriptions?customer=${customer.id}&status=active&limit=10`,
        { headers: { Authorization: `Bearer ${key}` } }
      );
      const subData = await subRes.json();
      const subs: { items: { data: { price: { product: string } }[] } }[] = subData.data ?? [];

      for (const sub of subs) {
        for (const item of sub.items.data) {
          if (LEGACY_PRODUCT_IDS.has(item.price.product)) return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}
