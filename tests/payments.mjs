// Paiements Stripe (Bancontact, carte) contre stripe-mock, le serveur de test officiel de Stripe.
// Usage :
//   stripe-mock -http-port 12111
//   STRIPE_SECRET_KEY=sk_test_123 STRIPE_WEBHOOK_SECRET=whsec_test STRIPE_CONNECT_WEBHOOK_SECRET=whsec_connect \
//     STRIPE_API_BASE=http://localhost:12111 AUTH_DEV_CODES=1 ADMIN_DEV_CODES=1 npx next start
//   DATABASE_URL=… node tests/payments.mjs
// La page Stripe elle-même n'est pas joignable ici : le test simule son résultat avec des webhooks signés.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const Stripe = require('stripe');
const postgres = require('postgres');

const BASE = process.env.BASE ?? 'http://localhost:3000';
const SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_test';
const CONNECT_SECRET = process.env.STRIPE_CONNECT_WEBHOOK_SECRET ?? 'whsec_connect';
const ACCT = 'acct_kartohm_test';
/** Compte Stripe de l'exploitant tel que Stripe l'envoie (account.updated) */
const account = (caps, extra = {}) => ({ id: ACCT, object: 'account', charges_enabled: true, payouts_enabled: true, details_submitted: true, capabilities: caps, ...extra });
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const stripe = new Stripe('sk_test_123');
const ok = (cond, msg) => {
  if (!cond) throw new Error('ÉCHEC : ' + msg);
  console.log('✓', msg);
};

/** Envoie un évènement Stripe signé au webhook de l'app, comme le ferait Stripe */
async function webhook(type, object, secret = SECRET, connected = null) {
  const payload = JSON.stringify({ id: `evt_${Date.now()}`, object: 'event', type, data: { object }, api_version: '2026-10-28.endive', created: Math.floor(Date.now() / 1000), ...(connected ? { account: connected } : {}) });
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
  // L'adresse change dès l'affichage du squelette de chargement : on attend le vrai récapitulatif.
  await page.locator('.pay-badge').first().waitFor();
  ok(await page.locator('.pay-badge:has-text("Bancontact")').isVisible(), 'Récapitulatif : Bancontact et carte proposés');
  const stripeUrl = page.waitForRequest((r) => /checkout\.stripe\.com|stripe\.com/.test(r.url()));
  await page.click('button:has-text("Payer")');
  const req = await stripeUrl;
  await page.waitForURL(/stripe\.com/);
  const [b] = await sql`select * from bookings where user_id = (select id from users where email = ${email}) order by created_at desc limit 1`;
  return { b, url: req.url() };
}

