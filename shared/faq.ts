// Single source of truth for in-app help, in both app languages (#46/#49).
// Rendered by the FAQ page (src/pages/Instructions.tsx) AND fed to the
// "How do I…" AI help widget (functions/api/help/ask.ts) as its ONLY
// knowledge source — keeping page and assistant in sync by construction.
// Plain text only: no JSX, no markdown.

export interface FaqItem {
  q: string;
  a: string;
  q_fr: string;
  a_fr: string;
  keywords?: string; // extra search terms not present in q/a
}

export const FAQ: FaqItem[] = [
  {
    q: "How do I add an expense?",
    a: "Three ways. 1) Camera: tap the camera button on the home screen and snap the receipt — vendor, amount, date and currency are read automatically. 2) Email: forward any receipt to receipts@esprey.net from a registered address. 3) Manual entry: for cash with no receipt, tap Manual entry and fill in at least the amount.",
    q_fr: "Comment ajouter une dépense ?",
    a_fr: "Trois façons. 1) Photo : touchez le bouton appareil photo sur l'écran d'accueil et photographiez le reçu — fournisseur, montant, date et devise sont lus automatiquement. 2) E-mail : transférez n'importe quel reçu à receipts@esprey.net depuis une adresse enregistrée. 3) Saisie manuelle : pour de l'espèce sans reçu, touchez Saisie manuelle et renseignez au moins le montant.",
    keywords: "capture photo scan new receipt create ajouter nouvelle",
  },
  {
    q: "How do I email a receipt in?",
    a: "Forward it to receipts@esprey.net from one of your registered email addresses. PDFs, photos, and text-only confirmations (Uber, Airbnb, airlines) all work — it appears in your dashboard within a minute, fully read. If you forward from an address the app doesn't know, you get a bounce-back; ask the admin (cesprey@gmail.com) to add that address as an alias on your account.",
    q_fr: "Comment envoyer un reçu par e-mail ?",
    a_fr: "Transférez-le à receipts@esprey.net depuis l'une de vos adresses e-mail enregistrées. PDF, photos et confirmations texte (Uber, Airbnb, compagnies aériennes) fonctionnent — le reçu apparaît dans votre tableau de bord en moins d'une minute, entièrement lu. Si vous l'envoyez depuis une adresse inconnue, vous recevrez un message de rejet ; demandez à l'administrateur (cesprey@gmail.com) d'ajouter cette adresse comme alias sur votre compte.",
    keywords: "forward inbox alias bounce unregistered transférer",
  },
  {
    q: "How do I capture a multi-page receipt or invoice?",
    a: "After the first photo, the preview screen shows an \"+ Add another page\" button. Keep snapping — all pages are combined into a single PDF receipt and the total is found wherever it appears.",
    q_fr: "Comment photographier un reçu ou une facture de plusieurs pages ?",
    a_fr: "Après la première photo, l'écran d'aperçu affiche un bouton « + Ajouter une page ». Continuez à photographier — toutes les pages sont combinées en un seul reçu PDF et le total est trouvé où qu'il apparaisse.",
    keywords: "pages long invoice combine pdf plusieurs",
  },
  {
    q: "What does the Issues count on the dashboard mean?",
    a: "Issues collects receipts that need your attention, each with a reason chip: OCR failed (couldn't read the receipt), no amount extracted, possible duplicate, edited values differ from what was read off the receipt, or over the category spending limit. Fix the data or acknowledge the flag and the receipt drops out of Issues.",
    q_fr: "Que signifie le compteur Anomalies sur le tableau de bord ?",
    a_fr: "Anomalies regroupe les reçus qui demandent votre attention, chacun avec un motif : échec de lecture, montant manquant, doublon possible, valeurs modifiées par rapport au reçu, ou dépassement de la limite de catégorie. Corrigez les données ou confirmez le signalement et le reçu sort des Anomalies.",
    keywords: "flagged orange red highlight warning pill signalé",
  },
  {
    q: "What is a possible duplicate and how do I clear it?",
    a: "Two receipts with the same vendor, amount and date get flagged as possible duplicates. Open the receipt and check the matching ones linked in the banner. If it really is the same expense twice, delete one. If they're genuinely separate (two identical coffees, say), press Acknowledge — this records that you're intentionally claiming both, and the flag clears.",
    q_fr: "Qu'est-ce qu'un doublon possible et comment le résoudre ?",
    a_fr: "Deux reçus avec le même fournisseur, le même montant et la même date sont signalés comme doublons possibles. Ouvrez le reçu et vérifiez les reçus correspondants indiqués dans la bannière. S'il s'agit vraiment de la même dépense en double, supprimez-en un. S'il s'agit de dépenses distinctes (deux cafés identiques, par exemple), touchez Confirmer — cela enregistre votre choix et retire le signalement.",
    keywords: "duplicate same twice acknowledge doublon",
  },
  {
    q: "Why does it say my edited values differ from OCR?",
    a: "If you change the amount, currency or date away from what was read off the receipt image, the app asks you to acknowledge the difference. This is an audit trail: it records that the change was deliberate. Press Acknowledge in the banner if your edit is correct.",
    q_fr: "Pourquoi indique-t-on que mes valeurs modifiées diffèrent de la lecture ?",
    a_fr: "Si vous modifiez le montant, la devise ou la date par rapport à ce qui a été lu sur le reçu, l'application vous demande de confirmer la différence. C'est une piste d'audit : elle enregistre que le changement était volontaire. Touchez Confirmer dans la bannière si votre modification est correcte.",
    keywords: "mismatch override changed edited banner modifié",
  },
  {
    q: "What is a spending limit and why is my receipt over it?",
    a: "The admin can set a per-receipt limit on any category (for example 80 for Meals). A receipt over its category's limit is flagged in Issues and shows an orange banner. You can still claim it — press Acknowledge to record that you know it's over the limit. The acknowledgement stays on the receipt's record.",
    q_fr: "Qu'est-ce qu'une limite de dépense et pourquoi mon reçu la dépasse-t-il ?",
    a_fr: "L'administrateur peut fixer une limite par reçu sur chaque catégorie (par exemple 80 pour les repas). Un reçu au-dessus de la limite de sa catégorie est signalé dans Anomalies avec une bannière orange. Vous pouvez quand même le soumettre — touchez Confirmer pour indiquer que vous savez qu'il dépasse la limite. La confirmation reste dans l'historique du reçu.",
    keywords: "policy limit cap over budget category limite dépassement",
  },
  {
    q: "How do I delete a receipt, and what is Trash?",
    a: "Open the receipt and press Delete. It moves to Trash (Settings → Trash) where it stays for 30 days — press Restore there if you change your mind. After 30 days it's permanently gone, including the stored image.",
    q_fr: "Comment supprimer un reçu, et qu'est-ce que la corbeille ?",
    a_fr: "Ouvrez le reçu et touchez Supprimer. Il est placé dans la corbeille (Réglages → Corbeille) pendant 30 jours — touchez Restaurer si vous changez d'avis. Après 30 jours, il est définitivement supprimé, image comprise.",
    keywords: "remove undo restore recover bin supprimer restaurer",
  },
  {
    q: "How do tips work on meals and taxis?",
    a: "For meal and taxi categories a Tip selector appears. Enter the bill exactly as printed on the receipt, then pick a percentage (5–20%) or enter a custom tip amount. The report shows the total (bill + tip); the receipt image still matches the bill, which is what the OCR checks against.",
    q_fr: "Comment fonctionnent les pourboires pour les repas et taxis ?",
    a_fr: "Pour les catégories repas et taxi, un sélecteur Pourboire apparaît. Saisissez l'addition exactement comme imprimée sur le reçu, puis choisissez un pourcentage (5–20 %) ou un montant personnalisé. Le rapport affiche le total (addition + pourboire) ; l'image du reçu correspond toujours à l'addition, ce que vérifie la lecture automatique.",
    keywords: "gratuity service percentage restaurant pourboire",
  },
  {
    q: "How do I generate a monthly report?",
    a: "Go to Reports from the home screen. Pick the month (defaults to last month), optionally one company (otherwise a combined report), optionally a target currency, and the report language. Press Generate, then use the buttons: Open PDF to view, Download PDF to save it, Email PDF to send it to yourself, and Download originals for a ZIP of the receipt files. Nothing is emailed unless you press the email button.",
    q_fr: "Comment générer un rapport mensuel ?",
    a_fr: "Allez dans Rapports depuis l'écran d'accueil. Choisissez le mois (par défaut le mois dernier), éventuellement une société (sinon rapport combiné), éventuellement une devise cible, et la langue du rapport. Touchez Générer, puis utilisez les boutons : Ouvrir le PDF, Télécharger le PDF, Envoyer le PDF par e-mail, et Télécharger les originaux (ZIP). Rien n'est envoyé par e-mail sans que vous touchiez le bouton d'envoi.",
    keywords: "invoice month pdf zip send export rapport facture",
  },
  {
    q: "Can reports be in a different language from the app?",
    a: "Yes. The report language dropdown on the Reports page is independent of your app language — a French-speaking user can generate an English report and vice versa. Descriptions and categories are translated; establishment names, amounts, dates and currencies stay exactly as on the receipts.",
    q_fr: "Le rapport peut-il être dans une autre langue que l'application ?",
    a_fr: "Oui. Le menu Langue du rapport sur la page Rapports est indépendant de la langue de l'application — un utilisateur francophone peut générer un rapport en anglais et inversement. Les descriptions et catégories sont traduites ; les noms d'établissements, montants, dates et devises restent exactement comme sur les reçus.",
    keywords: "language translate french english langue traduction",
  },
  {
    q: "Do attendees show up in reports?",
    a: "Yes. Tag people on a receipt (the People field) and the monthly report's category-breakdown page shows a small \"with …\" line under that receipt, so meal and hotel claims carry their context. Your people list is private to you.",
    q_fr: "Les personnes présentes apparaissent-elles dans les rapports ?",
    a_fr: "Oui. Indiquez les personnes sur un reçu (champ Personnes présentes) et la page de ventilation par catégorie du rapport mensuel affiche une petite ligne « avec … » sous ce reçu. Votre liste de personnes reste privée.",
    keywords: "people guests who was present breakdown invités",
  },
  {
    q: "How does currency conversion in reports work?",
    a: "If you pick a target currency, every receipt is converted using the exchange rate from the day the receipt was captured — not today's rate — so regenerating an old report gives the same numbers. Receipts from before this feature use current rates. The rate source and dates are printed at the bottom of the report.",
    q_fr: "Comment fonctionne la conversion de devises dans les rapports ?",
    a_fr: "Si vous choisissez une devise cible, chaque reçu est converti au taux de change du jour où il a été capturé — pas au taux du jour — donc regénérer un ancien rapport donne les mêmes chiffres. Les reçus antérieurs à cette fonction utilisent les taux actuels. La source des taux et les dates figurent en bas du rapport.",
    keywords: "fx exchange rate convert eur usd gbp xof taux change",
  },
  {
    q: "What's private to me and what's shared?",
    a: "Private to you: your receipts, your reports, your people/attendees list, and your profile (name, address, bank details). Shared team-wide and curated by the admin: the companies list, the categories list (and their spending limits), and supported currencies. Need a new company or alias? Ask the admin at cesprey@gmail.com.",
    q_fr: "Qu'est-ce qui est privé et qu'est-ce qui est partagé ?",
    a_fr: "Privé : vos reçus, vos rapports, votre liste de personnes, et votre profil (nom, adresse, coordonnées bancaires). Partagé pour toute l'équipe et géré par l'administrateur : la liste des sociétés, la liste des catégories (et leurs limites de dépense), et les devises. Besoin d'une nouvelle société ou d'un alias ? Écrivez à l'administrateur : cesprey@gmail.com.",
    keywords: "privacy who can see admin visibility privé confidentialité",
  },
  {
    q: "What should I set up first?",
    a: "Go to Settings → My Profile and fill in your name, address, VAT number if you have one, and bank details (free text — IBAN, sort code, whatever the payer needs). These appear at the top of every invoice you generate, so do it once before your first report. You can also pick your app language there.",
    q_fr: "Que dois-je configurer en premier ?",
    a_fr: "Allez dans Réglages → Mon profil et renseignez votre nom, adresse, numéro de TVA le cas échéant, et vos coordonnées bancaires (texte libre — IBAN ou ce dont le payeur a besoin). Ces informations apparaissent en haut de chaque facture générée : faites-le une fois avant votre premier rapport. Vous pouvez aussi y choisir la langue de l'application.",
    keywords: "profile bank details onboarding first time setup profil banque",
  },
  {
    q: "How do I install the app on my phone?",
    a: "iPhone: open expenses.esprey.net in Safari, tap Share, then \"Add to Home Screen\". Android: open it in Chrome and choose \"Install app\". The icon then opens the app full-screen like a native app.",
    q_fr: "Comment installer l'application sur mon téléphone ?",
    a_fr: "iPhone : ouvrez expenses.esprey.net dans Safari, touchez Partager, puis « Sur l'écran d'accueil ». Android : ouvrez-le dans Chrome et choisissez « Installer l'application ». L'icône ouvre ensuite l'application en plein écran, comme une application native.",
    keywords: "pwa home screen icon ios android install installer téléphone",
  },
  {
    q: "What if I have no signal when I get a receipt?",
    a: "Take the photo with your phone's normal Camera app, then email it to receipts@esprey.net. Your mail app queues the send and delivers it when you're back online — no expense lost.",
    q_fr: "Que faire si je n'ai pas de réseau au moment du reçu ?",
    a_fr: "Prenez la photo avec l'appareil photo normal de votre téléphone, puis envoyez-la par e-mail à receipts@esprey.net. Votre application e-mail mettra l'envoi en attente et le livrera au retour du réseau — aucune dépense perdue.",
    keywords: "offline no internet airplane remote field hors ligne réseau",
  },
  {
    q: "Who do I contact for help?",
    a: "Email Carl Esprey at cesprey@gmail.com — for anything the app can't answer: adding a company, registering an email alias, changing spending limits, or fixing your account.",
    q_fr: "Qui contacter pour obtenir de l'aide ?",
    a_fr: "Écrivez à Carl Esprey : cesprey@gmail.com — pour tout ce que l'application ne peut pas résoudre : ajouter une société, enregistrer un alias e-mail, modifier des limites de dépense, ou réparer votre compte.",
    keywords: "support contact admin problem stuck aide contact",
  },
];

/** The FAQ as one plain-text block — grounding for the AI help widget.
 *  English is the canonical version; the widget answers in the user's language. */
export function faqAsText(): string {
  return FAQ.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n");
}
