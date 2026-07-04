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
  q_pt: string;
  a_pt: string;
  keywords?: string; // extra search terms not present in q/a
}

export const FAQ: FaqItem[] = [
  {
    q: "How do I add an expense?",
    a: "Three ways. 1) Camera: tap the camera button on the home screen and snap the receipt — vendor, amount, date and currency are read automatically. 2) Email: forward any receipt to receipts@esprey.net from a registered address. 3) Manual entry: for cash with no receipt, tap Manual entry and fill in at least the amount.",
    q_fr: "Comment ajouter une dépense ?",
    a_fr: "Trois façons. 1) Photo : touchez le bouton appareil photo sur l'écran d'accueil et photographiez le reçu — fournisseur, montant, date et devise sont lus automatiquement. 2) E-mail : transférez n'importe quel reçu à receipts@esprey.net depuis une adresse enregistrée. 3) Saisie manuelle : pour de l'espèce sans reçu, touchez Saisie manuelle et renseignez au moins le montant.",
    q_pt: "Como adiciono uma despesa?",
    a_pt: "Três formas. 1) Foto: toque no botão da câmara no ecrã inicial e fotografe o recibo — fornecedor, montante, data e moeda são lidos automaticamente. 2) E-mail: reencaminhe qualquer recibo para receipts@esprey.net a partir de um endereço registado. 3) Registo manual: para dinheiro sem recibo, toque em Registo manual e preencha pelo menos o montante.",
    keywords: "capture photo scan new receipt create ajouter nouvelle",
  },
  {
    q: "How do I email a receipt in?",
    a: "Forward it to receipts@esprey.net from one of your registered email addresses. PDFs, photos, and text-only confirmations (Uber, Airbnb, airlines) all work — it appears in your dashboard within a minute, fully read. If you forward from an address the app doesn't know, you get a bounce-back; ask the admin (cesprey@gmail.com) to add that address as an alias on your account.",
    q_fr: "Comment envoyer un reçu par e-mail ?",
    a_fr: "Transférez-le à receipts@esprey.net depuis l'une de vos adresses e-mail enregistrées. PDF, photos et confirmations texte (Uber, Airbnb, compagnies aériennes) fonctionnent — le reçu apparaît dans votre tableau de bord en moins d'une minute, entièrement lu. Si vous l'envoyez depuis une adresse inconnue, vous recevrez un message de rejet ; demandez à l'administrateur (cesprey@gmail.com) d'ajouter cette adresse comme alias sur votre compte.",
    q_pt: "Como envio um recibo por e-mail?",
    a_pt: "Reencaminhe-o para receipts@esprey.net a partir de um dos seus endereços de e-mail registados. PDF, fotos e confirmações de texto (Uber, Airbnb, companhias aéreas) funcionam — o recibo aparece no seu painel em menos de um minuto, totalmente lido. Se enviar de um endereço desconhecido, receberá uma mensagem de rejeição; peça ao administrador (cesprey@gmail.com) para adicionar esse endereço como alias na sua conta.",
    keywords: "forward inbox alias bounce unregistered transférer",
  },
  {
    q: "How do I capture a multi-page receipt or invoice?",
    a: "After the first photo, the preview screen shows an \"+ Add another page\" button. Keep snapping — all pages are combined into a single PDF receipt and the total is found wherever it appears.",
    q_fr: "Comment photographier un reçu ou une facture de plusieurs pages ?",
    a_fr: "Après la première photo, l'écran d'aperçu affiche un bouton « + Ajouter une page ». Continuez à photographier — toutes les pages sont combinées en un seul reçu PDF et le total est trouvé où qu'il apparaisse.",
    q_pt: "Como fotografo um recibo ou fatura de várias páginas?",
    a_pt: "Depois da primeira foto, o ecrã de pré-visualização mostra um botão «+ Adicionar página». Continue a fotografar — todas as páginas são combinadas num único recibo PDF e o total é encontrado onde quer que apareça.",
    keywords: "pages long invoice combine pdf plusieurs",
  },
  {
    q: "What does the Issues count on the dashboard mean?",
    a: "Issues collects receipts that need your attention, each with a reason chip: OCR failed (couldn't read the receipt), no amount extracted, possible duplicate, edited values differ from what was read off the receipt, or over the category spending limit. Fix the data or acknowledge the flag and the receipt drops out of Issues.",
    q_fr: "Que signifie le compteur Anomalies sur le tableau de bord ?",
    a_fr: "Anomalies regroupe les reçus qui demandent votre attention, chacun avec un motif : échec de lecture, montant manquant, doublon possible, valeurs modifiées par rapport au reçu, ou dépassement de la limite de catégorie. Corrigez les données ou confirmez le signalement et le reçu sort des Anomalies.",
    q_pt: "O que significa o contador Anomalias no painel?",
    a_pt: "Anomalias agrupa os recibos que precisam da sua atenção, cada um com um motivo: falha na leitura, montante em falta, possível duplicado, valores editados diferentes do recibo, ou limite de categoria ultrapassado. Corrija os dados ou confirme a sinalização e o recibo sai das Anomalias.",
    keywords: "flagged orange red highlight warning pill signalé",
  },
  {
    q: "What is a possible duplicate and how do I clear it?",
    a: "Two receipts with the same vendor, amount and date get flagged as possible duplicates. Open the receipt and check the matching ones linked in the banner. If it really is the same expense twice, delete one. If they're genuinely separate (two identical coffees, say), press Acknowledge — this records that you're intentionally claiming both, and the flag clears.",
    q_fr: "Qu'est-ce qu'un doublon possible et comment le résoudre ?",
    a_fr: "Deux reçus avec le même fournisseur, le même montant et la même date sont signalés comme doublons possibles. Ouvrez le reçu et vérifiez les reçus correspondants indiqués dans la bannière. S'il s'agit vraiment de la même dépense en double, supprimez-en un. S'il s'agit de dépenses distinctes (deux cafés identiques, par exemple), touchez Confirmer — cela enregistre votre choix et retire le signalement.",
    q_pt: "O que é um possível duplicado e como o resolvo?",
    a_pt: "Dois recibos com o mesmo fornecedor, montante e data são sinalizados como possíveis duplicados. Abra o recibo e verifique os recibos correspondentes indicados na faixa. Se for mesmo a mesma despesa em duplicado, elimine um. Se forem despesas distintas (dois cafés iguais, por exemplo), toque em Confirmar — isso regista a sua decisão e remove a sinalização.",
    keywords: "duplicate same twice acknowledge doublon",
  },
  {
    q: "Why does it say my edited values differ from OCR?",
    a: "If you change the amount, currency or date away from what was read off the receipt image, the app asks you to acknowledge the difference. This is an audit trail: it records that the change was deliberate. Press Acknowledge in the banner if your edit is correct.",
    q_fr: "Pourquoi indique-t-on que mes valeurs modifiées diffèrent de la lecture ?",
    a_fr: "Si vous modifiez le montant, la devise ou la date par rapport à ce qui a été lu sur le reçu, l'application vous demande de confirmer la différence. C'est une piste d'audit : elle enregistre que le changement était volontaire. Touchez Confirmer dans la bannière si votre modification est correcte.",
    q_pt: "Porque diz que os meus valores editados diferem da leitura?",
    a_pt: "Se alterar o montante, a moeda ou a data em relação ao que foi lido no recibo, a aplicação pede-lhe que confirme a diferença. É um registo de auditoria: fica registado que a alteração foi deliberada. Toque em Confirmar na faixa se a sua alteração estiver correta.",
    keywords: "mismatch override changed edited banner modifié",
  },
  {
    q: "What is a spending limit and why is my receipt over it?",
    a: "The admin can set a per-receipt limit on any category (for example 80 for Meals). A receipt over its category's limit is flagged in Issues and shows an orange banner. You can still claim it — press Acknowledge to record that you know it's over the limit. The acknowledgement stays on the receipt's record.",
    q_fr: "Qu'est-ce qu'une limite de dépense et pourquoi mon reçu la dépasse-t-il ?",
    a_fr: "L'administrateur peut fixer une limite par reçu sur chaque catégorie (par exemple 80 pour les repas). Un reçu au-dessus de la limite de sa catégorie est signalé dans Anomalies avec une bannière orange. Vous pouvez quand même le soumettre — touchez Confirmer pour indiquer que vous savez qu'il dépasse la limite. La confirmation reste dans l'historique du reçu.",
    q_pt: "O que é um limite de despesa e porque é que o meu recibo o ultrapassa?",
    a_pt: "O administrador pode definir um limite por recibo em cada categoria (por exemplo 80 para refeições). Um recibo acima do limite da sua categoria é sinalizado em Anomalias com uma faixa laranja. Pode mesmo assim submetê-lo — toque em Confirmar para registar que sabe que ultrapassa o limite. A confirmação fica no histórico do recibo.",
    keywords: "policy limit cap over budget category limite dépassement",
  },
  {
    q: "How do I delete a receipt, and what is Trash?",
    a: "Open the receipt and press Delete. It moves to Trash (Settings → Trash) where it stays for 30 days — press Restore there if you change your mind. After 30 days it's permanently gone, including the stored image.",
    q_fr: "Comment supprimer un reçu, et qu'est-ce que la corbeille ?",
    a_fr: "Ouvrez le reçu et touchez Supprimer. Il est placé dans la corbeille (Réglages → Corbeille) pendant 30 jours — touchez Restaurer si vous changez d'avis. Après 30 jours, il est définitivement supprimé, image comprise.",
    q_pt: "Como elimino um recibo, e o que é o Lixo?",
    a_pt: "Abra o recibo e toque em Eliminar. Vai para o Lixo (Definições → Lixo) durante 30 dias — toque em Restaurar se mudar de ideias. Após 30 dias desaparece definitivamente, incluindo a imagem guardada.",
    keywords: "remove undo restore recover bin supprimer restaurer",
  },
  {
    q: "How do tips work on meals and taxis?",
    a: "For meal and taxi categories a Tip selector appears. Enter the bill exactly as printed on the receipt, then pick a percentage (5–20%) or enter a custom tip amount. The report shows the total (bill + tip); the receipt image still matches the bill, which is what the OCR checks against.",
    q_fr: "Comment fonctionnent les pourboires pour les repas et taxis ?",
    a_fr: "Pour les catégories repas et taxi, un sélecteur Pourboire apparaît. Saisissez l'addition exactement comme imprimée sur le reçu, puis choisissez un pourcentage (5–20 %) ou un montant personnalisé. Le rapport affiche le total (addition + pourboire) ; l'image du reçu correspond toujours à l'addition, ce que vérifie la lecture automatique.",
    q_pt: "Como funcionam as gorjetas em refeições e táxis?",
    a_pt: "Nas categorias de refeições e táxi aparece um seletor de Gorjeta. Introduza a conta exatamente como impressa no recibo, depois escolha uma percentagem (5–20%) ou um valor personalizado. O relatório mostra o total (conta + gorjeta); a imagem do recibo continua a corresponder à conta, que é o que a leitura automática verifica.",
    keywords: "gratuity service percentage restaurant pourboire",
  },
  {
    q: "How do I generate a monthly report?",
    a: "Go to Reports from the home screen. Pick the month (defaults to last month), optionally one company (otherwise a combined report), optionally a target currency, and the report language. Press Generate, then use the buttons: Open PDF to view, Download PDF to save it, Email PDF to send it to yourself, and Download originals for a ZIP of the receipt files. Nothing is emailed unless you press the email button.",
    q_fr: "Comment générer un rapport mensuel ?",
    a_fr: "Allez dans Rapports depuis l'écran d'accueil. Choisissez le mois (par défaut le mois dernier), éventuellement une société (sinon rapport combiné), éventuellement une devise cible, et la langue du rapport. Touchez Générer, puis utilisez les boutons : Ouvrir le PDF, Télécharger le PDF, Envoyer le PDF par e-mail, et Télécharger les originaux (ZIP). Rien n'est envoyé par e-mail sans que vous touchiez le bouton d'envoi.",
    q_pt: "Como gero um relatório mensal?",
    a_pt: "Vá a Relatórios no ecrã inicial. Escolha o mês (por omissão o mês passado), opcionalmente uma empresa (senão relatório combinado), opcionalmente uma moeda de destino, e o idioma do relatório. Toque em Gerar e use os botões: Abrir o PDF, Transferir o PDF, Enviar o PDF por e-mail, e Transferir os originais (ZIP). Nada é enviado por e-mail sem que toque no botão de envio.",
    keywords: "invoice month pdf zip send export rapport facture",
  },
  {
    q: "Can reports be in a different language from the app?",
    a: "Yes. The report language dropdown on the Reports page is independent of your app language — a French-speaking user can generate an English report and vice versa. Descriptions and categories are translated; establishment names, amounts, dates and currencies stay exactly as on the receipts.",
    q_fr: "Le rapport peut-il être dans une autre langue que l'application ?",
    a_fr: "Oui. Le menu Langue du rapport sur la page Rapports est indépendant de la langue de l'application — un utilisateur francophone peut générer un rapport en anglais et inversement. Les descriptions et catégories sont traduites ; les noms d'établissements, montants, dates et devises restent exactement comme sur les reçus.",
    q_pt: "O relatório pode estar num idioma diferente da aplicação?",
    a_pt: "Sim. O menu Idioma do relatório na página Relatórios é independente do idioma da aplicação — um utilizador lusófono pode gerar um relatório em inglês e vice-versa. As descrições e categorias são traduzidas; os nomes dos estabelecimentos, montantes, datas e moedas permanecem exatamente como nos recibos.",
    keywords: "language translate french english langue traduction",
  },
  {
    q: "Do attendees show up in reports?",
    a: "Yes. Tag people on a receipt (the People field) and the monthly report's category-breakdown page shows a small \"with …\" line under that receipt, so meal and hotel claims carry their context. Your people list is private to you.",
    q_fr: "Les personnes présentes apparaissent-elles dans les rapports ?",
    a_fr: "Oui. Indiquez les personnes sur un reçu (champ Personnes présentes) et la page de ventilation par catégorie du rapport mensuel affiche une petite ligne « avec … » sous ce reçu. Votre liste de personnes reste privée.",
    q_pt: "As pessoas presentes aparecem nos relatórios?",
    a_pt: "Sim. Indique as pessoas num recibo (campo Pessoas presentes) e a página de detalhe por categoria do relatório mensal mostra uma pequena linha «com …» sob esse recibo. A sua lista de pessoas é privada.",
    keywords: "people guests who was present breakdown invités",
  },
  {
    q: "How does currency conversion in reports work?",
    a: "If you pick a target currency, every receipt is converted using the exchange rate from the day the receipt was captured — not today's rate — so regenerating an old report gives the same numbers. Receipts from before this feature use current rates. The rate source and dates are printed at the bottom of the report.",
    q_fr: "Comment fonctionne la conversion de devises dans les rapports ?",
    a_fr: "Si vous choisissez une devise cible, chaque reçu est converti au taux de change du jour où il a été capturé — pas au taux du jour — donc regénérer un ancien rapport donne les mêmes chiffres. Les reçus antérieurs à cette fonction utilisent les taux actuels. La source des taux et les dates figurent en bas du rapport.",
    q_pt: "Como funciona a conversão de moedas nos relatórios?",
    a_pt: "Se escolher uma moeda de destino, cada recibo é convertido à taxa de câmbio do dia em que foi capturado — não à taxa de hoje — pelo que regenerar um relatório antigo dá os mesmos números. Recibos anteriores a esta funcionalidade usam as taxas atuais. A fonte das taxas e as datas constam no fim do relatório.",
    keywords: "fx exchange rate convert eur usd gbp xof taux change",
  },
  {
    q: "What's private to me and what's shared?",
    a: "Private to you: your receipts, your reports, your people/attendees list, and your profile (name, address, bank details). Shared team-wide and curated by the admin: the companies list, the categories list (and their spending limits), and supported currencies. Need a new company or alias? Ask the admin at cesprey@gmail.com.",
    q_fr: "Qu'est-ce qui est privé et qu'est-ce qui est partagé ?",
    a_fr: "Privé : vos reçus, vos rapports, votre liste de personnes, et votre profil (nom, adresse, coordonnées bancaires). Partagé pour toute l'équipe et géré par l'administrateur : la liste des sociétés, la liste des catégories (et leurs limites de dépense), et les devises. Besoin d'une nouvelle société ou d'un alias ? Écrivez à l'administrateur : cesprey@gmail.com.",
    q_pt: "O que é privado e o que é partilhado?",
    a_pt: "Privado: os seus recibos, os seus relatórios, a sua lista de pessoas e o seu perfil (nome, morada, dados bancários). Partilhado por toda a equipa e gerido pelo administrador: a lista de empresas, a lista de categorias (e os seus limites de despesa) e as moedas. Precisa de uma nova empresa ou de um alias? Escreva ao administrador: cesprey@gmail.com.",
    keywords: "privacy who can see admin visibility privé confidentialité",
  },
  {
    q: "What should I set up first?",
    a: "Go to Settings → My Profile and fill in your name, address, VAT number if you have one, and bank details (free text — IBAN, sort code, whatever the payer needs). These appear at the top of every invoice you generate, so do it once before your first report. You can also pick your app language there.",
    q_fr: "Que dois-je configurer en premier ?",
    a_fr: "Allez dans Réglages → Mon profil et renseignez votre nom, adresse, numéro de TVA le cas échéant, et vos coordonnées bancaires (texte libre — IBAN ou ce dont le payeur a besoin). Ces informations apparaissent en haut de chaque facture générée : faites-le une fois avant votre premier rapport. Vous pouvez aussi y choisir la langue de l'application.",
    q_pt: "O que devo configurar primeiro?",
    a_pt: "Vá a Definições → O meu perfil e preencha o seu nome, morada, número de IVA se tiver, e os dados bancários (texto livre — IBAN ou o que o pagador precisar). Estes dados aparecem no topo de cada fatura gerada: faça-o uma vez antes do primeiro relatório. Também pode escolher aí o idioma da aplicação.",
    keywords: "profile bank details onboarding first time setup profil banque",
  },
  {
    q: "How do I install the app on my phone?",
    a: "iPhone: open expenses.esprey.net in Safari, tap Share, then \"Add to Home Screen\". Android: open it in Chrome and choose \"Install app\". The icon then opens the app full-screen like a native app.",
    q_fr: "Comment installer l'application sur mon téléphone ?",
    a_fr: "iPhone : ouvrez expenses.esprey.net dans Safari, touchez Partager, puis « Sur l'écran d'accueil ». Android : ouvrez-le dans Chrome et choisissez « Installer l'application ». L'icône ouvre ensuite l'application en plein écran, comme une application native.",
    q_pt: "Como instalo a aplicação no telemóvel?",
    a_pt: "iPhone: abra expenses.esprey.net no Safari, toque em Partilhar e depois em «Adicionar ao ecrã principal». Android: abra no Chrome e escolha «Instalar aplicação». O ícone passa a abrir a aplicação em ecrã inteiro, como uma aplicação nativa.",
    keywords: "pwa home screen icon ios android install installer téléphone",
  },
  {
    q: "What if I have no signal when I get a receipt?",
    a: "Take the photo with your phone's normal Camera app, then email it to receipts@esprey.net. Your mail app queues the send and delivers it when you're back online — no expense lost.",
    q_fr: "Que faire si je n'ai pas de réseau au moment du reçu ?",
    a_fr: "Prenez la photo avec l'appareil photo normal de votre téléphone, puis envoyez-la par e-mail à receipts@esprey.net. Votre application e-mail mettra l'envoi en attente et le livrera au retour du réseau — aucune dépense perdue.",
    q_pt: "E se não tiver rede quando recebo um recibo?",
    a_pt: "Tire a foto com a câmara normal do telemóvel e envie-a por e-mail para receipts@esprey.net. A sua aplicação de e-mail coloca o envio em espera e entrega-o quando a ligação voltar — nenhuma despesa se perde.",
    keywords: "offline no internet airplane remote field hors ligne réseau",
  },
  {
    q: "Who do I contact for help?",
    a: "Email Carl Esprey at cesprey@gmail.com — for anything the app can't answer: adding a company, registering an email alias, changing spending limits, or fixing your account.",
    q_fr: "Qui contacter pour obtenir de l'aide ?",
    a_fr: "Écrivez à Carl Esprey : cesprey@gmail.com — pour tout ce que l'application ne peut pas résoudre : ajouter une société, enregistrer un alias e-mail, modifier des limites de dépense, ou réparer votre compte.",
    q_pt: "Quem contacto para obter ajuda?",
    a_pt: "Escreva a Carl Esprey: cesprey@gmail.com — para tudo o que a aplicação não resolver: adicionar uma empresa, registar um alias de e-mail, alterar limites de despesa ou reparar a sua conta.",
    keywords: "support contact admin problem stuck aide contact",
  },
];

/** The FAQ as one plain-text block — grounding for the AI help widget.
 *  English is the canonical version; the widget answers in the user's language. */
export function faqAsText(): string {
  return FAQ.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n");
}
