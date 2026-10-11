// Cloudflare Worker: nimmt das Rückruf-Formular von www.it-gotha.de entgegen
// und schickt die Anfrage per Brevo-API an kontakt@it-gotha.de.
//
// Benötigtes Secret im Worker: BREVO_API_KEY
// (Ordner beginnt mit "_", deshalb veröffentlicht GitHub Pages ihn nicht.)

const SITE = "https://www.it-gotha.de";
const POSTFACH = "kontakt@it-gotha.de";

const weiter = (pfad) => Response.redirect(SITE + pfad, 303);

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return weiter("/");

    let form;
    try {
      form = await request.formData();
    } catch {
      return weiter("/rueckruf-fehler");
    }

    const feld = (name, max) =>
      (form.get(name) || "").toString().replace(/[\r\n]+/g, " ").trim().slice(0, max);

    // Honeypot: Menschen sehen dieses Feld nicht, Spam-Bots füllen es aus.
    if (feld("website", 200)) return weiter("/rueckruf-angefordert");

    const name = feld("name", 100);
    const telefon = feld("telefon", 40);
    const zeit = feld("zeit", 30) || "egal";
    const anliegen = (form.get("anliegen") || "").toString().trim().slice(0, 1500);

    if (!name || !/^[+0-9 ()\/.-]{6,30}$/.test(telefon)) {
      return weiter("/rueckruf-fehler");
    }

    const text = [
      "Neuer Rückrufwunsch über it-gotha.de",
      "",
      `Name:      ${name}`,
      `Telefon:   ${telefon}`,
      `Am besten: ${zeit}`,
      "",
      "Anliegen:",
      anliegen || "(keine Angabe)",
    ].join("\n");

    const antwort = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": env.BREVO_API_KEY,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Website it-gotha.de", email: POSTFACH },
        to: [{ email: POSTFACH }],
        subject: `Rückrufwunsch: ${name} (${telefon})`,
        textContent: text,
      }),
    });

    return weiter(antwort.ok ? "/rueckruf-angefordert" : "/rueckruf-fehler");
  },
};
