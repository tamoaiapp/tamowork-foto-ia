/**
 * Stripe legado — verifica assinaturas ativas em múltiplas contas do app antigo
 */

// Conta 1: TamoWork (sk_live_...RBpI)
const LEGACY_PRODUCTS_ACCOUNT_1 = new Set([
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

// Conta 2: TamoWork Dollar
const LEGACY_PRODUCTS_ACCOUNT_2 = new Set([
  "prod_U3bhUjnn3V7W0s",
  "prod_TxywwsZ1RSeMfv",
]);

export interface LegacySubscription {
  subscriptionId: string;
  periodEnd: Date;
  customerId: string;
}

async function getActiveSubscription(
  email: string,
  apiKey: string,
  productIds: Set<string>
): Promise<LegacySubscription | null> {
  try {
    const searchRes = await fetch(
      `https://api.stripe.com/v1/customers/search?query=email:'${encodeURIComponent(email)}'&limit=5`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    const searchData = await searchRes.json();
    const customers: { id: string }[] = searchData.data ?? [];

    for (const customer of customers) {
      const subRes = await fetch(
        `https://api.stripe.com/v1/subscriptions?customer=${customer.id}&status=active&limit=10`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      );
      const subData = await subRes.json();
      const subs: {
        id: string;
        current_period_end: number;
        items: { data: { price: { product: string } }[] };
      }[] = subData.data ?? [];

      for (const sub of subs) {
        for (const item of sub.items.data) {
          if (productIds.has(item.price.product)) {
            return {
              subscriptionId: sub.id,
              periodEnd: new Date(sub.current_period_end * 1000),
              customerId: customer.id,
            };
          }
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function checkLegacyStripeSubscription(
  email: string
): Promise<LegacySubscription | null> {
  const key1 = process.env.STRIPE_LEGACY_SECRET_KEY;
  const key2 = process.env.STRIPE_LEGACY_SECRET_KEY_2;

  const [result1, result2] = await Promise.all([
    key1 ? getActiveSubscription(email, key1, LEGACY_PRODUCTS_ACCOUNT_1) : Promise.resolve(null),
    key2 ? getActiveSubscription(email, key2, LEGACY_PRODUCTS_ACCOUNT_2) : Promise.resolve(null),
  ]);

  return result1 ?? result2 ?? null;
}
