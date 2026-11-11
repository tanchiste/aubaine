// Mise en conformité et notifications : pages légales, consentements, emails à l'exploitant, rappel de la veille,
// annulation par l'exploitant, signalement, export et suppression du compte.
// Usage : CRON_SECRET=test-cron AUTH_DEV_CODES=1 ADMIN_DEV_CODES=1 npx next start > next.log, puis
//         LOG=next.log DATABASE_URL=… node tests/legal.mjs   (base locale avec les données de démo)
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const postgres = require('postgres');

const BASE = process.env.BASE ?? 'http://localhost:3000';
const LOG = process.env.LOG;
const CRON = process.env.CRON_SECRET ?? 'test-cron';
const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const stamp = Date.now().toString(36);
const clientEmail = `client.legal.${stamp}@test.be`;
const reporterEmail = `signal.${stamp}@test.be`;

const ok = (cond, msg) => {
  if (!cond) throw new Error('ÉCHEC : ' + msg);
  console.log('✓', msg);
};
const settled = (page) => page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 15000 });
/** Les emails partent dans les logs du serveur en local : on y cherche l'objet attendu */
const mailed = async (to, subject) => {
  for (let i = 0; i < 20; i++) {
    if (readFileSync(LOG, 'utf8').includes(`[email] à ${to} · ${subject}`)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
};

async function codeLogin(page, email, next) {
  await page.goto(`${BASE}/connexion?suite=${encodeURIComponent(next)}`);
  await settled(page);
  await page.fill('input[name=email]', email);
  await page.click('button:has-text("Recevoir mon code")');
  await page.fill('input[name=code]', (await page.locator('[data-testid=dev-code] b').textContent()).trim());
  await page.click('button:has-text("Me connecter")');
  await page.waitForURL((u) => !u.pathname.startsWith('/connexion'));
  await settled(page);
}

const browser = await chromium.launch();
try {
  // 1. Pages d'information, référencement
  for (const [path, title] of [
    ['/aide', 'Aide et contact'],
    ['/conditions', 'Conditions d’utilisation'],
    ['/conditions-partenaires', 'Conditions partenaires'],
    ['/confidentialite', 'Politique de confidentialité'],
    ['/cookies', 'Cookies'],
    ['/mentions-legales', 'Mentions légales'],
    ['/signaler', 'Signaler un contenu'],
  ]) {
    const res = await fetch(BASE + path);
    ok(res.status === 200 && (await res.text()).includes(title), `${path} répond`);
  }
  const home = await (await fetch(BASE + '/?ville=tout')).text();
  ok(['/conditions', '/confidentialite', '/mentions-legales', '/aide'].every((h) => home.includes(`href="${h}"`)), 'Le pied de page relie les pages légales');
  ok((await (await fetch(BASE + '/robots.txt')).text()).includes('Disallow: /pro'), 'robots.txt protège les espaces privés');
  ok((await (await fetch(BASE + '/sitemap.xml')).text()).includes('/lieu/kartohm'), 'Le plan du site liste les fiches en ligne');
  ok((await (await fetch(BASE + '/manifest.webmanifest')).json()).short_name === 'Aubaine', 'Manifest pour l’écran d’accueil');
  ok((await fetch(BASE + '/opengraph-image')).headers.get('content-type') === 'image/png', 'Image d’aperçu de partage');

  // 2. Réservation pour demain chez Kart'Ohm : informations légales avant paiement, email à l'exploitant
  const [slot] = await sql`
    select s.id, s.starts_at from slots s join venues v on v.id = s.venue_id join offers o on o.id = s.offer_id
    where v.slug = 'kartohm' and s.is_open and o.is_active and o.group_min <= 2 and o.group_max >= 2
      and s.starts_at >= ((now() at time zone 'Europe/Brussels')::date + 1)::timestamp at time zone 'Europe/Brussels'
      and s.starts_at < ((now() at time zone 'Europe/Brussels')::date + 2)::timestamp at time zone 'Europe/Brussels'
    order by s.starts_at limit 1`;
  ok(!!slot, 'Un créneau Kart’Ohm demain');
  const [owner] = await sql`select u.email from venue_members m join users u on u.id = m.user_id join venues v on v.id = m.venue_id where v.slug = 'kartohm' and m.role = 'owner' and m.notify limit 1`;
  ok(!!owner, 'Kart’Ohm a un gérant qui reçoit les emails');

  const client = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await client.goto(`${BASE}/inscription?type=client&suite=${encodeURIComponent(`/reserver?slot=${slot.id}&n=2`)}`);
  await settled(client);
  ok(await client.locator('a[href="/conditions"]').first().isVisible(), 'L’inscription renvoie aux conditions');
  await client.fill('input[name=firstName]', 'Lina');
  await client.fill('input[name=email]', clientEmail);
  await client.click('button:has-text("Recevoir mon code")');
  await client.fill('input[name=code]', (await client.locator('[data-testid=dev-code] b').textContent()).trim());
  await client.click('button:has-text("Créer mon compte")');
  await client.waitForURL(/\/reserver/);
  await settled(client);
  const [u] = await sql`select terms_version, terms_accepted_at from users where email = ${clientEmail}`;
  ok(!!u.terms_version && !!u.terms_accepted_at, 'Acceptation des conditions enregistrée avec sa version');
  const recap = await client.locator('main').innerText();
  ok(recap.includes('TVA comprise') && recap.includes('délai de rétractation') && recap.includes('Activité fournie par'), 'Récapitulatif : TVA, absence de rétractation, prestataire');
  await client.click('button:has-text("Payer")');
  await client.waitForURL(/\/billets\//);
  await settled(client);
  const bookingId = new URL(client.url()).pathname.split('/').pop();
  const [b] = await sql`select code from bookings where id = ${bookingId}`;
  ok(await mailed(owner.email, 'Nouvelle réservation : Lina'), 'L’exploitant est prévenu de la réservation');

  // 3. Suppression du compte refusée tant qu'une réservation est à venir ; export des données
  const data = await (await client.request.get(`${BASE}/api/moi/donnees`)).json();
  ok(data.compte.email === clientEmail && data.reservations.some((r) => r.code === b.code), 'Export des données : compte et réservations');
  await client.goto(`${BASE}/profil`);
  await settled(client);
  await client.click('button:has-text("Supprimer mon compte")');
  await client.fill('input[name=confirm]', 'SUPPRIMER');
  await client.click('button:has-text("Supprimer définitivement")');
  await client.waitForSelector('.danger-zone .error');
  ok((await client.locator('.danger-zone .error').textContent()).includes('à venir'), 'Suppression refusée avec une réservation à venir');

  // 4. Tâche quotidienne : protégée, rappel au client, récap à l'exploitant
  ok((await fetch(`${BASE}/api/cron/quotidien`)).status === 401, 'La tâche quotidienne refuse un appel sans secret');
  const cron = await (await fetch(`${BASE}/api/cron/quotidien`, { headers: { authorization: `Bearer ${CRON}` } })).json();
  ok(cron.reminders >= 1 && cron.digests >= 1, `Tâche quotidienne : ${cron.reminders} rappel(s), ${cron.digests} récap(s)`);
  const [r1] = await sql`select reminded_at from bookings where id = ${bookingId}`;
  ok(!!r1.reminded_at && (await mailed(clientEmail, 'Demain à')), 'Rappel de la veille envoyé au client');
  ok(await mailed(owner.email, 'Demain chez Kart'), 'Récap de demain envoyé à l’exploitant');
  const again = await (await fetch(`${BASE}/api/cron/quotidien`, { headers: { authorization: `Bearer ${CRON}` } })).json();
  const [r2] = await sql`select reminded_at from bookings where id = ${bookingId}`;
  ok(r2.reminded_at.getTime() === r1.reminded_at.getTime() && again.reminders === 0, 'Un second passage ne renvoie pas les rappels');

  // 5. L'exploitant annule (panne) : client remboursé et prévenu avec le motif
  const pro = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await codeLogin(pro, owner.email, '/pro');
  await pro.goto(`${BASE}/pro/creneaux?semaine=${slot.starts_at.toISOString().slice(0, 10)}&creneau=${slot.id}`);
  await settled(pro);
  const line = pro.locator(`.slot-booking:has-text("${b.code}")`);
  await line.locator('button:has-text("Annuler")').click();
  await line.locator('textarea[name=reason]').fill('Panne de la piste, nous sommes désolés.');
  await line.locator('button:has-text("Annuler et rembourser")').click();
  await line.locator('.notice-ok').waitFor();
  const [c] = await sql`select status, cancelled_by, cancel_reason, fee_cents from bookings where id = ${bookingId}`;
  ok(c.status === 'cancelled' && c.cancelled_by === 'venue' && c.fee_cents === 0, 'Annulation par l’exploitant, sans commission');
  ok(await mailed(clientEmail, "Kart'Ohm a annulé ta réservation"), 'Le client reçoit le motif de l’annulation');
  await client.goto(`${BASE}/billets/${bookingId}`);
  await settled(client);
  ok((await client.locator('main').innerText()).includes('Annulée par le lieu : Panne de la piste'), 'Le billet affiche le motif');

  // 6. Notifications coupées pour un membre : plus d'email
  await pro.goto(`${BASE}/pro/equipe`);
  await settled(pro);
  ok((await pro.locator('button[aria-pressed="true"]:has-text("Emails activés")').count()) >= 1, 'Équipe : préférence d’emails par membre');

  // 7. Signalement sans compte, décision motivée par l'admin
  const visitor = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await visitor.goto(`${BASE}/lieu/kartohm`);
  await settled(visitor);
  ok((await visitor.locator('.provider').innerText()).includes('Activité fournie par'), 'La fiche indique qui fournit l’activité');
  await visitor.click('.provider a:has-text("Signaler")');
  await visitor.waitForURL(/\/signaler\?lieu=kartohm/);
  await settled(visitor);
  ok((await visitor.locator('select[name=venue]').inputValue()) === 'kartohm', 'Le signalement reprend la fiche');
  await visitor.selectOption('select[name=reason]', 'Prix ou remise trompeur');
  await visitor.fill('textarea[name=details]', `Le prix normal affiché semble gonflé par rapport au site du lieu (${stamp}).`);
  await visitor.fill('input[name=email]', reporterEmail);
  await visitor.check('input[name=good]');
  await visitor.click('button:has-text("Envoyer le signalement")');
  await visitor.waitForSelector('text=ton signalement est enregistré');
  const [rep] = await sql`select id, status from reports where details like ${'%' + stamp + '%'}`;
  ok(rep?.status === 'open' && (await mailed(reporterEmail, 'Signalement bien reçu')), 'Signalement enregistré, accusé de réception envoyé');

  const admin = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await codeLogin(admin, 'admin@aubaine.test', '/admin');
  await admin.goto(`${BASE}/admin/signalements`);
  await settled(admin);
  const card = admin.locator(`article:has-text("${stamp}")`);
  await card.locator('textarea[name=resolution]').fill('Vérifié avec l’exploitant : le prix normal correspond à son tarif public.');
  await card.locator('button:has-text("Traité")').click();
  // Traité : la carte quitte la file « à traiter » et passe dans l'historique.
  await card.waitFor({ state: 'detached' });
  const [rep2] = await sql`select status, resolution from reports where id = ${rep.id}`;
  ok(rep2.status === 'resolved' && (await mailed(reporterEmail, 'Ton signalement sur Aubaine a été traité')), 'Décision motivée envoyée à la personne qui a signalé');

  // 8. Suppression du compte : données personnelles effacées, réservations gardées sans lien
  await client.goto(`${BASE}/profil`);
  await settled(client);
  await client.click('button:has-text("Supprimer mon compte")');
  await client.fill('input[name=confirm]', 'SUPPRIMER');
  await client.click('button:has-text("Supprimer définitivement")');
  await client.waitForURL(/supprime=1/);
  await settled(client);
  ok((await client.locator('main').innerText()).includes('Ton compte est supprimé'), 'Compte supprimé, confirmation affichée');
  const gone = await sql`select id from users where email = ${clientEmail}`;
  const [kept] = await sql`select u.email, u.first_name, u.deleted_at from bookings b join users u on u.id = b.user_id where b.id = ${bookingId}`;
  ok(gone.length === 0 && kept.email.endsWith('@aubaine.invalid') && kept.first_name === null && !!kept.deleted_at, 'Données effacées, réservation conservée sans lien');
  console.log('\nConformité et notifications : tout est bon.');
} finally {
  await browser.close();
  await sql.end();
}
