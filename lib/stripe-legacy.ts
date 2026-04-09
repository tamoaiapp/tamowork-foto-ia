/**
 * Stripe legado (conta TamoWork app antigo)
 * Usado apenas para verificar se um email tem assinatura ativa do produto prod_TuJkKNyyvhIzTT
 */

const LEGACY_PRODUCT_ID = "prod_TuJkKNyyvhIzTT";

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
          if (item.price.product === LEGACY_PRODUCT_ID) return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}
