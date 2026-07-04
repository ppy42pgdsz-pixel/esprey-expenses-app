// App UI translations (#49c). English strings ARE the keys — t("Delete")
// returns "Supprimer" in French, or the key itself when no translation
// exists yet. That makes partial translation safe: untranslated strings
// simply render in English, and adding a language later (e.g. pt-PT) is
// just another column here.

export type Lang = "en" | "fr";

const STORAGE_KEY = "esprey.lang";

let current: Lang = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "fr" ? "fr" : "en";
  } catch {
    return "en";
  }
})();

export function getLang(): Lang {
  return current;
}

/** Set the UI language (persisted per device; synced from the profile on boot). */
export function setLang(l: Lang) {
  current = l === "fr" ? "fr" : "en";
  try { localStorage.setItem(STORAGE_KEY, current); } catch { /* ignore */ }
}

export function t(s: string): string {
  if (current === "en") return s;
  return FR[s] ?? s;
}

const FR: Record<string, string> = {
  // ----- Chrome / navigation -----
  "Expenses": "Dépenses",
  "Settings": "Réglages",
  "Reports": "Rapports",
  "Help & FAQ": "Aide & FAQ",
  "← Back": "← Retour",
  "Back": "Retour",
  "Loading…": "Chargement…",
  "Open": "Ouvrir",
  "Refresh": "Actualiser",
  "Cancel": "Annuler",
  "Delete": "Supprimer",
  "Save": "Enregistrer",
  "Saving…": "Enregistrement…",
  "Save & back": "Enregistrer et retour",
  "+ Manual": "+ Saisie",
  "+ Capture": "+ Photo",

  // ----- Dashboard -----
  "Receipts": "Reçus",
  "Uncategorized": "Sans catégorie",
  "Issues": "Anomalies",
  "Filter by company": "Filtrer par société",
  "All companies": "Toutes les sociétés",
  "Filter by date range": "Filtrer par période",
  "All time": "Toute la période",
  "This week": "Cette semaine",
  "Last week": "Semaine dernière",
  "This month": "Ce mois-ci",
  "Last month": "Mois dernier",
  "Last 30 days": "30 derniers jours",
  "Last 90 days": "90 derniers jours",
  "Custom (pick dates)": "Personnalisé (choisir les dates)",
  "Pick dates": "Choisir les dates",
  "Custom date range": "Période personnalisée",
  "Edit custom date range": "Modifier la période",
  "From": "Du",
  "To": "Au",
  "Done": "OK",
  "Date": "Date",
  "Vendor": "Fournisseur",
  "Amount": "Montant",
  "Currency": "Devise",
  "Category": "Catégorie",
  "Company": "Société",
  "Description": "Description",
  "Notes": "Notes",
  "OCR failed": "Échec de lecture",
  "Possible duplicate": "Doublon possible",
  "No amount": "Montant manquant",
  "Over category limit": "Au-dessus de la limite",
  "Edited values differ from OCR": "Valeurs modifiées ≠ lecture du reçu",
  "Reassign company…": "Réaffecter la société…",
  "Reassign category…": "Réaffecter la catégorie…",
  "Capture your first one →": "Photographiez votre premier reçu →",

  // ----- Capture -----
  "Capture receipt": "Photographier un reçu",
  "Snap a photo of your receipt — Claude will read it.": "Prenez votre reçu en photo — Claude le lit automatiquement.",
  "Add another page": "Ajouter une page",
  "Retake": "Reprendre",
  "Start over": "Recommencer",
  "Uploading & reading…": "Envoi et lecture…",
  "Working…": "Traitement…",
  "Reading…": "Lecture…",
  "Multi-page invoice?": "Facture de plusieurs pages ?",
  "Bulk upload tip:": "Astuce envoi groupé :",
  "Camera app": "appareil photo",
  "PDF file": "Fichier PDF",
  "Claude will read the PDF contents.": "Claude lira le contenu du PDF.",
  "No preview available.": "Aperçu indisponible.",

  // ----- Manual entry -----
  "Manual entry": "Saisie manuelle",
  "Save expense": "Enregistrer la dépense",
  "Amount *": "Montant *",
  "What was this for?": "C'était pour quoi ?",
  "e.g. Cash taxi, Coffee shop": "ex. Taxi en espèces, Café",

  // ----- Receipt detail -----
  "Receipt": "Reçu",
  "People present": "Personnes présentes",
  "Tip": "Pourboire",
  "No tip": "Sans pourboire",
  "Custom amount…": "Montant personnalisé…",
  "Tip amount": "Montant du pourboire",
  "e.g. 5.00": "ex. 5,00",
  "Bill (from receipt):": "Addition (sur le reçu) :",
  "Total (saved to report):": "Total (enregistré) :",
  "Why this receipt is flagged": "Pourquoi ce reçu est signalé",
  "Acknowledge — this is a separate expense": "Confirmer — c'est une dépense distincte",
  "Acknowledge — I know this is over the limit": "Confirmer — je sais que la limite est dépassée",
  "Acknowledge override": "Confirmer la modification",

  // ----- Reports -----
  "Monthly reports": "Rapports mensuels",
  "Generate a report": "Générer un rapport",
  "Month": "Mois",
  "Report language": "Langue du rapport",
  "All companies (combined PDF)": "Toutes les sociétés (PDF combiné)",
  "All currencies": "Toutes les devises",
  "Generate": "Générer",
  "Generating…": "Génération…",
  "Open PDF": "Ouvrir le PDF",
  "Download PDF": "Télécharger le PDF",
  "Emailing…": "Envoi…",
  "Personal": "Personnel",
  "Open camera": "Ouvrir l'appareil photo",
  "Pick photo(s) or PDF from files": "Choisir photo(s) ou PDF depuis les fichiers",
  "Building PDF & uploading…": "Création du PDF et envoi…",
  "Save & close": "Enregistrer et fermer",
  "Cur": "Dev",
  "Custom range…": "Période personnalisée…",
  "Descriptions and categories are translated. Establishment names stay exactly as printed on the receipts.": "Les descriptions et catégories sont traduites. Les noms des établissements restent exactement tels qu'imprimés sur les reçus.",
  // ----- Settings -----
  "How this works": "Comment ça marche",
  "Searchable answers + ask-a-question box": "Réponses consultables + boîte à questions",
  "Team": "Équipe",
  "Manage team members": "Gérer les membres de l'équipe",
  "Add or remove people who can sign in": "Ajouter ou retirer des personnes",
  "My profile": "Mon profil",
  "Personal details": "Informations personnelles",
  "Name, address, bank details (used on invoices)": "Nom, adresse, coordonnées bancaires (pour les factures)",
  "Edit": "Modifier",
  "Trash": "Corbeille",
  "Deleted receipts appear here for 30 days, then they're gone for good.": "Les reçus supprimés restent ici 30 jours, puis disparaissent définitivement.",
  "Unknown vendor": "Fournisseur inconnu",
  "Restore": "Restaurer",
  "Restoring…": "Restauration…",
  "Companies": "Sociétés",
  "Categories": "Catégories",
  "People": "Personnes",
  "Currencies": "Devises",
  "No entries yet.": "Aucune entrée pour l'instant.",
  "+ Add company": "+ Ajouter une société",
  "Add a person": "Ajouter une personne",
  "Currency name": "Nom de la devise",
  "New category name": "Nom de la nouvelle catégorie",
  "No limit": "Sans limite",
  "Add": "Ajouter",
  "+ Add category": "+ Ajouter une catégorie",
  "Spending limit is per receipt. Anything over it gets flagged in Issues until the team member acknowledges it.": "La limite de dépense s'applique par reçu. Tout dépassement est signalé dans Anomalies jusqu'à confirmation par le membre de l'équipe.",
  "Categories are managed by the admin. Ask Carl to add a new one if you need it.": "Les catégories sont gérées par l'administrateur. Demandez à Carl d'en ajouter une si besoin.",
  // ----- My profile -----
  "App language": "Langue de l'application",
  "Identity": "Identité",
  "Address": "Adresse",
  "Payment details": "Coordonnées de paiement",
  "Payment instructions": "Instructions de paiement",
  "Full name": "Nom complet",
  "Business name": "Raison sociale",
  "Email": "E-mail",
  "Phone": "Téléphone",
  "Address line 1": "Adresse ligne 1",
  "Address line 2": "Adresse ligne 2",
  "Country": "Pays",
  "VAT / Tax number": "Numéro de TVA",
  "Your full name": "Votre nom complet",
  "Street address": "Adresse (rue)",
  "City, region, postcode": "Ville, région, code postal",
  "Your country": "Votre pays",
  "Optional": "Facultatif",
  "Translating…": "Traduction…",
  "Translate my existing receipt descriptions": "Traduire les descriptions de mes reçus existants",
  // ----- Prose, banners, dialogs, errors -----
  "Language": "Langue",
  "Amount must be a positive number (e.g. 12.50). Letters aren't allowed.": "Le montant doit être un nombre positif (ex. 12,50). Les lettres ne sont pas autorisées.",
  "Amount must be a positive number (e.g. 12.50).": "Le montant doit être un nombre positif (ex. 12,50).",
  "Receipt date is in the future — please pick today or earlier.": "La date du reçu est dans le futur — choisissez aujourd'hui ou une date antérieure.",
  "Delete this receipt? It moves to Trash for 30 days, then it's gone for good.": "Supprimer ce reçu ? Il sera placé dans la corbeille pendant 30 jours, puis définitivement supprimé.",
  "OCR vs your edits — please review": "Lecture du reçu vs vos modifications — veuillez vérifier",
  "OCR failed to process this receipt. Fill in the amount, currency, and date manually below.": "La lecture automatique de ce reçu a échoué. Saisissez le montant, la devise et la date manuellement ci-dessous.",
  "No amount was extracted from this receipt. Enter the amount manually in the Amount field below.": "Aucun montant n'a été extrait de ce reçu. Saisissez-le manuellement dans le champ Montant ci-dessous.",
  "Clicking confirms you're intentionally claiming this even though it matches another receipt. If it really is a duplicate, delete one instead.": "Cliquer confirme que vous soumettez volontairement cette dépense bien qu'elle corresponde à un autre reçu. S'il s'agit vraiment d'un doublon, supprimez-en un.",
  "Clicking records that you're knowingly claiming an over-limit expense and clears the Issues flag. The acknowledgement stays on the receipt's record.": "Cliquer enregistre que vous soumettez sciemment une dépense au-dessus de la limite et retire le signalement. La confirmation reste dans l'historique du reçu.",
  "This receipt is": "Ce reçu est de",
  "over the": "au-dessus de la limite de",
  "limit for": "pour",
  "Over the spending limit": "Limite de dépense dépassée",
  "No internet detected.": "Pas de connexion internet.",
  "Photos taken in this app are not yet saved while offline — they'd be lost when the upload fails. As a fallback right now: take the photo with your phone's Camera app, then email it to": "Les photos prises dans l'application ne sont pas encore sauvegardées hors ligne — elles seraient perdues si l'envoi échoue. En attendant : prenez la photo avec l'appareil photo de votre téléphone, puis envoyez-la par e-mail à",
  "Your mail app's outbox will queue and send it when you're back online.": "Votre application e-mail l'enverra automatiquement dès le retour de la connexion.",
  "Open camera, take the first page, then tap \"+ Add another page\" on the preview to keep going. All pages are combined into one PDF receipt.": "Ouvrez l'appareil photo, prenez la première page, puis touchez « + Ajouter une page » sur l'aperçu pour continuer. Toutes les pages sont combinées en un seul reçu PDF.",
  "in the file picker, tap-and-hold on iPhone or Cmd-click on Mac to select multiple files at once. Each becomes its own receipt.": "dans le sélecteur de fichiers, maintenez le doigt (iPhone) ou Cmd-clic (Mac) pour sélectionner plusieurs fichiers à la fois. Chacun devient un reçu distinct.",
  "No signal? Use your Camera app and email to": "Pas de réseau ? Utilisez votre appareil photo et envoyez par e-mail à",
  "These details appear at the top of every monthly invoice (BILL FROM block) and in the payment-details footer.": "Ces informations apparaissent en haut de chaque facture mensuelle et dans le pied de page des coordonnées de paiement.",
  // ----- Help & FAQ page -----
  "Search the FAQ… (e.g. duplicate, email, tip)": "Rechercher dans la FAQ… (ex. doublon, e-mail, pourboire)",
  "Nothing matches": "Aucun résultat pour",
  "Try the question box above, or email": "Essayez la boîte à questions ci-dessus, ou écrivez à",
  "How do I…?": "Comment faire… ?",
  "Ask anything — e.g. how do I forward a receipt by email?": "Posez votre question — ex. comment transférer un reçu par e-mail ?",
  "Thinking…": "Réflexion…",
  "Ask": "Demander",
  "Answers usage questions only — it can't see your receipts or change anything.": "Répond uniquement aux questions d'utilisation — sans accès à vos reçus et sans rien modifier.",
  // ----- Concierge -----
  "Concierge": "Concierge",
  "Send": "Envoyer",
  "Message the Concierge…": "Écrivez au Concierge…",
  "Ask me about your expenses, or tell me to record one:": "Posez-moi une question sur vos dépenses, ou demandez-moi d'en enregistrer une :",
  "How much did I spend on meals last month?": "Combien ai-je dépensé en repas le mois dernier ?",
  "Record a 4.50 coffee at Starbeans today, category Meals": "Enregistre un café à 4,50 chez Starbeans aujourd'hui, catégorie Repas",
  "Which receipts still have issues?": "Quels reçus ont encore des anomalies ?",
  "I can only see and change YOUR receipts. Team and settings changes happen in Settings.": "Je ne vois et ne modifie que VOS reçus. L'équipe et les réglages se gèrent dans Réglages.",
  "Confirm delete": "Confirmer la suppression",
  "Done — moved to Trash (restorable for 30 days).": "C'est fait — déplacé dans la corbeille (restaurable pendant 30 jours).",
  "Okay — cancelled, nothing was deleted.": "D'accord — annulé, rien n'a été supprimé.",
};
