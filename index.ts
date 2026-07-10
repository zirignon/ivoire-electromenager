// supabase/functions/send-order-email/index.ts
//
// Envoie un email au client via Resend, à deux moments possibles :
//   - type = "created" : commande reçue, en attente de paiement
//   - type = "paid"    : paiement confirmé
//
// Appelée :
//   1) depuis script.js juste après l'insertion de la commande (type="created")
//   2) depuis paiement-webhook/index.ts quand payment_status passe à "success" (type="paid")

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const FROM_EMAIL = "L'équipe Ivoire Électroménagers <contact@ivoire-electromenagers.com>";
const ADMIN_EMAIL = "zirignonclaude@gmail.com";

function formatXOF(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA";
}

function buildAdminNewOrderEmail(
  order: Record<string, unknown>,
  items: Record<string, unknown>[],
) {
  const subject = `🛒 Nouvelle commande – ${order.payment_reference}`;
  const itemsRows = items
    .map(
      (item) => `
        <tr>
          <td style="padding: 6px 8px; border-bottom: 1px solid #eee;">${item.product_name}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #eee; text-align: right;">${formatXOF(Number(item.subtotal ?? 0))}</td>
        </tr>`,
    )
    .join("");

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #222;">
      <h2 style="color: #1a73e8;">Nouvelle commande reçue</h2>
      <p><strong>Référence :</strong> ${order.payment_reference}</p>
      <p><strong>Client :</strong> ${order.customer_name ?? "Non précisé"}<br>
         <strong>Téléphone :</strong> ${order.customer_phone ?? "Non précisé"}<br>
         <strong>Email :</strong> ${order.customer_email ?? "Non précisé"}<br>
         <strong>Adresse :</strong> ${order.customer_address ?? "Non précisée"}</p>
      <p><strong>Mode de paiement :</strong> ${order.payment_label ?? order.payment_method ?? "Non précisé"}</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <thead>
          <tr style="background: #f5f5f5;">
            <th style="padding: 6px 8px; text-align: left;">Article</th>
            <th style="padding: 6px 8px; text-align: center;">Qté</th>
            <th style="padding: 6px 8px; text-align: right;">Sous-total</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>
      <p style="margin-top: 16px; font-size: 16px;">
        <strong>Total : ${formatXOF(Number(order.total ?? 0))}</strong>
      </p>
    </div>
  `;
  return { subject, html };
}

function buildCreatedEmail(order: Record<string, unknown>) {
  const subject = `Commande reçue – ${order.payment_reference}`;
  const suiviUrl = `https://ivoire-electromenagers.com/suivi.html?ref=${order.payment_reference}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #222;">
      <h2 style="color: #1a73e8;">Merci pour votre commande !</h2>
      <p>Bonjour ${order.customer_name ?? ""},</p>
      <p>Nous avons bien reçu votre commande <strong>${order.payment_reference}</strong>
         d'un montant de <strong>${formatXOF(Number(order.total ?? 0))}</strong>.</p>
      <p>${
        order.payment_status === "cash_on_delivery"
          ? "Vous avez choisi le paiement à la livraison. Nous vous contacterons bientôt pour organiser la livraison."
          : "Votre commande est en attente de confirmation de paiement. Vous recevrez un email dès que le paiement sera validé."
      }</p>
      <p style="margin-top: 20px;">
        <a href="${suiviUrl}"
           style="display:inline-block;background:#1a73e8;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:0.95rem;">
          📦 Suivre ma commande
        </a>
      </p>
      <p style="font-size:0.8rem;color:#888;margin-top:8px;">
        Ou copiez ce lien : <a href="${suiviUrl}" style="color:#1a73e8;">${suiviUrl}</a>
      </p>
      <p>Merci de votre confiance.</p>
      <p style="margin-top: 32px;">L'équipe Ivoire Électroménagers</p>
    </div>
  `;
  return { subject, html };
}

function buildPaidEmail(order: Record<string, unknown>) {
  const subject = `Paiement confirmé – ${order.payment_reference}`;
  const suiviUrl = `https://ivoire-electromenagers.com/suivi.html?ref=${order.payment_reference}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #222;">
      <h2 style="color: #16a34a;">Paiement confirmé ✅</h2>
      <p>Bonjour ${order.customer_name ?? ""},</p>
      <p>Votre paiement pour la commande <strong>${order.payment_reference}</strong>
         (${formatXOF(Number(order.total ?? 0))}) a bien été confirmé.</p>
      <p>Votre commande est maintenant en cours de préparation. Nous vous contacterons
         pour organiser la livraison.</p>
      <p style="margin-top: 20px;">
        <a href="${suiviUrl}"
           style="display:inline-block;background:#16a34a;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:0.95rem;">
          📦 Suivre ma commande
        </a>
      </p>
      <p style="font-size:0.8rem;color:#888;margin-top:8px;">
        Ou copiez ce lien : <a href="${suiviUrl}" style="color:#16a34a;">${suiviUrl}</a>
      </p>
      <p>Merci de votre confiance.</p>
      <p style="margin-top: 32px;">L'équipe Ivoire Électroménagers</p>
    </div>
  `;
  return { subject, html };
}

async function sendEmail(to: string, subject: string, html: string) {
  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
    }),
  });

  const resendResult = await resendResponse.json();

  if (!resendResponse.ok) {
    console.error(`Erreur Resend (destinataire ${to}) :`, JSON.stringify(resendResult));
    return false;
  }

  console.log(`Email envoyé à ${to} : "${subject}"`);
  return true;
}

// En-têtes CORS : nécessaires car cette fonction est appelée directement
// depuis le navigateur du client (contrairement à paiement-webhook, qui
// n'est appelée que serveur-à-serveur par Paiement Pro).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  // Le navigateur envoie d'abord une requête "preflight" OPTIONS avant
  // le vrai POST ; il faut y répondre correctement avec les headers CORS.
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  let body: { order_id?: string | number; type?: string };
  try {
    body = await req.json();
  } catch (err) {
    console.error("Payload invalide :", err);
    return new Response("Bad request", { status: 400, headers: corsHeaders });
  }

  const { order_id, type } = body;

  if (!order_id || !type || (type !== "created" && type !== "paid")) {
    console.error("Paramètres manquants ou invalides :", JSON.stringify(body));
    return new Response("order_id et type ('created'|'paid') requis", {
      status: 400,
      headers: corsHeaders,
    });
  }

  // Récupère la commande en base pour avoir les infos à jour (nom, email, total...)
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", order_id)
    .single();

  if (error || !order) {
    console.error("Commande introuvable :", order_id, error);
    return new Response("Commande introuvable", { status: 404, headers: corsHeaders });
  }

  const customerEmail = order.customer_email as string | undefined;

  const { subject, html } =
    type === "created" ? buildCreatedEmail(order) : buildPaidEmail(order);

  let clientEmailOk = true;
  if (customerEmail) {
    try {
      clientEmailOk = await sendEmail(customerEmail, subject, html);
    } catch (err) {
      console.error("Exception lors de l'envoi au client :", err);
      clientEmailOk = false;
    }
  } else {
    console.log(`Pas d'email client pour la commande ${order_id}, envoi client ignoré.`);
  }

  // Copie pour le marchand : uniquement à la création de la commande,
  // avec le détail des articles. On ne bloque jamais la réponse pour ça.
  if (type === "created") {
    try {
      const { data: items } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", order_id);

      const { subject: adminSubject, html: adminHtml } = buildAdminNewOrderEmail(
        order,
        items ?? [],
      );
      await sendEmail(ADMIN_EMAIL, adminSubject, adminHtml);
    } catch (err) {
      console.error("Exception lors de l'envoi à l'admin :", err);
    }
  }

  if (!clientEmailOk && customerEmail) {
    return new Response("Erreur envoi email client", { status: 502, headers: corsHeaders });
  }

  return new Response("OK", { status: 200, headers: corsHeaders });
});
