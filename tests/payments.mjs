// Paiements Stripe (Bancontact, carte) contre stripe-mock, le serveur de test officiel de Stripe.
// Usage :
//   stripe-mock -http-port 12111
//   STRIPE_SECRET_KEY=sk_test_123 STRIPE_WEBHOOK_SECRET=whsec_test STRIPE_API_BASE=http://localhost:12111 \
//     AUTH_DEV_CODES=1 ADMIN_DEV_CODES=1 npx next start
//   DATABASE_URL=… node tests/payments.mjs
// La page Stripe elle-même n'est pas joignable ici : le test simule son résultat avec des webhooks signés.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const Stripe = require('stripe');
const postgres = require('postgres');

const BASE = process.env.BASE ?? 'http://localhost:3000';
const SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_test';
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const stripe = new Stripe('sk_test_123');
const ok = (cond, msg) => {
  if (!cond) throw new Error('ÉCHEC : ' + msg);
  console.log('✓', msg);
};

/** Envoie un évènement Stripe signé au webhook de l'app, comme le ferait Stripe */
async function webhook(type, object, secret = SECRET) {
  const payload = JSON.stringify({ id: `evt_${Date.now()}`, object: 'event', type, data: { object }, api_version: '2026-10-28.endive', created: Math.floor(Date.now() / 1000) });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return fetch(`${BASE}/api/stripe/webhook`, { method: 'POST', body: payload, headers: { 'Content-Type': 'application/json', 'stripe-signature': header } });
}

// Un jour de semaine à venir (la démo n'ouvre pas le week-end), pour pouvoir annuler plus de 2 h avant
let day = new Date(Date.now() + 86_400_000);
while ([0, 6].includes(day.getUTCDay())) day = new Date(day.getTime() + 86_400_000);
const DAY = day.toISOString().slice(0, 10);

async function book(page) {
  await page.goto(`${BASE}/lieu/kartohm?date=${DAY}`);
  await page.locator('.slot:not(.full)').first().click();
  await page.click('.sticky-cta a:has-text("Réserver")');
  await page.waitForURL(/\/reserver/);
  ok(await page.locator('.pay-badge:has-text("Bancontact")').isVisible(), 'Récapitulatif : Bancontact et carte proposés');
  const stripeUrl = page.waitForRequest((r) => /checkout\.stripe\.com|stripe\.com/.test(r.url()));
  await page.click('button:has-text("Payer")');
  const req = await stripeUrl;
  const [b] = await sql`select * from bookings where user_id = (select id from users where email = ${email}) order by created_at desc limit 1`;
  return { b, url: req.url() };
}

const email = `paiement.${Date.now().toString(36)}@test.be`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route(/stripe\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Page de paiement Stripe (simulée)</h1>' }));
  // Inscription client
  await page.goto(`${BASE}/inscription?type=client`);
  await page.fill('input[name=firstName]', 'Lina');
  await page.fill('input[name=email]', email);
  await page.click('button:has-text("Recevoir mon code")');
  await page.fill('input[name=code]', (await page.locator('[data-testid=dev-code] b').textContent()).trim());
  await page.click('button:has-text("Créer mon compte")');
  await page.waitForURL((u) => !u.pathname.startsWith('/inscription'));

  // 1. Réserver ouvre la page de paiement Stripe, les places sont tenues
  const { b, url } = await book(page);
  ok(/stripe\.com/.test(url), 'Payer envoie vers la page de paiement Stripe');
  ok(b.status === 'pending' && b.stripe_session_id && b.expires_at > new Date(), 'Réservation en attente avec places tenues pendant le paiement');
  await page.goto(`${BASE}/billets/${b.id}`);
  ok(await page.locator('text=Paiement en cours de validation').isVisible(), 'Avant paiement : pas de billet utilisable');

  // 2. Signature invalide refusée
  ok((await webhook('checkout.session.completed', { id: b.stripe_session_id }, 'whsec_faux')).status === 400, 'Webhook à la signature invalide refusé');

  // 3. Paiement réussi (Stripe → webhook) : confirmée, une seule fois
  const session = { id: b.stripe_session_id, object: 'checkout.session', status: 'complete', payment_status: 'paid', amount_total: b.total_cents, client_reference_id: b.id, metadata: { booking_id: b.id }, payment_intent: 'pi_test_aubaine' };
  ok((await webhook('checkout.session.completed', session)).ok, 'Webhook « paiement réussi » accepté');
  ok((await webhook('checkout.session.completed', session)).ok, 'Webhook reçu deux fois : sans effet la seconde fois');
  const [paid] = await sql`select * from bookings where id = ${b.id}`;
  ok(paid.status === 'confirmed' && paid.paid_at && paid.stripe_payment_intent, `Réservation confirmée (moyen : ${paid.payment_method}, commission ${paid.fee_cents} c)`);
  ok(paid.fee_cents === Math.round(b.total_cents * 0.15), 'Commission de 15 % figée sur la réservation');
  await page.goto(`${BASE}/billets/${b.id}`);
  ok(await page.locator('[data-testid=ticket-code]').isVisible(), 'Après paiement : billet avec son code');
  ok(await page.locator('text=Payé par').isVisible(), 'Le billet indique le moyen de paiement');

  // 4. Annulation : remboursement Stripe et email
  await page.click('button:has-text("Annuler la réservation")');
  await page.waitForSelector('text=remboursée');
  const [cancel] = await sql`select * from bookings where id = ${b.id}`;
  ok(cancel.status === 'cancelled' && cancel.refunded_at, 'Annulation : réservation remboursée');

  // 5. Retour « annuler » depuis Stripe : places libérées tout de suite
  const second = await book(page);
  await page.goto(`${BASE}/reserver/retour?annule=${second.b.id}`);
  await page.waitForURL(/paiement=annule/);
  ok(await page.locator('text=Paiement annulé').isVisible(), 'Retour sans payer : message clair, rien de débité');
  const [released] = await sql`select status from bookings where id = ${second.b.id}`;
  ok(released.status === 'cancelled', 'Paiement abandonné : places libérées');

  // 6. Session expirée (client parti) : places libérées par le webhook
  const third = await book(page);
  ok((await webhook('checkout.session.expired', { id: third.b.stripe_session_id, object: 'checkout.session', status: 'expired', payment_status: 'unpaid', client_reference_id: third.b.id, metadata: { booking_id: third.b.id } })).ok, 'Webhook « session expirée » accepté');
  const [expired] = await sql`select status from bookings where id = ${third.b.id}`;
  ok(expired.status === 'cancelled', 'Session expirée : places libérées');
  console.log('\nPaiements : tout est bon.');
} finally {
  await browser.close();
  await sql.end();
}