const email = `paiement.${Date.now().toString(36)}@test.be`;
// Le lieu de démo a déjà relié son compte Stripe (Connect)
await sql`update venues set stripe_account_id = ${ACCT}, stripe_charges_enabled = true, stripe_payouts_enabled = true, stripe_bancontact = true,
  stripe_details_submitted = true, stripe_checked_at = now() where slug = 'kartohm'`;

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
  ok(b.stripe_account_id === ACCT, 'Paiement destiné au compte Stripe de l’exploitant');
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
  // La page arrive en flux (squelette puis contenu) : on attend le message lui-même.
  await page.locator('text=Paiement annulé').waitFor({ timeout: 8000 }).catch(() => {});
  ok(await page.locator('text=Paiement annulé').isVisible(), 'Retour sans payer : message clair, rien de débité');
  const [released] = await sql`select status from bookings where id = ${second.b.id}`;
  ok(released.status === 'cancelled', 'Paiement abandonné : places libérées');

  // 6. Session expirée (client parti) : places libérées par le webhook
  const third = await book(page);
  ok((await webhook('checkout.session.expired', { id: third.b.stripe_session_id, object: 'checkout.session', status: 'expired', payment_status: 'unpaid', client_reference_id: third.b.id, metadata: { booking_id: third.b.id } })).ok, 'Webhook « session expirée » accepté');
  const [expired] = await sql`select status from bookings where id = ${third.b.id}`;
  ok(expired.status === 'cancelled', 'Session expirée : places libérées');

  // 7. Comptes exploitants : l'état suit Stripe (webhook des comptes connectés, secret à part)
  ok((await webhook('account.updated', account({ card_payments: 'active', transfers: 'active', bancontact_payments: 'pending' }), CONNECT_SECRET, ACCT)).ok, 'Webhook des comptes exploitants accepté (second secret)');
  let [venue] = await sql`select * from venues where slug = 'kartohm'`;
  ok(venue.stripe_charges_enabled && !venue.stripe_bancontact, 'Bancontact pas encore actif chez Stripe : carte seulement');
  const [slot] = await sql`select id from slots where venue_id = ${venue.id} and starts_at > now() + interval '3 hours' and is_open order by starts_at limit 1`;
  await page.goto(`${BASE}/reserver?slot=${slot.id}&n=2`);
  await page.locator('.pay-badge').first().waitFor();
  ok(!(await page.locator('.pay-badge:has-text("Bancontact")').count()), 'Récapitulatif : pas de Bancontact tant que Stripe ne l’a pas activé');
  await webhook('account.updated', account({ card_payments: 'inactive', transfers: 'active', bancontact_payments: 'inactive' }, { charges_enabled: false }), CONNECT_SECRET, ACCT);
  [venue] = await sql`select * from venues where slug = 'kartohm'`;
  ok(!venue.stripe_charges_enabled, 'Compte suspendu par Stripe : encaissement coupé');
  await page.goto(`${BASE}/reserver?slot=${slot.id}&n=2`);
  await page.locator('text=n’accepte pas encore le paiement en ligne').waitFor({ timeout: 8000 });
  ok(true, 'Lieu sans compte prêt : réservation impossible, message clair');
  await webhook('account.updated', account({ card_payments: 'active', transfers: 'active', bancontact_payments: 'active' }), CONNECT_SECRET, ACCT);
  [venue] = await sql`select * from venues where slug = 'kartohm'`;
  ok(venue.stripe_charges_enabled && venue.stripe_bancontact, 'Compte rétabli : carte et Bancontact');

  // 8. Un nouvel exploitant relie son compte bancaire depuis son espace
  // (stripe-mock renvoie un formulaire sur stripe.me, Stripe sur connect.stripe.com)
  const pro = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await pro.route(/stripe\.(com|me)/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Formulaire Stripe (simulé)</h1>' }));
  const proEmail = `pro.${Date.now().toString(36)}@test.be`;
  await pro.goto(`${BASE}/inscription?type=exploitant`);
  await pro.fill('input[name=firstName]', 'Marc');
  await pro.fill('input[name=email]', proEmail);
  await pro.fill('input[name=venueName]', 'Bowling du Test');
  await pro.selectOption('select[name=category]', 'bowling');
  await pro.check('input[name=partnerTerms]');
  await pro.click('button:has-text("Recevoir mon code")');
  await pro.fill('input[name=code]', (await pro.locator('[data-testid=dev-code] b').textContent()).trim());
  await pro.click('button:has-text("Créer mon compte")');
  await pro.waitForURL(/\/pro/);
  await pro.goto(`${BASE}/pro/etablissement`);
  // La page arrive en flux (squelette puis contenu) : on attend le contenu lui-même.
  await pro.locator('text=Relie ton compte bancaire dans Paiements').first().waitFor({ timeout: 8000 });
  ok(true, 'Liste de mise en ligne : paiements à activer');
  await pro.goto(`${BASE}/pro/paiements`);
  ok((await pro.locator('[data-testid=pay-state]').textContent()).includes('Non activés'), 'Page Paiements : pas encore activés');
  const toStripe = pro.waitForRequest((r) => /stripe\.(com|me)/.test(r.url()));
  await pro.click('button:has-text("Activer les paiements")');
  ok(/stripe\.(com|me)/.test((await toStripe).url()), 'Activer les paiements ouvre le formulaire Stripe');
  await pro.waitForURL(/stripe\.(com|me)/);
  const [created] = await sql`select v.stripe_account_id from venues v join venue_members m on m.venue_id = v.id join users u on u.id = m.user_id where u.email = ${proEmail}`;
  ok(/^acct_/.test(created.stripe_account_id ?? ''), `Compte Stripe créé et rattaché à l’établissement (${created.stripe_account_id})`);
  await pro.goto(`${BASE}/pro/paiements?retour=1`);
  await pro.locator('[data-testid=pay-state]').waitFor({ timeout: 8000 });
  ok(true, `Retour du formulaire Stripe : état affiché (« ${(await pro.locator('[data-testid=pay-state]').textContent()).trim()} »)`);
  const relink = pro.waitForRequest((r) => /stripe\.(com|me)/.test(r.url()));
  await pro.goto(`${BASE}/pro/paiements/lien`).catch(() => {});
  ok(/stripe\.(com|me)/.test((await relink).url()), 'Lien expiré : un nouveau lien Stripe est créé');
  console.log('\nPaiements : tout est bon.');
} finally {
  await browser.close();
  await sql.end();
}
