// Parcours complet : un exploitant inscrit sa fiche, l'admin la valide, un client la voit.
// Usage : BASE=http://localhost:3000 node tests/e2e.mjs   (base locale avec ADMIN_EMAILS=admin@aubaine.test)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE ?? 'http://localhost:3000';
const SHOTS = process.env.SHOTS ?? '';
const stamp = Date.now().toString(36);
const partnerEmail = `exploitant.${stamp}@test.be`;
const venueName = `Escape Test ${stamp}`;

const ok = (cond, msg) => {
  if (!cond) throw new Error('ÉCHEC : ' + msg);
  console.log('✓', msg);
};

async function login(page, email, next) {
  await page.goto(`${BASE}/connexion?suite=${encodeURIComponent(next)}`);
  await page.fill('input[name=email]', email);
  await page.click('button:has-text("Recevoir mon code")');
  const code = (await page.locator('[data-testid=dev-code] b').textContent()).trim();
  await page.fill('input[name=code]', code);
  await page.click('button:has-text("Me connecter")');
  await page.waitForURL((u) => !u.pathname.startsWith('/connexion'));
}

/** Inscription : type de compte, prénom, email (et établissement pour un exploitant), puis code */
async function signup(page, { kind, firstName, email, venue, next }) {
  await page.goto(`${BASE}/inscription?type=${kind}${next ? `&suite=${encodeURIComponent(next)}` : ''}`);
  await page.fill('input[name=firstName]', firstName);
  await page.fill('input[name=email]', email);
  if (venue) {
    await page.fill('input[name=venueName]', venue.name);
    await page.selectOption('select[name=category]', venue.category);
  }
  await page.click('button:has-text("Recevoir mon code")');
  const code = (await page.locator('[data-testid=dev-code] b').textContent()).trim();
  await page.fill('input[name=code]', code);
  await page.click('button:has-text("Créer mon compte")');
  await page.waitForURL((u) => !u.pathname.startsWith('/inscription'));
}

