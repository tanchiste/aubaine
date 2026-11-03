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

const shot = async (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

const browser = await chromium.launch();
try {
  // 1. Explorer
  const client = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await client.goto(BASE + '/');
  ok((await client.locator('.venue-card').count()) > 0, 'Explorer affiche des établissements');
  await shot(client, '01-explorer');
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
  await login(partner, partnerEmail, '/pro');
  ok(partner.url().endsWith('/pro'), 'Connexion exploitant par code');
  await partner.fill('input[name=name]', venueName);
  await partner.selectOption('select[name=category]', 'escape');
  await partner.click('button:has-text("Créer ma fiche")');
  await partner.waitForURL(/\/pro\/etablissement/);
  ok(await partner.locator('text=Fiche créée').isVisible(), 'Fiche créée en brouillon');
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

  // 5. Sécurité : un client ne peut pas ouvrir le back-office
  const res2 = await partner.goto(`${BASE}/admin`);
  ok(res2.status() === 404, 'Le back-office est fermé aux non-admins');
  console.log('\nTout est bon.');
} finally {
  await browser.close();
}
