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
};