const shot = async (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

const browser = await chromium.launch();
try {
  // 1. Explorer
  const client = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await client.goto(BASE + '/');
  ok((await client.locator('.venue-card').count()) > 0, 'Explorer affiche des établissements');
  await shot(client, '01-explorer');
  ok((await client.locator('.venue-card .cat-tag').count()) > 0, 'Chaque carte affiche son type d’activité');
  await client.click('.picker-btn');
  const cityItems = await client.locator('.picker-menu a').all();
  let reachable = 0;
  for (const it of cityItems) {
    const b = await it.boundingBox();
    if (await client.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.picker-menu a'), [b.x + b.width / 2, b.y + b.height / 2])) reachable++;
  }
  ok(cityItems.length > 1 && reachable === cityItems.length, `Le menu des villes est entièrement visible et cliquable (${reachable}/${cityItems.length})`);
  await client.keyboard.press('Escape');

  // Recherche : le type d'activité est trouvé, avec suggestions pendant la frappe
  await client.fill('input[aria-label="Rechercher une activité"]', 'kart');
  await client.waitForSelector('.suggest a:has-text("Kart\'Ohm")');
  ok(await client.locator('.suggest a:has-text("Karting")').first().isVisible(), 'Suggestions pendant la frappe (« kart » → Karting, Kart’Ohm)');
  await client.fill('input[aria-label="Rechercher une activité"]', 'karting');
  await client.waitForSelector('.suggest a:has-text("Kart\'Ohm")');
  await client.press('input[aria-label="Rechercher une activité"]', 'Enter');
  await client.waitForURL(/q=karting/);
  ok((await client.locator('text=Kart\'Ohm').count()) > 0, 'Rechercher « karting » affiche Kart’Ohm');
  await client.click('.chips a:has-text("Escape")');
  await client.waitForURL((u) => u.searchParams.get('cat') === 'escape');
  ok(!new URL(client.url()).searchParams.get('q'), 'Choisir une catégorie remplace la recherche');
  await client.goto(BASE + '/?q=kart&cat=escape');
  ok(await client.locator('.chips a[aria-current="true"]:has-text("Escape")').isVisible() && await client.locator('.reset-link').isVisible(), 'La catégorie active est visible, avec « Réinitialiser »');
  await client.click('.fix:has-text("dans toutes les activités")');
  await client.waitForURL((u) => !u.searchParams.get('cat'));
  ok((await client.locator('text=Kart\'Ohm').count()) > 0, 'Page vide : une alternative en un clic retrouve Kart’Ohm');
  // Le moment de la journée s'applique aussi aux meilleurs deals et aux horaires de la liste
  for (const [m, from, to] of [['matin', 0, 12], ['aprem', 12, 18], ['soir', 18, 24]]) {
    await client.goto(`${BASE}/?ville=tout&moment=${m}`);
    const texts = [...(await client.locator('.deal-card .deal-body .small').allTextContents()), ...(await client.locator('.venue-card .mini-slot').allTextContents())];
    const hours = texts.map((t) => t.match(/(\d{2}):\d{2}/)).filter(Boolean).map((x) => Number(x[1]));
    ok(hours.length > 0 && hours.every((h) => h >= from && h < to), `Filtre « ${m} » : uniquement des horaires entre ${from} h et ${to} h (${hours.length} vus)`);
  }
  // Heure précise (ordinateur) : « Vers 16 h » puis une plage 14 h – 16 h
  const dk = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await dk.goto(`${BASE}/?ville=tout`);
  await dk.click('.toolbar [data-menu=time]');
  ok((await dk.locator('.menu-time a').count()) === 4 && (await dk.locator('.menu-time select').count()) === 1, 'Menu Horaire simple : 4 moments et un seul choix « vers une heure »');
  await dk.selectOption('.menu-time select', '16');
  await dk.waitForURL((u) => u.searchParams.get('de') === '16' && u.searchParams.get('a') === '18');
  let hrs = [...(await dk.locator('.deal-card .deal-body .small').allTextContents()), ...(await dk.locator('.venue-card .mini-slot').allTextContents())]
    .map((t) => t.match(/(\d{2}):\d{2}/)).filter(Boolean).map((x) => Number(x[1]));
  ok(hrs.length > 0 && hrs.every((h) => h >= 16 && h < 18), `« Vers 16 h » : créneaux entre 16 h et 18 h (${hrs.length} vus)`);
  ok(await dk.locator('.toolbar [data-menu=time]:has-text("16 h – 18 h")').isVisible(), 'La plage horaire s’affiche dans le bouton Horaire');
  await dk.click('.toolbar [data-menu=people]');
  await dk.click('.toolbar .people-grid a:has-text("5")');
  await dk.waitForURL((u) => u.searchParams.get('n') === '5');
  ok(await dk.locator('.toolbar [data-menu=people]:has-text("5 personnes")').isVisible(), 'Ordinateur : le nombre de personnes se choisit directement dans une grille');
  await dk.close();

  // Téléphone : une seule ligne de trois pastilles (jour, personnes, horaire)
  await client.goto(`${BASE}/?ville=tout`);
  ok(!(await client.locator('.toolbar').isVisible()) && (await client.locator('.quickbar .qpill').count()) === 3, 'Téléphone : une seule ligne de trois pastilles');
  await client.click('.quickbar .qpill >> nth=1');
  await client.click('.people-grid a:has-text("3")');
  await client.waitForURL((u) => u.searchParams.get('n') === '3');
  await client.click('.quickbar .qpill >> nth=2');
  await client.click('.menu-time a:has-text("Soir")');
  await client.waitForURL((u) => u.searchParams.get('moment') === 'soir' && u.searchParams.get('n') === '3');
  await client.click('.quickbar .qpill >> nth=0');
  await client.click('.qmenu a:has-text("Demain")');
  await client.waitForURL((u) => !!u.searchParams.get('date'));
  ok((await client.locator('.quickbar').textContent()).includes('Demain') && (await client.locator('.quickbar').textContent()).includes('Soir'), 'Pastilles : 3 personnes, soir et demain appliqués et affichés');
  await client.goto(`${BASE}/lieu/bulle-d-o?moment=matin`);
  const ficheHours = (await client.locator('.slot b').allTextContents()).map((t) => Number(t.slice(0, 2)));
  ok(ficheHours.length > 0 && ficheHours.every((h) => h < 12), 'La fiche garde le filtre « matin » (et propose toute la journée)');
  await client.goto(BASE + '/?q=' + encodeURIComponent('spa'));
  ok((await client.locator('text=Bulle d\'O').count()) > 0, 'Rechercher « spa » trouve le bien-être (sans accent ni mot exact)');
  await client.goto(BASE + '/');
  await client.locator('.venue-card .venue-link').first().click();
  await client.waitForURL(/\/lieu\//);
  ok((await client.locator('.slot').count()) > 0, 'La fiche affiche des créneaux');
  await client.locator('.slot:not(.full)').first().click();
  await client.waitForSelector('.sticky-cta');
  ok(await client.locator('.sticky-cta a:has-text("Réserver")').isVisible(), 'Choisir un créneau affiche le prix et le bouton Réserver');
  await shot(client, '02-fiche');

  // 2. Exploitant : inscription et fiche
  const pctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const partner = await pctx.newPage();
  // Se connecter avec un email inconnu renvoie vers l'inscription
  await partner.goto(`${BASE}/connexion`);
  await partner.fill('input[name=email]', partnerEmail);
  await partner.click('button:has-text("Recevoir mon code")');
  await partner.waitForSelector('text=Aucun compte avec cet email.');
  ok(true, 'Connexion refusée pour un email sans compte, lien vers l’inscription');
  await signup(partner, { kind: 'exploitant', firstName: 'Sophie', email: partnerEmail, venue: { name: venueName, category: 'escape' } });
  ok(/\/pro\/etablissement/.test(partner.url()), 'Inscription exploitant : arrive directement sur sa fiche');
  ok(await partner.locator('text=Fiche créée').isVisible(), 'Fiche créée en brouillon avec l’inscription');
  await partner.fill('textarea[name=description]', 'Deux salles immersives de 60 minutes au cœur de Mons, de 2 à 6 joueurs, idéal entre amis.');
  await partner.fill('input[name=address]', 'Rue de la Chaussée 1, 7000 Mons');
  await partner.fill('input[name=price]', '25');
  await partner.click('button:has-text("Enregistrer")');
  await partner.waitForSelector('text=Fiche enregistrée.');
  ok(true, 'Fiche enregistrée');

  // Photos de test : des captures d'écran colorées
  const imgPage = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const imgs = [];
  for (const c of ['#E89A00', '#3A28D4', '#1E7F57']) {
    await imgPage.setContent(`<body style="margin:0;background:${c}"></body>`);
    imgs.push({ name: 'p.png', mimeType: 'image/png', buffer: await imgPage.screenshot() });
  }
  await partner.setInputFiles('.photo-add input[type=file]', imgs);
  await partner.waitForFunction(() => document.querySelectorAll('.photo img').length >= 3, null, { timeout: 20000 });
  ok(true, '3 photos envoyées et réduites dans le navigateur');
  await partner.waitForSelector('button:has-text("Envoyer ma fiche en validation"):not([disabled])');
  await shot(partner, '03-pro-fiche');
  await partner.click('button:has-text("Envoyer ma fiche en validation")');
  await partner.waitForSelector('text=Fiche envoyée !');
  ok(true, 'Fiche envoyée en validation');

  // 3. Admin : validation
  const actx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const admin = await actx.newPage();
  await login(admin, 'admin@aubaine.test', '/admin');
  await admin.click(`.queue-item:has-text("${venueName}")`);
  await admin.waitForURL(/\?id=/);
  await shot(admin, '04-admin');
  await admin.click('button:has-text("Mettre en ligne")');
  await admin.waitForSelector('text=Fiche mise en ligne. L’exploitant');
  ok(true, 'Admin met la fiche en ligne');

  // 4. Le client voit la fiche publiée, l'exploitant voit le statut
  const slug = venueName.toLowerCase().replace(/\s+/g, '-');
  const res = await client.goto(`${BASE}/lieu/${slug}`);
  ok(res.status() === 200 && (await client.locator('h1').textContent()).includes(venueName), 'La fiche est publique');
  await partner.goto(`${BASE}/pro`);
  ok(await partner.locator('text=Ta fiche est en ligne').isVisible(), 'L’exploitant voit sa fiche en ligne');
  await shot(partner, '05-pro-home');

  // 5. L'exploitant ouvre un créneau dans 1 h (heure de Bruxelles)
  const inOneHour = new Date(Date.now() + 65 * 60_000);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(inOneHour).map((p) => [p.type, p.value]),
  );
  const slotDate = `${parts.year}-${parts.month}-${parts.day}`;
  const slotTime = `${parts.hour}:${String(Math.floor(Number(parts.minute) / 5) * 5).padStart(2, '0')}`;
  await partner.goto(`${BASE}/pro/creneaux?date=${slotDate}`);
  await partner.fill('input[name=date]', slotDate);
  await partner.fill('input[name=time]', slotTime);
  await partner.click('form button:has-text("Ouvrir")');
  await partner.waitForSelector('text=1 créneau ouvert');
  ok(true, `Créneau ouvert le ${slotDate} à ${slotTime}`);
  await partner.reload();
  await shot(partner, '06-pro-creneaux');

  // 6. Un nouveau client réserve (connexion au milieu du parcours)
  const cctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const buyer = await cctx.newPage();
  await buyer.goto(`${BASE}/lieu/${slug}?date=${slotDate}&n=4`);
  await buyer.locator('.slot:not(.full)').first().click();
  await buyer.click('.sticky-cta a:has-text("Réserver")');
  await buyer.waitForURL(/\/reserver/);
  await buyer.click('a:has-text("Créer mon compte et réserver")');
  await buyer.waitForURL(/\/inscription/);
  const buyerEmail = `client.${stamp}@test.be`;
  await buyer.fill('input[name=firstName]', 'Camille');
  await buyer.fill('input[name=email]', buyerEmail);
  await buyer.click('button:has-text("Recevoir mon code")');
  const code = (await buyer.locator('[data-testid=dev-code] b').textContent()).trim();
  await buyer.fill('input[name=code]', code);
  await buyer.click('button:has-text("Créer mon compte")');
  await buyer.waitForURL(/\/reserver/);
  ok(true, 'Inscription client au milieu de la réservation, retour sur la réservation');
  await shot(buyer, '07-paiement');
  await buyer.click('button:has-text("Payer")');
  await buyer.waitForURL(/\/billets\//);
  ok(await buyer.locator('h1:has-text("C’est réservé !")').isVisible(), 'Réservation confirmée, billet affiché');
  const ticket = (await buyer.locator('[data-testid=ticket-code]').textContent()).trim();
  ok(/^[A-Z2-9]{6}$/.test(ticket), `Code du billet : ${ticket}`);
  await shot(buyer, '08-billet');
  await buyer.goto(`${BASE}/billets`);
  ok(await buyer.locator(`text=${ticket}`).isVisible(), 'Le billet apparaît dans « Tes billets »');

  // 7. Le gérant ajoute une personne à l'accueil
  const staffEmail = `accueil.${stamp}@test.be`;
  await partner.goto(`${BASE}/pro/equipe`);
  await partner.fill('form input[name=email]', staffEmail);
  await partner.fill('form input[name=firstName]', 'Lucas');
  await partner.click('button:has-text("Ajouter à l’équipe")');
  await partner.waitForSelector('text=Lucas ajouté à l’accueil');
  ok(true, 'Le gérant ajoute Lucas à l’accueil');
  await partner.goto(`${BASE}/pro`);
  ok(await partner.locator('text=Rendement').isVisible(), 'Le gérant voit le rendement');

  // 8. L'accueil se connecte : il ne voit que la validation des arrivées
  const sctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const staff = await sctx.newPage();
  await login(staff, staffEmail, '/');
  ok(new URL(staff.url()).pathname === '/pro', 'Un compte exploitant arrive sur son espace après connexion');
  ok(!(await staff.locator('text=Rendement').count()), 'L’accueil ne voit pas le rendement');
  await staff.goto(`${BASE}/pro/creneaux`);
  ok(new URL(staff.url()).pathname === '/pro', 'L’accueil ne peut pas ouvrir les créneaux');
  await staff.fill('input[name=code]', ticket.toLowerCase());
  await staff.click('form button:has-text("Valider")');
  await staff.waitForSelector('text=Camille validé');
  ok(true, 'L’accueil valide l’arrivée avec le code');
  await staff.fill('input[name=code]', ticket);
  await staff.click('form button:has-text("Valider")');
  await staff.waitForSelector('text=déjà validé');
  ok(true, 'Un même code ne peut pas être validé deux fois');
  await shot(staff, '09-accueil');

  // 9. Profil client : historique et infos
  await buyer.goto(`${BASE}/profil`);
  ok(await buyer.locator('h1:has-text("Camille")').isVisible(), 'Le profil client affiche le prénom');
  await shot(buyer, '10-profil');

  // 10. Sécurité : un compte non admin ne peut pas ouvrir le back-office
  const res2 = await partner.goto(`${BASE}/admin`);
  ok(res2.status() === 404, 'Le back-office est fermé aux non-admins');
  console.log('\nTout est bon.');
} finally {
  await browser.close();
}
