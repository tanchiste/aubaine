import 'server-only';

type Mail = { to: string; subject: string; text: string; html?: string };

/**
 * Envoie un email via Resend si RESEND_API_KEY est défini.
 * Sans clé (développement), le contenu est écrit dans la console du serveur.
 */
export async function sendMail(mail: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`\n[email] à ${mail.to} · ${mail.subject}\n${mail.text}\n`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? 'Aubaine <onboarding@resend.dev>',
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    }),
  });
  if (!res.ok) {
    console.error('[email] échec Resend', res.status, await res.text().catch(() => ''));
    throw new Error("L'email n'a pas pu être envoyé.");
  }
}

export function loginCodeMail(to: string, code: string): Mail {
  return {
    to,
    subject: `${code} est ton code Aubaine`,
    text: `Ton code de connexion Aubaine : ${code}\n\nIl est valable 10 minutes. Si tu n'as rien demandé, ignore simplement cet email.`,
    html: `<div style="font-family:system-ui,sans-serif;color:#17142E;max-width:420px">
<p style="font-size:15px">Ton code de connexion Aubaine :</p>
<p style="font-size:32px;font-weight:800;letter-spacing:6px;margin:12px 0">${code}</p>
<p style="font-size:13px;color:#6B6882">Valable 10 minutes. Si tu n'as rien demandé, ignore simplement cet email.</p>
</div>`,
  };
}
