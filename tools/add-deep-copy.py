#!/usr/bin/env python3
"""
Adds the deep-flow copy to locales/{fr,de,it}.json.

This is everything below the marketing surface: the listing wizard, the
verification desk, the fee and rules panels, the lease-takeover desk, the
lead and viewing forms, the trust ledger, the payment-rail warnings, the
stay-type blurbs in data.js.

One table, three languages side by side, because that is the only layout in
which a drift between them is visible. Run once:

    python3 tools/add-deep-copy.py

It is additive — an existing key is never overwritten, so a hand-corrected
translation survives a re-run.

Two rules held throughout, and they are why this is not a machine pass:

  1. A statute keeps its own language and its own numbering. The sentence
     around it is translated; "§ 226-b", "FARE Act", "bail mobilite",
     "Zweckentfremdungsverbot" are not. Where the English describes a New
     York rule, the French says so about the New York rule — it does not
     quietly become French law.
  2. Money, consent and fraud wording is translated conservatively. "Wire
     transfer is effectively unrecoverable" has to land as hard in German as
     it does in English; softening it to sound natural would be a mistranslation
     of the thing that actually matters.
"""
import collections
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# English -> (French, German, Italian)
T = {

# ---------------------------------------------------------------- data.js
# The stay-type blurbs and promises, which drive the type cards everywhere.
"A private bedroom in a shared home. Split rent, keep your own door.": (
 "Une chambre privée dans un logement partagé. Loyer partagé, porte bien à vous.",
 "Ein eigenes Zimmer in einer geteilten Wohnung. Miete geteilt, eigene Tür.",
 "Una camera tua in una casa condivisa. Affitto diviso, porta solo tua."),
"Housemate profiles, private-bath filter, and vibe tags before you tour.": (
 "Profils des colocataires, filtre salle de bain privative et étiquettes d'ambiance, avant la visite.",
 "Mitbewohnerprofile, Filter für eigenes Bad und Atmosphäre-Tags, schon vor der Besichtigung.",
 "Profili dei coinquilini, filtro bagno privato ed etichette sull'atmosfera, prima della visita."),
"Designed buildings with community, cleaning, and flexible terms.": (
 "Des résidences conçues pour ça : communauté, ménage et conditions souples.",
 "Geplante Häuser mit Gemeinschaft, Reinigung und flexiblen Konditionen.",
 "Edifici progettati apposta, con comunità, pulizie e condizioni flessibili."),
"Bed-level inventory, events, and all-in rent — not a mystery house share.": (
 "Disponibilité au lit près, événements et loyer tout compris — pas une colocation mystère.",
 "Verfügbarkeit bis aufs Bett, Veranstaltungen und Warmmiete — keine WG mit Überraschung.",
 "Disponibilità fino al singolo letto, eventi e affitto tutto compreso — non una convivenza a sorpresa."),
"Move in with a suitcase. Furniture, kitchen, and workspace included.": (
 "Emménagez avec une valise. Mobilier, cuisine et espace de travail compris.",
 "Mit einem Koffer einziehen. Möbel, Küche und Arbeitsplatz inklusive.",
 "Entra con una valigia. Mobili, cucina e postazione di lavoro inclusi."),
"Furniture inventory on every listing. No “bring your own bed” surprises.": (
 "Un inventaire du mobilier sur chaque annonce. Aucune surprise du type « apportez votre lit ».",
 "Ein Möbelverzeichnis in jedem Inserat. Keine Überraschung à la „Bett bitte mitbringen“.",
 "Un inventario dell'arredamento in ogni annuncio. Nessuna sorpresa del tipo «porta il tuo letto»."),
"Mid-term apartments. 30-day minimum — homes, not hotel nights.": (
 "Des appartements moyenne durée. 30 jours minimum — des logements, pas des nuits d'hôtel.",
 "Wohnungen auf Zeit. Mindestens 30 Tage — Wohnungen, keine Hotelnächte.",
 "Appartamenti a media durata. Minimo 30 giorni — case, non notti d'albergo."),
"Stay length is a first-class filter. Built for relos, contracts, and pilots.": (
 "La durée du séjour est un filtre à part entière. Pensé pour les mutations, les missions et les périodes d'essai.",
 "Die Mietdauer ist ein eigenständiger Filter. Gemacht für Umzüge, befristete Aufträge und Probephasen.",
 "La durata del soggiorno è un filtro a pieno titolo. Pensato per trasferimenti, incarichi a termine e progetti pilota."),
"Serviced apartments from hotel operators — housekeeping in, nightly rates out.": (
 "Des résidences services d'opérateurs hôteliers — le ménage compris, les tarifs à la nuit exclus.",
 "Serviced Apartments von Hotelbetreibern — Reinigung drin, Nachtpreise draußen.",
 "Appartamenti con servizi di operatori alberghieri — pulizie incluse, tariffe a notte escluse."),
"Hotel groups can list here, but only stays of 30 days or more. Still no nightly bookings.": (
 "Les groupes hôteliers peuvent publier ici, mais seulement des séjours de 30 jours ou plus. Toujours pas de réservation à la nuit.",
 "Hotelgruppen dürfen hier inserieren, aber nur Aufenthalte ab 30 Tagen. Nach wie vor keine Buchung pro Nacht.",
 "I gruppi alberghieri possono pubblicare qui, ma solo soggiorni di 30 giorni o più. Niente prenotazioni a notte."),
"Take over a remaining lease. See days left, assignment vs sublet.": (
 "Reprenez la fin d'un bail. Jours restants, cession ou sous-location.",
 "Übernehmen Sie einen laufenden Mietvertrag. Resttage, Vertragsübernahme oder Untermiete.",
 "Subentra in un contratto in corso. Giorni residui, cessione o subaffitto."),
"Lease Clock, takeover math, and the remaining term shown before anyone has to ask.": (
 "Compteur de bail, calcul de la reprise et durée restante affichée avant même qu'on la demande.",
 "Vertragsuhr, die Rechnung zur Übernahme und die Restlaufzeit, bevor jemand danach fragen muss.",
 "Contatore del contratto, i conti del subentro e la durata residua mostrata prima che qualcuno la chieda."),
"Kitchen": ("Cuisine", "Küche", "Cucina"),
"Living room": ("Salon", "Wohnzimmer", "Soggiorno"),
"Street": ("Rue", "Straße", "Strada"),
"Walkthrough of the room and common spaces": (
 "Visite de la chambre et des espaces communs",
 "Rundgang durch das Zimmer und die Gemeinschaftsräume",
 "Tour della stanza e degli spazi comuni"),
"Host video tour — kitchen, bath, and bedroom": (
 "Visite vidéo par l'hôte — cuisine, salle de bain et chambre",
 "Videorundgang des Anbieters — Küche, Bad und Zimmer",
 "Tour video dell'host — cucina, bagno e camera"),
"Furnished walkthrough": ("Visite du meublé", "Rundgang durch die möblierte Wohnung", "Tour dell'arredato"),
"Bedroom and light tour": ("Chambre et lumière", "Zimmer und Lichtverhältnisse", "Camera e luce"),
"Apartment video tour": ("Visite vidéo de l'appartement", "Videorundgang der Wohnung", "Tour video dell'appartamento"),
"Pet friendly": ("Animaux bienvenus", "Haustierfreundlich", "Animali benvenuti"),
"Month-to-month": ("Au mois", "Monatsweise", "Di mese in mese"),

# ---------------------------------------------------------------- script.js
"Try a longer stay window, a wider all-in budget, or drop a must-have. Rooms and lease-breaks move fast, so alerts beat refreshing.": (
 "Essayez une période plus large, un budget tout compris plus élevé, ou retirez un critère indispensable. Les chambres et les reprises de bail partent vite : une alerte vaut mieux qu'un rafraîchissement.",
 "Versuchen Sie einen längeren Zeitraum, ein höheres Warmmiete-Budget oder streichen Sie ein Muss-Kriterium. WG-Zimmer und Nachmieter-Angebote gehen schnell weg — eine Benachrichtigung bringt mehr als Neuladen.",
 "Prova un periodo più ampio, un budget tutto compreso più alto, oppure togli un criterio irrinunciabile. Stanze e subentri vanno via in fretta: un avviso vale più di un aggiornamento continuo."),
"Stay DNA is a local fit score — budget, stay length, vibe, and must-haves. Not a credit decision.": (
 "Stay DNA est un score d'affinité calculé en local — budget, durée, ambiance et indispensables. Ce n'est pas une décision de solvabilité.",
 "Stay DNA ist ein lokal berechneter Passungswert — Budget, Mietdauer, Atmosphäre und Muss-Kriterien. Keine Bonitätsentscheidung.",
 "Stay DNA è un punteggio di affinità calcolato in locale — budget, durata, atmosfera e criteri irrinunciabili. Non è una valutazione creditizia."),
"Applying to": ("Candidature pour", "Bewerbung für", "Candidatura per"),
"Renter passport": ("Passeport locataire", "Mieterprofil", "Profilo inquilino"),
"Reuse this on every apply. Hosts see stay length and move window — not a mystery email.": (
 "Réutilisez-le à chaque candidature. L'hôte voit la durée et la période d'emménagement — pas un e-mail sorti de nulle part.",
 "Bei jeder Bewerbung wiederverwendbar. Der Anbieter sieht Mietdauer und Einzugszeitraum — keine E-Mail aus dem Nichts.",
 "Riutilizzalo a ogni candidatura. L'host vede durata e periodo di ingresso — non una mail arrivata dal nulla."),
"Move-in window": ("Période d'emménagement", "Einzugszeitraum", "Periodo di ingresso"),
"Intended stay (months)": ("Durée envisagée (en mois)", "Geplante Mietdauer (Monate)", "Durata prevista (mesi)"),
"Income range": ("Tranche de revenus", "Einkommensspanne", "Fascia di reddito"),
"Why this stay": ("Pourquoi ce logement", "Warum diese Wohnung", "Perché questa casa"),
"I will not pay a deposit before a live tour": (
 "Je ne verserai pas de dépôt de garantie avant une visite en direct",
 "Ich zahle keine Kaution vor einer Live-Besichtigung",
 "Non verserò alcun deposito prima di una visita dal vivo"),
"List in minutes": ("Publier en quelques minutes", "In Minuten inserieren", "Pubblica in pochi minuti"),
"What are you listing?": ("Que publiez-vous ?", "Was inserieren Sie?", "Cosa stai pubblicando?"),
"Monthly rent": ("Loyer mensuel", "Monatsmiete", "Canone mensile"),
"Utilities /mo": ("Charges /mois", "Nebenkosten /Monat", "Utenze /mese"),
"Min stay (months)": ("Séjour min. (mois)", "Mindestdauer (Monate)", "Durata min. (mesi)"),
"Description": ("Description", "Beschreibung", "Descrizione"),
"All-in preview:": ("Aperçu tout compris :", "Vorschau Warmmiete:", "Anteprima tutto compreso:"),
"One price for every listing type — rooms, co-living, furnished and lease-breaks alike. Renters are never charged.": (
 "Un seul prix pour tous les types d'annonce — chambres, coliving, meublés et reprises de bail. Les locataires ne paient jamais.",
 "Ein Preis für jede Inseratsart — WG-Zimmer, Co-Living, möbliert und Nachmieter gleichermaßen. Mietern wird nie etwas berechnet.",
 "Un solo prezzo per ogni tipo di annuncio — stanze, co-living, arredati e subentri. Agli inquilini non viene mai addebitato nulla."),
"Publish listing": ("Publier l'annonce", "Inserat veröffentlichen", "Pubblica l'annuncio"),
"Add up to 3 homes from search, then come back.": (
 "Ajoutez jusqu'à 3 logements depuis la recherche, puis revenez ici.",
 "Fügen Sie bis zu 3 Wohnungen aus der Suche hinzu und kommen Sie zurück.",
 "Aggiungi fino a 3 case dalla ricerca, poi torna qui."),
"flexible homes": ("logements flexibles", "flexible Wohnungen", "case flessibili"),
"Flexible housing on RentLeaks": (
 "Le logement flexible sur RentLeaks", "Flexibles Wohnen auf RentLeaks", "Casa flessibile su RentLeaks"),
"Market": ("Marché", "Markt", "Mercato"),
"Filters": ("Filtres", "Filter", "Filtri"),
"Private room + bath near the G": (
 "Chambre privée avec salle de bain, près du métro",
 "Eigenes Zimmer mit Bad, nah an der U-Bahn",
 "Camera con bagno privato, vicino alla metro"),

# ------------------------------------------------------------ rentleaks-x.js
# Price truth panel
"Price truth": ("La vérité sur le prix", "Preiswahrheit", "La verità sul prezzo"),
"What this actually costs, against the market": (
 "Ce que cela coûte vraiment, comparé au marché",
 "Was das wirklich kostet, gemessen am Markt",
 "Quanto costa davvero, rispetto al mercato"),
"Percentile": ("Centile", "Perzentil", "Percentile"),
"Middle half pays": ("La moitié centrale paie", "Die mittlere Hälfte zahlt", "La metà centrale paga"),
"25th to 75th percentile": ("Du 25e au 75e centile", "25. bis 75. Perzentil", "Dal 25° al 75° percentile"),
"Annual per sq ft": ("Au m² et par an", "Pro m² und Jahr", "Al m² all'anno"),
"Fees add": ("Les frais ajoutent", "Gebühren kommen hinzu", "Le spese aggiungono"),
"Priced far under this market": (
 "Bien en dessous du prix de ce marché",
 "Deutlich unter dem Niveau dieses Marktes",
 "Molto sotto il prezzo di questo mercato"),
"All-in sits": ("Le tout compris se situe", "Die Warmmiete liegt", "Il tutto compreso si colloca"),

# Fee ledger
"What you can be asked to pay": (
 "Ce qu'on peut vous demander de payer",
 "Was von Ihnen verlangt werden darf",
 "Cosa ti possono chiedere di pagare"),
"The rule people get wrong here.": (
 "La règle que tout le monde comprend de travers ici.",
 "Die Regel, die hier ständig falsch verstanden wird.",
 "La regola che qui sbagliano tutti."),
"The ban is on a": ("L'interdiction vise", "Das Verbot betrifft", "Il divieto riguarda"),
"landlord’s agent": ("l'agent du propriétaire", "den Makler des Vermieters", "l'agente del proprietario"),
"Landlord’s agent": ("Agent du propriétaire", "Makler des Vermieters", "Agente del proprietario"),
"over cap": ("au-dessus du plafond", "über der Obergrenze", "sopra il tetto"),
"not allowed": ("interdit", "nicht zulässig", "non ammesso"),
"No one-off charge of any kind sits on this listing. The all-in figure is the whole of it.": (
 "Aucun frais ponctuel, d'aucune sorte, ne pèse sur cette annonce. Le montant tout compris, c'est tout.",
 "Auf diesem Inserat liegt keinerlei einmalige Gebühr. Die Warmmiete ist der ganze Betrag.",
 "Su questo annuncio non c'è nessuna spesa una tantum, di nessun tipo. Il tutto compreso è tutto qui."),
"Application fee": ("Frais de dossier", "Bearbeitungsgebühr", "Spese di istruttoria"),
"Background & credit": ("Antécédents et solvabilité", "Auskunft und Bonität", "Referenze e affidabilità"),
"Takeover access fee": ("Frais d'accès à la reprise", "Gebühr für den Zugang zur Übernahme", "Spese di accesso al subentro"),
"A landlord’s agent may not charge the tenant here.": (
 "Sur ce marché, l'agent du propriétaire ne peut pas facturer le locataire.",
 "Auf diesem Markt darf der Makler des Vermieters dem Mieter nichts berechnen.",
 "Su questo mercato l'agente del proprietario non può addebitare nulla all'inquilino."),
"Lawful in this market. It must still be disclosed in the listing before you apply.": (
 "Légal sur ce marché. Cela doit tout de même figurer dans l'annonce avant que vous candidatiez.",
 "Auf diesem Markt zulässig. Es muss trotzdem im Inserat stehen, bevor Sie sich bewerben.",
 "Lecito su questo mercato. Deve comunque essere indicato nell'annuncio prima che tu ti candidi."),
"An application, processing or acceptance fee may not be demanded in this market at all.": (
 "Sur ce marché, aucun frais de dossier, de traitement ou d'acceptation ne peut être exigé.",
 "Auf diesem Markt darf überhaupt keine Bearbeitungs-, Prüf- oder Annahmegebühr verlangt werden.",
 "Su questo mercato non può essere richiesta alcuna spesa di istruttoria, gestione o accettazione."),
"Over the cap for this market.": (
 "Au-dessus du plafond de ce marché.",
 "Über der Obergrenze dieses Marktes.",
 "Sopra il tetto previsto per questo mercato."),
"Background and credit checks are capped at the lesser of actual cost or the statutory figure, and must be waived if you supply your own report from the last 30 days.": (
 "Les vérifications d'antécédents et de solvabilité sont plafonnées au plus bas du coût réel ou du montant légal, et doivent être annulées si vous fournissez votre propre rapport de moins de 30 jours.",
 "Auskunft und Bonitätsprüfung sind auf den niedrigeren Betrag aus tatsächlichen Kosten und gesetzlichem Höchstwert begrenzt und entfallen, wenn Sie einen eigenen Nachweis aus den letzten 30 Tagen vorlegen.",
 "Le verifiche su referenze e affidabilità sono limitate al minore tra il costo effettivo e l'importo di legge, e devono essere azzerate se fornisci una tua relazione degli ultimi 30 giorni."),
"Capped at the lesser of actual cost or": (
 "Plafonné au plus bas du coût réel ou de",
 "Begrenzt auf den niedrigeren Betrag aus tatsächlichen Kosten oder",
 "Limitato al minore tra il costo effettivo e"),
"No statutory cap recorded for this market.": (
 "Aucun plafond légal enregistré pour ce marché.",
 "Für diesen Markt ist keine gesetzliche Obergrenze hinterlegt.",
 "Nessun tetto di legge registrato per questo mercato."),
"Not charged.": ("Non facturé.", "Wird nicht erhoben.", "Non addebitato."),
"Permitted, and disclosed up front.": (
 "Autorisé, et annoncé d'emblée.",
 "Zulässig und von vornherein offengelegt.",
 "Consentito, e dichiarato fin dall'inizio."),
"A recurring charge, inside the all-in figure above.": (
 "Un frais récurrent, déjà compris dans le montant tout compris ci-dessus.",
 "Eine laufende Gebühr, bereits in der Warmmiete oben enthalten.",
 "Una spesa ricorrente, già dentro il tutto compreso qui sopra."),
"Broker fee charged to you": (
 "Honoraires d'agence à votre charge",
 "Maklerprovision zu Ihren Lasten",
 "Provvigione a tuo carico"),
"Every fee disclosed in the listing": (
 "Tous les frais annoncés dans l'annonce",
 "Jede Gebühr im Inserat offengelegt",
 "Tutte le spese dichiarate nell'annuncio"),
"Itemised": ("Détaillé", "Aufgeschlüsselt", "Dettagliato"),
"Security deposit": ("Dépôt de garantie", "Kaution", "Deposito cauzionale"),
"All-in price shown first": (
 "Le prix tout compris affiché en premier",
 "Die Warmmiete steht an erster Stelle",
 "Il prezzo tutto compreso mostrato per primo"),

# Income / voucher calculator
"Monthly household income": ("Revenu mensuel du foyer", "Monatliches Haushaltseinkommen", "Reddito mensile del nucleo"),
"Voucher / subsidy per month": ("Aide ou allocation par mois", "Wohngeld / Zuschuss pro Monat", "Contributo o sussidio al mese"),
"Landlord income rule": ("Règle de revenu du propriétaire", "Einkommensregel des Vermieters", "Regola di reddito del proprietario"),
"40× annual rent": ("40× le loyer annuel", "40× Jahresmiete", "40× il canone annuo"),
"3× monthly rent": ("3× le loyer mensuel", "3× Monatsmiete", "3× il canone mensile"),
"2.5× monthly rent": ("2,5× le loyer mensuel", "2,5× Monatsmiete", "2,5× il canone mensile"),
"No income test": ("Aucun test de revenu", "Keine Einkommensprüfung", "Nessuna verifica del reddito"),
"Subsidy applied": ("Aide déduite", "Zuschuss angerechnet", "Contributo applicato"),
"Your share": ("Votre part", "Ihr Anteil", "La tua quota"),
"Enter an income to see whether the landlord’s rule is met on your share.": (
 "Saisissez un revenu pour voir si la règle du propriétaire est respectée sur votre part.",
 "Geben Sie ein Einkommen ein, um zu sehen, ob die Regel des Vermieters auf Ihren Anteil zutrifft.",
 "Inserisci un reddito per vedere se la regola del proprietario è soddisfatta sulla tua quota."),
"What your share would be": ("Ce que serait votre part", "Wie hoch Ihr Anteil wäre", "Quanto sarebbe la tua quota"),
"The income test computed on the tenant’s share.": (
 "Le test de revenu calculé sur la part du locataire.",
 "Die Einkommensprüfung, gerechnet auf den Anteil des Mieters.",
 "La verifica del reddito calcolata sulla quota dell'inquilino."),

# Takeover desk / consent timeline
"Takeover desk": ("Bureau des reprises", "Übernahme-Schalter", "Sportello subentri"),
"Getting off this lease without it dying in the post": (
 "Sortir de ce bail sans qu'il meure dans le courrier",
 "Aus diesem Mietvertrag herauskommen, ohne dass er im Postweg stirbt",
 "Uscire da questo contratto senza che muoia tra le scartoffie"),
"Day 0": ("Jour 0", "Tag 0", "Giorno 0"),
"2. Serve the request by certified mail": (
 "2. Envoyer la demande en recommandé",
 "2. Den Antrag per Einschreiben zustellen",
 "2. Invia la richiesta con raccomandata"),
"3. Landlord may request further information": (
 "3. Le propriétaire peut demander des informations complémentaires",
 "3. Der Vermieter kann weitere Angaben verlangen",
 "3. Il proprietario può chiedere ulteriori informazioni"),
"A request for more information within": (
 "Une demande d'informations complémentaires dans un délai de",
 "Eine Nachfrage nach weiteren Angaben innerhalb von",
 "Una richiesta di ulteriori informazioni entro"),
"is permitted. Answering it restarts nothing — the decision window keeps running from service.": (
 "est autorisée. Y répondre ne relance rien : le délai de décision continue de courir depuis la signification.",
 "ist zulässig. Eine Antwort setzt nichts neu in Gang — die Entscheidungsfrist läuft ab Zustellung weiter.",
 "è ammessa. Rispondere non fa ripartire nulla: il termine per la decisione continua a decorrere dalla notifica."),
"4. Decision window closes": (
 "4. Fin du délai de décision",
 "4. Die Entscheidungsfrist läuft ab",
 "4. Si chiude il termine per la decisione"),
"That window has passed on this listing with no response recorded.": (
 "Ce délai est écoulé sur cette annonce, sans réponse enregistrée.",
 "Diese Frist ist bei diesem Inserat abgelaufen, ohne dass eine Antwort erfasst wurde.",
 "Su questo annuncio il termine è scaduto senza alcuna risposta registrata."),
"At signature": ("À la signature", "Bei Unterschrift", "Alla firma"),
"RentLeaks does not hold it and cannot return it.": (
 "RentLeaks ne le détient pas et ne peut pas le restituer.",
 "RentLeaks verwahrt sie nicht und kann sie nicht zurückzahlen.",
 "RentLeaks non lo trattiene e non può restituirlo."),
"What the departing tenant may charge you": (
 "Ce que le locataire sortant peut vous facturer",
 "Was der ausziehende Mieter Ihnen berechnen darf",
 "Cosa può addebitarti l'inquilino uscente"),
"The other half of the ledger.": (
 "L'autre moitié du décompte.",
 "Die andere Hälfte der Aufstellung.",
 "L'altra metà del conto."),
"The proposed term, with start and end dates": (
 "La durée proposée, avec dates de début et de fin",
 "Die vorgeschlagene Laufzeit mit Beginn und Ende",
 "La durata proposta, con date di inizio e fine"),
"The subtenant’s name, home address and business address": (
 "Le nom du sous-locataire, son adresse personnelle et son adresse professionnelle",
 "Name, Wohnanschrift und Geschäftsanschrift des Untermieters",
 "Nome, indirizzo di residenza e indirizzo professionale del subconduttore"),
"The reason for the request": ("Le motif de la demande", "Der Grund für den Antrag", "Il motivo della richiesta"),
"The tenant’s address during the sublease": (
 "L'adresse du locataire pendant la sous-location",
 "Die Anschrift des Mieters während der Untermiete",
 "L'indirizzo dell'inquilino durante il subaffitto"),
"The written consent of any co-tenant or guarantor": (
 "L'accord écrit de tout colocataire ou garant",
 "Die schriftliche Zustimmung jedes Mitmieters oder Bürgen",
 "Il consenso scritto di ogni co-inquilino o garante"),
"A copy of the proposed sublease, attached to a copy of the original lease": (
 "Une copie du contrat de sous-location envisagé, jointe à une copie du bail d'origine",
 "Eine Kopie des geplanten Untermietvertrags, beigefügt einer Kopie des ursprünglichen Mietvertrags",
 "Una copia del contratto di subaffitto proposto, allegata a una copia del contratto originario"),
"The incoming occupant’s identity and contact details": (
 "L'identité et les coordonnées de l'occupant entrant",
 "Identität und Kontaktdaten des einziehenden Bewohners",
 "Identità e recapiti di chi subentra"),
"A copy of the proposed sublease and of the original lease": (
 "Une copie du contrat de sous-location envisagé et du bail d'origine",
 "Eine Kopie des geplanten Untermietvertrags und des ursprünglichen Mietvertrags",
 "Una copia del subaffitto proposto e del contratto originario"),
"The outgoing tenant’s address during the sublease": (
 "L'adresse du locataire sortant pendant la sous-location",
 "Die Anschrift des ausziehenden Mieters während der Untermiete",
 "L'indirizzo dell'inquilino uscente durante il subaffitto"),
"A written request for consent to assign the lease": (
 "Une demande écrite d'autorisation de céder le bail",
 "Ein schriftlicher Antrag auf Zustimmung zur Vertragsübernahme",
 "Una richiesta scritta di consenso alla cessione del contratto"),
"The proposed assignee’s identity, employment and screening result": (
 "L'identité du cessionnaire proposé, sa situation professionnelle et le résultat de son dossier",
 "Identität, Beschäftigung und Prüfergebnis des vorgesehenen Übernehmers",
 "Identità, situazione lavorativa ed esito della verifica di chi subentra"),
"A copy of the original lease and the proposed assignment": (
 "Une copie du bail d'origine et de la cession envisagée",
 "Eine Kopie des ursprünglichen Mietvertrags und der geplanten Übernahme",
 "Una copia del contratto originario e della cessione proposta"),
"The date the assignee would take possession": (
 "La date à laquelle le cessionnaire prendrait possession",
 "Das Datum, an dem der Übernehmer einziehen würde",
 "La data in cui chi subentra prenderebbe possesso"),
"Background and credit check": ("Vérification d'antécédents et de solvabilité", "Auskunft und Bonitätsprüfung", "Verifica di referenze e affidabilità"),
"The lesser of actual cost or the statutory figure, and waived entirely if you hand over your own report from the last 30 days — which is what your passport is.": (
 "Le plus bas du coût réel ou du montant légal, et totalement annulé si vous remettez votre propre rapport de moins de 30 jours — c'est précisément ce qu'est votre passeport.",
 "Der niedrigere Betrag aus tatsächlichen Kosten und gesetzlichem Höchstwert, und er entfällt ganz, wenn Sie einen eigenen Nachweis aus den letzten 30 Tagen vorlegen — genau das ist Ihr Mieterprofil.",
 "Il minore tra il costo effettivo e l'importo di legge, e azzerato del tutto se consegni una tua relazione degli ultimi 30 giorni — che è esattamente ciò che è il tuo profilo inquilino."),
"Furnished surcharge on a regulated unit": (
 "Supplément meublé sur un logement encadré",
 "Möblierungszuschlag auf eine regulierte Wohnung",
 "Maggiorazione per arredamento su un'unità regolamentata"),
"% over the legal rent": ("% au-dessus du loyer légal", "% über der zulässigen Miete", "% sopra il canone legale"),

# Who is letting this
"Listed by the owner": ("Publié par le propriétaire", "Vom Eigentümer inseriert", "Pubblicato dal proprietario"),
"The person letting this home owns it and is handling the let themselves. There is no agent in the transaction, so there is no broker fee to argue about.": (
 "La personne qui loue ce logement en est propriétaire et s'occupe elle-même de la location. Il n'y a aucun agent dans l'opération, donc aucuns honoraires à discuter.",
 "Wer diese Wohnung vermietet, ist der Eigentümer und wickelt die Vermietung selbst ab. Es ist kein Makler beteiligt, also gibt es auch keine Provision zu verhandeln.",
 "Chi affitta questa casa ne è il proprietario e gestisce la locazione di persona. Nell'operazione non c'è nessuna agenzia, quindi non c'è nessuna provvigione da discutere."),
"Listed by the landlord’s broker": (
 "Publié par l'agent du propriétaire",
 "Vom Makler des Vermieters inseriert",
 "Pubblicato dall'agente del proprietario"),
"A licensed broker retained by the landlord published this. They act for the landlord, not for you.": (
 "Un agent titulaire d'une carte professionnelle, mandaté par le propriétaire, a publié cette annonce. Il agit pour le propriétaire, pas pour vous.",
 "Ein vom Vermieter beauftragter lizenzierter Makler hat das inseriert. Er handelt für den Vermieter, nicht für Sie.",
 "Ha pubblicato l'annuncio un agente abilitato incaricato dal proprietario. Agisce per il proprietario, non per te."),
"Listed by the operator": ("Publié par l'exploitant", "Vom Betreiber inseriert", "Pubblicato dal gestore"),
"Operator": ("Exploitant", "Betreiber", "Gestore"),
"A co-living or serviced-apartment operator lets this directly from its own portfolio. No third-party agent sits in between.": (
 "Un exploitant de coliving ou de résidence services loue directement depuis son propre parc. Aucun agent tiers ne s'interpose.",
 "Ein Co-Living- oder Serviced-Apartment-Betreiber vermietet direkt aus dem eigenen Bestand. Kein Dritter sitzt dazwischen.",
 "Un gestore di co-living o di appartamenti con servizi affitta direttamente dal proprio portafoglio. Non c'è nessun agente terzo in mezzo."),
"Listed by the departing tenant, as sub-landlord": (
 "Publié par le locataire sortant, en qualité de sous-bailleur",
 "Vom ausziehenden Mieter inseriert, als Untervermieter",
 "Pubblicato dall'inquilino uscente, come sublocatore"),
"The current tenant stays on the original lease and lets to you underneath it. They are your landlord for the sublease; the building’s owner is not.": (
 "Le locataire actuel reste sur le bail d'origine et vous loue en dessous. C'est lui votre bailleur pour la sous-location, pas le propriétaire de l'immeuble.",
 "Der aktuelle Mieter bleibt im ursprünglichen Vertrag und vermietet darunter an Sie. Für die Untermiete ist er Ihr Vermieter, nicht der Eigentümer des Hauses.",
 "L'inquilino attuale resta nel contratto originario e ti affitta al di sotto di esso. Per il subaffitto il tuo locatore è lui, non il proprietario dell'immobile."),
"Listed by the departing tenant, for assignment": (
 "Publié par le locataire sortant, pour une cession",
 "Vom ausziehenden Mieter inseriert, zur Vertragsübernahme",
 "Pubblicato dall'inquilino uscente, per cessione"),
"Takeover": ("Reprise", "Übernahme", "Subentro"),
"The current tenant leaves the lease entirely and you step into it with the building’s owner. The departing tenant is not a party to your tenancy at all.": (
 "Le locataire actuel quitte entièrement le bail et vous y entrez avec le propriétaire de l'immeuble. Le locataire sortant n'est plus du tout partie à votre location.",
 "Der aktuelle Mieter scheidet ganz aus dem Vertrag aus und Sie treten mit dem Eigentümer des Hauses in ihn ein. Der ausziehende Mieter ist an Ihrem Mietverhältnis gar nicht mehr beteiligt.",
 "L'inquilino attuale esce del tutto dal contratto e tu ci entri con il proprietario dell'immobile. L'inquilino uscente non è più parte del tuo rapporto di locazione."),
"Proving they own it": ("La preuve qu'il en est propriétaire", "Der Nachweis des Eigentums", "La prova che ne è proprietario"),

# Trust ledger and payment rails
"Trust ledger": ("Registre de confiance", "Vertrauensprotokoll", "Registro di affidabilità"),
"What we checked, and how": ("Ce que nous avons vérifié, et comment", "Was wir geprüft haben, und wie", "Cosa abbiamo verificato, e come"),
"Image reuse detected": ("Photo déjà utilisée ailleurs", "Bild andernorts wiederverwendet", "Foto già usata altrove"),
"At least one photograph appears elsewhere. Scammers who cannot reach a property cannot photograph it.": (
 "Au moins une photo apparaît ailleurs. Un escroc qui n'a pas accès au logement ne peut pas le photographier.",
 "Mindestens ein Foto taucht auch anderswo auf. Wer keinen Zugang zu einer Wohnung hat, kann sie auch nicht fotografieren.",
 "Almeno una foto compare altrove. Chi non ha accesso a un immobile non può fotografarlo."),
"Identity overlap with a reported account": (
 "Recoupement d'identité avec un compte signalé",
 "Identitätsüberschneidung mit einem gemeldeten Konto",
 "Sovrapposizione di identità con un account segnalato"),
"Contact-identity clustering is the strongest published signal for rental-listing fraud. This listing is under manual review.": (
 "Le regroupement d'identités de contact est le signal publié le plus fiable de fraude à l'annonce locative. Cette annonce est en cours d'examen manuel.",
 "Die Gruppierung von Kontaktidentitäten ist das stärkste veröffentlichte Signal für Betrug bei Mietinseraten. Dieses Inserat wird manuell geprüft.",
 "Il raggruppamento delle identità di contatto è il segnale pubblicato più forte di truffa negli annunci di affitto. Questo annuncio è in revisione manuale."),
"No fraud signals on this listing": (
 "Aucun signal de fraude sur cette annonce",
 "Keine Betrugssignale bei diesem Inserat",
 "Nessun segnale di truffa su questo annuncio"),
"Identity, address control, image uniqueness and account clustering all pass. That is not a guarantee. Read how to pay, below.": (
 "Identité, contrôle de l'adresse, unicité des photos et regroupement de comptes : tout est vérifié. Ce n'est pas une garantie. Lisez ci-dessous comment payer.",
 "Identität, Adressnachweis, Einzigartigkeit der Bilder und Kontogruppierung sind alle bestanden. Das ist keine Garantie. Lesen Sie unten, wie man zahlt.",
 "Identità, controllo dell'indirizzo, unicità delle foto e raggruppamento degli account: tutto superato. Non è una garanzia. Leggi qui sotto come pagare."),
"Card": ("Carte bancaire", "Karte", "Carta"),
"You keep a chargeback. This is the only rail that gives you a way back.": (
 "Vous gardez la possibilité d'une rétrofacturation. C'est le seul moyen de paiement qui vous laisse un recours.",
 "Ihnen bleibt die Rückbuchung. Das ist der einzige Zahlweg, der Ihnen einen Weg zurück lässt.",
 "Ti resta la possibilità di uno storno. È l'unico canale di pagamento che ti lascia una via d'uscita."),
"Bank transfer to a named account": (
 "Virement vers un compte nominatif",
 "Überweisung auf ein Konto mit Namen",
 "Bonifico su un conto intestato"),
"Traceable, and the account name should match the verified identity above. Slow to reverse, but not impossible.": (
 "Traçable, et le titulaire du compte doit correspondre à l'identité vérifiée ci-dessus. Long à annuler, mais pas impossible.",
 "Nachvollziehbar, und der Kontoinhaber sollte mit der oben geprüften Identität übereinstimmen. Langsam rückgängig zu machen, aber nicht unmöglich.",
 "Tracciabile, e l'intestatario del conto deve coincidere con l'identità verificata qui sopra. Lento da annullare, ma non impossibile."),
"Instant and final. Treated as cash.": (
 "Instantané et définitif. Traité comme des espèces.",
 "Sofort und endgültig. Wird wie Bargeld behandelt.",
 "Immediato e definitivo. Trattato come contante."),
"Wire transfer": ("Virement international", "Auslandsüberweisung", "Bonifico internazionale"),
"Effectively unrecoverable once it lands.": (
 "En pratique irrécupérable une fois arrivé.",
 "Nach dem Eingang praktisch nicht mehr zurückzuholen.",
 "Di fatto irrecuperabile una volta arrivato."),
"Gift cards or crypto": ("Cartes cadeaux ou cryptomonnaie", "Geschenkkarten oder Krypto", "Carte regalo o criptovalute"),
"There is no legitimate reason a landlord asks for these. None.": (
 "Aucun propriétaire n'a de raison légitime de demander cela. Aucune.",
 "Es gibt keinen legitimen Grund, warum ein Vermieter danach fragt. Keinen.",
 "Non esiste alcun motivo legittimo per cui un proprietario li chieda. Nessuno."),
"The name on the account was matched against the record for": (
 "Le titulaire du compte a été rapproché du dossier de",
 "Der Kontoinhaber wurde mit dem Eintrag abgeglichen für",
 "L'intestatario del conto è stato confrontato con il registro di"),

# Rules engine
"Local rules": ("Règles locales", "Lokale Regeln", "Regole locali"),
"requires of this listing": ("exige de cette annonce", "von diesem Inserat verlangt", "richiede a questo annuncio"),
"A rules engine with effective dates — not conditionals buried in the render path.": (
 "Un moteur de règles avec des dates d'entrée en vigueur — pas des conditions enfouies dans le rendu.",
 "Eine Regel-Engine mit Inkrafttretensdaten — keine im Rendering vergrabenen Bedingungen.",
 "Un motore di regole con date di entrata in vigore — non condizioni sepolte nel rendering."),

# Stay window
"Needs": ("Il vous faut", "Benötigt", "Serve"),
"This home has a": ("Ce logement a un", "Diese Wohnung hat eine", "Questa casa ha un"),
"Outside this window": ("En dehors de cette période", "Außerhalb dieses Zeitraums", "Fuori da questo periodo"),
"Frees up": ("Se libère le", "Wird frei am", "Si libera il"),
"Ends": ("Se termine le", "Endet am", "Finisce il"),
"The term ends": ("Le bail se termine", "Die Laufzeit endet", "Il contratto finisce"),
"Fits your dates": ("Correspond à vos dates", "Passt zu Ihren Daten", "Compatibile con le tue date"),
"Paid direct to": ("Versé directement à", "Direkt gezahlt an", "Versato direttamente a"),

# Reviews
"Stay record": ("Historique des séjours", "Aufenthaltsbilanz", "Storico dei soggiorni"),
"Reviews from people who actually lived here": (
 "Des avis de personnes qui ont réellement vécu ici",
 "Bewertungen von Menschen, die hier tatsächlich gewohnt haben",
 "Recensioni di persone che ci hanno davvero vissuto"),
"Host replied:": ("Réponse de l'hôte :", "Antwort des Anbieters:", "Risposta dell'host:"),
"All-in meant all-in. No surprise utility reconciliation at the end, which is the whole reason I booked here instead of a direct lease.": (
 "Tout compris voulait dire tout compris. Aucune régularisation de charges en fin de séjour, et c'est exactement pour ça que j'ai réservé ici plutôt que de signer un bail direct.",
 "Warm hieß warm. Keine überraschende Nebenkostenabrechnung am Ende — genau deshalb habe ich hier gebucht statt direkt zu mieten.",
 "Tutto compreso voleva dire tutto compreso. Nessun conguaglio a sorpresa sulle utenze alla fine, ed è esattamente il motivo per cui ho scelto qui invece di un contratto diretto."),
"Building is exactly as photographed. The one thing to know: the radiator is loud for the first hour in the morning. Host flagged it before I asked.": (
 "L'immeuble est exactement conforme aux photos. Une chose à savoir : le radiateur est bruyant pendant la première heure le matin. L'hôte l'avait signalé avant que je pose la question.",
 "Das Haus sieht genau so aus wie auf den Fotos. Eines sollte man wissen: Der Heizkörper ist die erste Stunde am Morgen laut. Der Anbieter hat das von sich aus erwähnt.",
 "L'edificio è esattamente come nelle foto. Una cosa da sapere: il termosifone è rumoroso per la prima ora del mattino. L'host me l'ha detto prima che chiedessi."),
"Deposit came back in full nine days after checkout, itemised. I had photographed everything at move-in through the condition report, which made it a non-conversation.": (
 "Le dépôt de garantie m'a été rendu intégralement neuf jours après le départ, avec le détail. J'avais tout photographié à l'entrée via l'état des lieux, ce qui a réglé la question avant même qu'elle se pose.",
 "Die Kaution kam neun Tage nach dem Auszug vollständig und aufgeschlüsselt zurück. Beim Einzug hatte ich über das Übergabeprotokoll alles fotografiert — damit war das Thema erledigt, bevor es eines wurde.",
 "Il deposito è tornato per intero nove giorni dopo la riconsegna, con il dettaglio. All'ingresso avevo fotografato tutto nel verbale di consegna, e la questione si è chiusa prima ancora di aprirsi."),
"Host replied inside the hour every single time. For a stay I arranged from another continent that mattered more than the finish quality.": (
 "L'hôte a répondu en moins d'une heure, à chaque fois. Pour un séjour organisé depuis un autre continent, cela comptait plus que la qualité des finitions.",
 "Der Anbieter hat jedes Mal innerhalb einer Stunde geantwortet. Bei einem Aufenthalt, den ich von einem anderen Kontinent aus organisiert habe, zählte das mehr als die Qualität der Ausstattung.",
 "L'host ha risposto entro un'ora, ogni singola volta. Per un soggiorno organizzato da un altro continente contava più della qualità delle finiture."),
"Thank you — the radiator is scheduled for a bleed before the next arrival.": (
 "Merci — la purge du radiateur est programmée avant la prochaine arrivée.",
 "Danke — der Heizkörper wird vor dem nächsten Einzug entlüftet.",
 "Grazie — lo sfiato del termosifone è già in programma prima del prossimo arrivo."),
"Appreciated. We have added the morning noise note to the listing so it is not a surprise.": (
 "Merci. Nous avons ajouté la mention du bruit matinal à l'annonce pour que ce ne soit pas une surprise.",
 "Danke. Wir haben den Hinweis auf den Lärm am Morgen ins Inserat aufgenommen, damit es keine Überraschung ist.",
 "Grazie. Abbiamo aggiunto all'annuncio la nota sul rumore mattutino, così non è una sorpresa."),

# Reporting
"This wording cannot be published.": (
 "Cette formulation ne peut pas être publiée.",
 "Diese Formulierung kann nicht veröffentlicht werden.",
 "Questa formulazione non può essere pubblicata."),
"What happened": ("Ce qui s'est passé", "Was passiert ist", "Cosa è successo"),
"Send report": ("Envoyer le signalement", "Meldung senden", "Invia la segnalazione"),
"Complete it once": ("À remplir une seule fois", "Einmal ausfüllen", "Da compilare una volta sola"),
"Copy share link": ("Copier le lien de partage", "Freigabelink kopieren", "Copia il link di condivisione"),
"I think this is a scam": ("Je pense que c'est une arnaque", "Ich halte das für Betrug", "Penso sia una truffa"),
"It is not actually available": ("Ce logement n'est pas réellement disponible", "Die Wohnung ist gar nicht verfügbar", "In realtà non è disponibile"),
"The listing is inaccurate": ("L'annonce est inexacte", "Das Inserat ist falsch", "L'annuncio non è accurato"),
"Discriminatory wording": ("Formulation discriminatoire", "Diskriminierende Formulierung", "Formulazione discriminatoria"),
"It breaks a local rule": ("Cela enfreint une règle locale", "Es verstößt gegen eine lokale Regel", "Viola una regola locale"),
"Housing vouchers and subsidies are accepted on this home": (
 "Les aides et allocations logement sont acceptées pour ce logement",
 "Wohngeld und Zuschüsse werden für diese Wohnung akzeptiert",
 "Per questa casa si accettano contributi e sussidi all'affitto"),
"The landlord has consented, or the statutory window has closed without objection": (
 "Le propriétaire a donné son accord, ou le délai légal s'est écoulé sans opposition",
 "Der Vermieter hat zugestimmt, oder die gesetzliche Frist ist ohne Widerspruch abgelaufen",
 "Il proprietario ha dato il consenso, oppure il termine di legge è scaduto senza opposizione"),
"A property attribute — the accessibility facet that reduces fair-housing risk rather than creating it": (
 "Une caractéristique du logement — le critère d'accessibilité qui réduit le risque de discrimination au lieu de le créer",
 "Ein Merkmal der Wohnung — das Barrierefreiheitskriterium, das das Diskriminierungsrisiko senkt statt es zu schaffen",
 "Una caratteristica dell'immobile — il criterio di accessibilità che riduce il rischio di discriminazione invece di crearlo"),

# ------------------------------------------------------------ rentleaks-list.js
"Title": ("Titre", "Titel", "Titolo"),
"Lease end date": ("Date de fin du bail", "Ende des Mietvertrags", "Data di fine contratto"),
"Parking": ("Stationnement", "Stellplatz", "Parcheggio"),
"Amenity fee": ("Frais de services", "Servicegebühr", "Spese per i servizi"),
"Admin fee": ("Frais administratifs", "Verwaltungsgebühr", "Spese amministrative"),
"Move-in fee": ("Frais d'entrée", "Einzugsgebühr", "Spese di ingresso"),
"Key fee": ("Frais de clés", "Schlüsselgebühr", "Spese per le chiavi"),
"Registration number": ("Numéro d'enregistrement", "Registrierungsnummer", "Numero di registrazione"),
"Registry reference": ("Référence au registre", "Registerzeichen", "Riferimento di registro"),
"Save draft": ("Enregistrer le brouillon", "Entwurf speichern", "Salva la bozza"),
"Discard": ("Abandonner", "Verwerfen", "Scarta"),
"How much of the address renters see": (
 "Ce que les locataires voient de l'adresse",
 "Wie viel der Adresse Mieter sehen",
 "Quanta parte dell'indirizzo vedono gli inquilini"),
"Shown publicly as:": ("Affiché publiquement comme :", "Öffentlich angezeigt als:", "Mostrato pubblicamente come:"),
". We always hold the full address for the map pin and to match against your ownership document; this only controls display.": (
 ". Nous conservons toujours l'adresse complète pour le repère sur la carte et pour la rapprocher de votre titre de propriété ; ceci ne règle que l'affichage.",
 ". Wir speichern die vollständige Adresse in jedem Fall für die Kartenmarkierung und den Abgleich mit Ihrem Eigentumsnachweis; dies steuert nur die Anzeige.",
 ". Conserviamo sempre l'indirizzo completo per il segnaposto sulla mappa e per il confronto con il tuo documento di proprietà; questo regola soltanto la visualizzazione."),
"No cover photograph": ("Aucune photo de couverture", "Kein Titelbild", "Nessuna foto di copertina"),
"No window": ("Aucune période", "Kein Zeitraum", "Nessun periodo"),
"What this costs you": ("Ce que cela vous coûte", "Was Sie das kostet", "Quanto ti costa"),
"Where it will appear: the": ("Où elle apparaîtra : la", "Wo es erscheint: die", "Dove comparirà: la"),
"Sponsored placement": ("Mise en avant sponsorisée", "Gesponserte Platzierung", "Posizionamento sponsorizzato"),
"What the renter pays us": ("Ce que le locataire nous paie", "Was der Mieter uns zahlt", "Quanto ci paga l'inquilino"),
"Nothing": ("Rien", "Nichts", "Niente"),
"All-in per month": ("Tout compris par mois", "Warmmiete pro Monat", "Tutto compreso al mese"),
"All-in, per month": ("Tout compris, par mois", "Warmmiete, pro Monat", "Tutto compreso, al mese"),
"Deposit, paid direct to you": (
 "Dépôt de garantie, versé directement à vous",
 "Kaution, direkt an Sie gezahlt",
 "Deposito cauzionale, versato direttamente a te"),
"Deposit (paid to you)": ("Dépôt de garantie (versé à vous)", "Kaution (an Sie gezahlt)", "Deposito (versato a te)"),
"Before you publish": ("Avant de publier", "Bevor Sie veröffentlichen", "Prima di pubblicare"),
"Everything checks out.": ("Tout est en ordre.", "Alles in Ordnung.", "È tutto a posto."),
"ID verified": ("Identité vérifiée", "Ausweis geprüft", "Identità verificata"),
"Cover": ("Couverture", "Titelbild", "Copertina"),
"Drop photographs here, or choose files": (
 "Déposez des photos ici, ou choisissez des fichiers",
 "Fotos hierher ziehen oder Dateien auswählen",
 "Trascina qui le foto, oppure scegli i file"),
"Floor plan": ("Plan", "Grundriss", "Planimetria"),
"Add a floor plan": ("Ajouter un plan", "Grundriss hinzufügen", "Aggiungi una planimetria"),
"Add a viewing slot": ("Ajouter un créneau de visite", "Besichtigungstermin hinzufügen", "Aggiungi un orario di visita"),
"Remove slot": ("Retirer le créneau", "Termin entfernen", "Rimuovi l'orario"),
"per month": ("par mois", "pro Monat", "al mese"),
"Fees": ("Frais", "Gebühren", "Spese"),
"Add a fee": ("Ajouter un frais", "Gebühr hinzufügen", "Aggiungi una spesa"),
"Remove fee": ("Retirer le frais", "Gebühr entfernen", "Rimuovi la spesa"),
"Amount": ("Montant", "Betrag", "Importo"),
"Accepted": ("Acceptés", "Akzeptiert", "Accettati"),
"Not set up for them": ("Pas équipé pour en accueillir", "Dafür nicht eingerichtet", "Non attrezzato per averne"),
"Sublet — I stay on the lease": (
 "Sous-location — je reste sur le bail",
 "Untermiete — ich bleibe im Vertrag",
 "Subaffitto — resto io nel contratto"),
"Assignment — I come off it entirely": (
 "Cession — je sors complètement du bail",
 "Vertragsübernahme — ich scheide ganz aus",
 "Cessione — esco del tutto dal contratto"),
"What you may charge.": ("Ce que vous pouvez facturer.", "Was Sie berechnen dürfen.", "Cosa puoi addebitare."),
"This cannot be published.": ("Ceci ne peut pas être publié.", "Das kann nicht veröffentlicht werden.", "Questo non può essere pubblicato."),
"Monthly fees": ("Frais mensuels", "Monatliche Gebühren", "Spese mensili"),
"One-off": ("Ponctuel", "Einmalig", "Una tantum"),
"Preview as a renter": ("Aperçu côté locataire", "Vorschau als Mieter", "Anteprima come inquilino"),
"Published": ("Publiée", "Veröffentlicht", "Pubblicato"),
"See it in search": ("La voir dans la recherche", "In der Suche ansehen", "Guardalo nella ricerca"),
"List another": ("Publier une autre annonce", "Weiteres Inserat aufgeben", "Pubblicane un altro"),
"Listing progress": ("Avancement de l'annonce", "Fortschritt des Inserats", "Avanzamento dell'annuncio"),
"Make this the cover": ("En faire la photo de couverture", "Als Titelbild festlegen", "Rendila la copertina"),
"Remove photograph": ("Retirer la photo", "Foto entfernen", "Rimuovi la foto"),
"Weekly": ("Hebdomadaire", "Wöchentlich", "Settimanale"),
"Monthly": ("Mensuel", "Monatlich", "Mensile"),
"Who & where": ("Qui et où", "Wer und wo", "Chi e dove"),
"The home": ("Le logement", "Die Wohnung", "La casa"),
"Photos": ("Photos", "Fotos", "Foto"),
"Dates & money": ("Dates et argent", "Termine und Geld", "Date e denaro"),
"The lease": ("Le bail", "Der Mietvertrag", "Il contratto"),
"Viewings & files": ("Visites et documents", "Besichtigungen und Unterlagen", "Visite e documenti"),
"Review": ("Vérification", "Prüfen", "Controllo"),
"Wi-Fi / internet": ("Wifi / internet", "WLAN / Internet", "Wi-Fi / internet"),
"Storage": ("Rangement", "Abstellraum", "Ripostiglio"),
"Pet rent": ("Supplément animal", "Haustierzuschlag", "Supplemento animali"),
"Outdoor": ("Extérieur", "Außenbereich", "Spazio esterno"),
"Laundry in unit": ("Lave-linge dans le logement", "Waschmaschine in der Wohnung", "Lavatrice in casa"),
"Laundry in building": ("Buanderie dans l'immeuble", "Waschraum im Haus", "Lavanderia nell'edificio"),
"Heating included": ("Chauffage compris", "Heizung inklusive", "Riscaldamento incluso"),
"Dishwasher": ("Lave-vaisselle", "Spülmaschine", "Lavastoviglie"),
"Lift": ("Ascenseur", "Aufzug", "Ascensore"),
"Desk / workspace": ("Bureau / espace de travail", "Schreibtisch / Arbeitsplatz", "Scrivania / postazione"),
"Bike storage": ("Local à vélos", "Fahrradraum", "Deposito bici"),
"Pool": ("Piscine", "Pool", "Piscina"),
"Balcony or garden": ("Balcon ou jardin", "Balkon oder Garten", "Balcone o giardino"),
"Step-free from the street to the door": (
 "De plain-pied de la rue à la porte",
 "Stufenlos von der Straße bis zur Tür",
 "Senza gradini dalla strada alla porta"),
"Lift to the floor": ("Ascenseur jusqu'à l'étage", "Aufzug bis zur Etage", "Ascensore fino al piano"),
"Doorways 32 inches / 81 cm or wider": (
 "Portes de 81 cm ou plus",
 "Türen ab 81 cm Breite",
 "Porte da 81 cm o più"),
"Roll-in shower or grab rails": (
 "Douche de plain-pied ou barres d'appui",
 "Bodengleiche Dusche oder Haltegriffe",
 "Doccia a filo pavimento o maniglioni"),
"Ground floor": ("Rez-de-chaussée", "Erdgeschoss", "Piano terra"),
"Full address": ("Adresse complète", "Vollständige Adresse", "Indirizzo completo"),
"Street, no unit number": ("Rue, sans numéro d'appartement", "Straße, ohne Wohnungsnummer", "Via, senza numero interno"),
"Street name only": ("Nom de rue uniquement", "Nur Straßenname", "Solo il nome della via"),
"Neighbourhood only": ("Quartier uniquement", "Nur Stadtteil", "Solo il quartiere"),
"Neighbourhood": ("Quartier", "Stadtteil", "Quartiere"),
"Title, neighbourhood and address": ("Titre, quartier et adresse", "Titel, Stadtteil und Adresse", "Titolo, quartiere e indirizzo"),
"The address is never published in full — it sets the map pin and it is what an ownership document gets matched against.": (
 "L'adresse n'est jamais publiée en entier : elle place le repère sur la carte et sert à être rapprochée d'un titre de propriété.",
 "Die Adresse wird nie vollständig veröffentlicht — sie setzt die Kartenmarkierung und dient dem Abgleich mit einem Eigentumsnachweis.",
 "L'indirizzo non viene mai pubblicato per intero: posiziona il segnaposto sulla mappa ed è ciò con cui si confronta un documento di proprietà."),
"Description with some substance": ("Une description avec du fond", "Eine Beschreibung mit Substanz", "Una descrizione con sostanza"),
"Who else lives there, what is genuinely included, what the building is like at 8am. The listings that convert say the awkward thing before the viewing does.": (
 "Qui d'autre y vit, ce qui est réellement compris, à quoi ressemble l'immeuble à 8 h. Les annonces qui marchent disent ce qui gêne avant que la visite ne s'en charge.",
 "Wer sonst dort wohnt, was wirklich enthalten ist, wie das Haus um 8 Uhr morgens ist. Die Inserate, die funktionieren, sagen das Unangenehme, bevor die Besichtigung es tut.",
 "Chi altro ci vive, cosa è davvero incluso, com'è l'edificio alle 8 del mattino. Gli annunci che funzionano dicono la cosa scomoda prima che lo faccia la visita."),
"Required on the listing in this market": (
 "Obligatoire sur l'annonce sur ce marché",
 "Auf diesem Markt im Inserat vorgeschrieben",
 "Obbligatorio nell'annuncio su questo mercato"),
"Required on the listing here": (
 "Obligatoire sur l'annonce ici",
 "Hier im Inserat vorgeschrieben",
 "Qui obbligatorio nell'annuncio"),
"It sets the remaining term, which is the first thing anyone taking over a lease looks at.": (
 "Elle fixe la durée restante, la première chose que regarde quelqu'un qui reprend un bail.",
 "Sie bestimmt die Restlaufzeit — das Erste, worauf jemand schaut, der einen Vertrag übernimmt.",
 "Determina la durata residua, la prima cosa che guarda chi subentra in un contratto."),
"Priced in": ("Compris dans le prix", "Im Preis enthalten", "Compreso nel prezzo"),
"Street address": ("Adresse", "Straße und Hausnummer", "Indirizzo"),
"Never shown in full. Sets the map pin, and is what an ownership document gets matched against.": (
 "Jamais affichée en entier. Place le repère sur la carte et sert à être rapprochée d'un titre de propriété.",
 "Wird nie vollständig angezeigt. Setzt die Kartenmarkierung und dient dem Abgleich mit einem Eigentumsnachweis.",
 "Non viene mai mostrato per intero. Posiziona il segnaposto ed è ciò con cui si confronta un documento di proprietà."),
"Unit": ("Appartement", "Wohnung", "Interno"),
"Status": ("Statut", "Status", "Stato"),
"Go live on": ("Mise en ligne le", "Online ab", "Online dal"),
"I own it": ("J'en suis propriétaire", "Sie gehört mir", "Ne sono il proprietario"),
"I manage it": ("Je la gère", "Ich verwalte sie", "La gestisco io"),
"I am the tenant, leaving early": (
 "Je suis le locataire et je pars avant terme",
 "Ich bin der Mieter und ziehe früher aus",
 "Sono l'inquilino e me ne vado prima"),
"Who is listing": ("Qui publie", "Wer inseriert", "Chi pubblica"),
"This decides what we ask you to prove, and what renters are told about who they are dealing with.": (
 "Cela détermine ce que nous vous demandons de prouver, et ce que les locataires apprennent sur la personne en face d'eux.",
 "Das bestimmt, was wir Sie nachweisen lassen und was Mieter darüber erfahren, mit wem sie es zu tun haben.",
 "Questo determina cosa ti chiediamo di dimostrare e cosa viene detto agli inquilini su chi hanno di fronte."),
"Bathrooms": ("Salles de bain", "Bäder", "Bagni"),
"Size (sq ft)": ("Surface (m²)", "Fläche (m²)", "Superficie (m²)"),
"Furnishing": ("Ameublement", "Möblierung", "Arredamento"),
"Partly furnished": ("Partiellement meublé", "Teilmöbliert", "Parzialmente arredato"),
"Unfurnished": ("Non meublé", "Unmöbliert", "Non arredato"),
"Video walkthrough URL": ("Lien de la visite vidéo", "Link zum Videorundgang", "Link del tour video"),
"3D or virtual tour URL": ("Lien de la visite 3D ou virtuelle", "Link zum 3D- oder virtuellen Rundgang", "Link del tour 3D o virtuale"),
"Lease copy": ("Copie du bail", "Kopie des Mietvertrags", "Copia del contratto"),
"Landlord consent": ("Accord du propriétaire", "Zustimmung des Vermieters", "Consenso del proprietario"),
"House rules": ("Règlement intérieur", "Hausordnung", "Regolamento della casa"),
"Energy certificate": ("Diagnostic de performance énergétique", "Energieausweis", "Attestato di prestazione energetica"),
"Dates and stay length": ("Dates et durée du séjour", "Termine und Mietdauer", "Date e durata del soggiorno"),
"The window is what makes this listing findable by someone who needs March to June — and readable by an assistant answering that question on their behalf.": (
 "C'est la période qui rend cette annonce trouvable par quelqu'un qui cherche de mars à juin — et lisible par un assistant qui répond à cette question pour lui.",
 "Der Zeitraum macht dieses Inserat für jemanden auffindbar, der März bis Juni braucht — und lesbar für einen Assistenten, der diese Frage für ihn beantwortet.",
 "È il periodo che rende questo annuncio trovabile da chi cerca da marzo a giugno — e leggibile da un assistente che risponde a quella domanda per suo conto."),
"Available from": ("Disponible à partir du", "Verfügbar ab", "Disponibile dal"),
"Available until": ("Disponible jusqu'au", "Verfügbar bis", "Disponibile fino al"),
"Minimum stay (months)": ("Séjour minimum (mois)", "Mindestmietdauer (Monate)", "Soggiorno minimo (mesi)"),
"Maximum stay (months)": ("Séjour maximum (mois)", "Höchstmietdauer (Monate)", "Soggiorno massimo (mesi)"),
"Money": ("Argent", "Geld", "Denaro"),
"Itemise everything. The all-in figure is what renters compare on and what we sort by, so a fee left off here is a fee that makes your listing look worse, not better.": (
 "Détaillez tout. Le montant tout compris est ce que les locataires comparent et ce sur quoi nous trions : un frais oublié ici dessert votre annonce au lieu de l'avantager.",
 "Schlüsseln Sie alles auf. Die Warmmiete ist das, worauf Mieter vergleichen und wonach wir sortieren — eine hier weggelassene Gebühr lässt Ihr Inserat schlechter dastehen, nicht besser.",
 "Dettaglia tutto. Il tutto compreso è ciò su cui gli inquilini confrontano e su cui noi ordiniamo: una spesa omessa qui fa sembrare il tuo annuncio peggiore, non migliore."),
"No pets": ("Pas d'animaux", "Keine Haustiere", "Niente animali"),
"Cats": ("Chats", "Katzen", "Gatti"),
"Dogs": ("Chiens", "Hunde", "Cani"),
"Cats and dogs": ("Chats et chiens", "Katzen und Hunde", "Gatti e cani"),
"A pet policy is about the property. Assistance animals are not pets and are not covered by it.": (
 "Une règle sur les animaux porte sur le logement. Les animaux d'assistance ne sont pas des animaux de compagnie et n'entrent pas dans ce cadre.",
 "Eine Haustierregel betrifft die Wohnung. Assistenztiere sind keine Haustiere und fallen nicht darunter.",
 "Una regola sugli animali riguarda l'immobile. Gli animali di assistenza non sono animali da compagnia e non vi rientrano."),
"The lease you are handing over": (
 "Le bail que vous transmettez",
 "Der Mietvertrag, den Sie übergeben",
 "Il contratto che stai passando"),
"The three facts that decide whether a takeover completes or collapses. Settling them now is the whole difference.": (
 "Les trois éléments qui décident si une reprise aboutit ou s'effondre. Les régler maintenant fait toute la différence.",
 "Die drei Punkte, an denen eine Übernahme gelingt oder scheitert. Sie jetzt zu klären, macht den ganzen Unterschied.",
 "I tre fatti che decidono se un subentro va in porto o salta. Chiarirli adesso fa tutta la differenza."),
"Route": ("Voie choisie", "Weg", "Percorso"),
"Granted in writing": ("Accordé par écrit", "Schriftlich erteilt", "Concesso per iscritto"),
"Requested, awaiting a reply": ("Demandé, en attente de réponse", "Beantragt, Antwort steht aus", "Richiesto, in attesa di risposta"),
"Not asked yet": ("Pas encore demandé", "Noch nicht beantragt", "Non ancora richiesto"),
"Shown on the listing either way. Renters would rather know now.": (
 "Affiché sur l'annonce dans tous les cas. Les locataires préfèrent le savoir tout de suite.",
 "Wird so oder so im Inserat angezeigt. Mieter wissen es lieber jetzt.",
 "Viene mostrato nell'annuncio in ogni caso. Gli inquilini preferiscono saperlo subito."),

# ---------------------------------------------------------- rentleaks-leads.js
"privacy policy": ("politique de confidentialité", "Datenschutzerklärung", "informativa sulla privacy"),
"This is a request, not a payment. The host accepts or declines, and you only sign and pay after you have seen the home.": (
 "Ceci est une demande, pas un paiement. L'hôte accepte ou refuse, et vous ne signez et ne payez qu'après avoir vu le logement.",
 "Das ist eine Anfrage, keine Zahlung. Der Anbieter nimmt an oder lehnt ab, und Sie unterschreiben und zahlen erst, nachdem Sie die Wohnung gesehen haben.",
 "Questa è una richiesta, non un pagamento. L'host accetta o rifiuta, e tu firmi e paghi solo dopo aver visto la casa."),
"Message us": ("Écrivez-nous", "Schreiben Sie uns", "Scrivici"),
"Continue on Messenger": ("Continuer sur Messenger", "Auf Messenger fortfahren", "Continua su Messenger"),
"Send on Messenger": ("Envoyer sur Messenger", "Über Messenger senden", "Invia su Messenger"),
"Send it on Messenger instead": ("L'envoyer plutôt sur Messenger", "Stattdessen über Messenger senden", "Invialo invece su Messenger"),
"We couldn’t send your request online just now. Nothing is lost: tap below, and Messenger opens with your request copied — paste it if it isn’t filled in.": (
 "Nous n'avons pas pu envoyer votre demande en ligne à l'instant. Rien n'est perdu : touchez ci-dessous et Messenger s'ouvre avec votre demande copiée — collez-la si elle n'apparaît pas.",
 "Wir konnten Ihre Anfrage gerade nicht online senden. Es geht nichts verloren: Tippen Sie unten, und Messenger öffnet sich mit Ihrer kopierten Anfrage — fügen Sie sie ein, falls sie nicht schon dort steht.",
 "Non siamo riusciti a inviare la richiesta online in questo momento. Non si perde niente: tocca qui sotto e Messenger si apre con la tua richiesta copiata — incollala se non compare già."),
"Prefer to chat? Messenger opens with your request copied, so you can paste it if it isn’t filled in.": (
 "Vous préférez discuter ? Messenger s'ouvre avec votre demande copiée : collez-la si elle n'apparaît pas.",
 "Lieber chatten? Messenger öffnet sich mit Ihrer kopierten Anfrage, die Sie einfügen können, falls sie nicht schon dort steht.",
 "Preferisci scrivere in chat? Messenger si apre con la tua richiesta copiata, così puoi incollarla se non compare già."),
"Email us": ("Écrivez-nous par e-mail", "Schreiben Sie uns eine E-Mail", "Scrivici via e-mail"),
"Email us a copy": ("Envoyez-nous une copie par e-mail", "Senden Sie uns eine Kopie per E-Mail", "Mandaci una copia via e-mail"),
"Send it by email": ("L'envoyer par e-mail", "Per E-Mail senden", "Invialo via e-mail"),
"Send it by email instead": ("L'envoyer plutôt par e-mail", "Stattdessen per E-Mail senden", "Invialo invece via e-mail"),
"We couldn’t send your request online just now. Nothing is lost: tap below and your email opens with the request already written.": (
 "Nous n'avons pas pu envoyer votre demande en ligne à l'instant. Rien n'est perdu : touchez ci-dessous et votre messagerie s'ouvre avec la demande déjà rédigée.",
 "Wir konnten Ihre Anfrage gerade nicht online senden. Es geht nichts verloren: Tippen Sie unten, und Ihr E-Mail-Programm öffnet sich mit der bereits geschriebenen Anfrage.",
 "Non siamo riusciti a inviare la richiesta online in questo momento. Non si perde niente: tocca qui sotto e la tua e-mail si apre con la richiesta già scritta."),
"If nothing opens, copy the text below and send it to": (
 "Si rien ne s'ouvre, copiez le texte ci-dessous et envoyez-le à",
 "Falls sich nichts öffnet, kopieren Sie den Text unten und senden Sie ihn an",
 "Se non si apre niente, copia il testo qui sotto e invialo a"),
"Rather write to us? The email opens with your request already in it.": (
 "Vous préférez nous écrire ? L'e-mail s'ouvre avec votre demande déjà dedans.",
 "Lieber schreiben? Die E-Mail öffnet sich mit Ihrer Anfrage darin.",
 "Preferisci scriverci? L'e-mail si apre con la tua richiesta già dentro."),
"Find me a home": ("Trouvez-moi un logement", "Finden Sie eine Wohnung für mich", "Trovami una casa"),
"Book a viewing": ("Réserver une visite", "Besichtigung buchen", "Prenota una visita"),
"Request to book": ("Demande de réservation", "Buchung anfragen", "Richiesta di prenotazione"),
"Choose a home first.": ("Choisissez d'abord un logement.", "Wählen Sie zuerst eine Wohnung.", "Scegli prima una casa."),
"Pick at least one date and time for the viewing.": (
 "Choisissez au moins une date et une heure pour la visite.",
 "Wählen Sie mindestens einen Termin für die Besichtigung.",
 "Scegli almeno una data e un orario per la visita."),
"Pick both a date and a time for each choice.": (
 "Indiquez à la fois une date et une heure pour chaque proposition.",
 "Geben Sie für jeden Vorschlag Datum und Uhrzeit an.",
 "Indica sia la data sia l'orario per ogni proposta."),
"Add a move-in date.": ("Ajoutez une date d'arrivée.", "Geben Sie ein Einzugsdatum an.", "Aggiungi una data di ingresso."),
"Add a move-out date.": ("Ajoutez une date de départ.", "Geben Sie ein Auszugsdatum an.", "Aggiungi una data di uscita."),
"Move-out must be after move-in.": (
 "Le départ doit être postérieur à l'arrivée.",
 "Der Auszug muss nach dem Einzug liegen.",
 "L'uscita deve essere successiva all'ingresso."),
"Add your name.": ("Indiquez votre nom.", "Geben Sie Ihren Namen an.", "Aggiungi il tuo nome."),
"Add an email address we can reply to.": (
 "Indiquez une adresse e-mail à laquelle nous pouvons répondre.",
 "Geben Sie eine E-Mail-Adresse an, an die wir antworten können.",
 "Aggiungi un indirizzo e-mail a cui possiamo rispondere."),
"Tick the box so we are allowed to contact you about this request.": (
 "Cochez la case pour nous autoriser à vous contacter au sujet de cette demande.",
 "Setzen Sie das Häkchen, damit wir Sie zu dieser Anfrage kontaktieren dürfen.",
 "Spunta la casella per autorizzarci a contattarti su questa richiesta."),

# -------------------------------------------------------- rentleaks-verify.js
"Verification desk": ("Bureau de vérification", "Prüfstelle", "Sportello verifiche"),
"Prove who you are, and that this place is yours to let": (
 "Prouvez qui vous êtes, et que ce logement est bien à vous de louer",
 "Weisen Sie nach, wer Sie sind und dass Sie diese Wohnung vermieten dürfen",
 "Dimostra chi sei e che questa casa è tua da affittare"),
"Nothing you capture here leaves this device.": (
 "Rien de ce que vous capturez ici ne quitte cet appareil.",
 "Nichts, was Sie hier aufnehmen, verlässt dieses Gerät.",
 "Nulla di ciò che acquisisci qui esce da questo dispositivo."),
"Wipe everything now": ("Tout effacer maintenant", "Jetzt alles löschen", "Cancella tutto adesso"),
"First": ("D'abord", "Zuerst", "Prima di tutto"),
"Which of these are you?": ("Lequel êtes-vous ?", "Was trifft auf Sie zu?", "Quale di questi sei?"),
"Does the landlord know?": ("Le propriétaire est-il au courant ?", "Weiß der Vermieter Bescheid?", "Il proprietario lo sa?"),
"Date you served the request": (
 "Date d'envoi de la demande",
 "Datum der Zustellung des Antrags",
 "Data in cui hai notificato la richiesta"),
"We will build the packet.": ("Nous constituerons le dossier.", "Wir stellen die Unterlagen zusammen.", "Prepariamo noi il fascicolo."),
"Sign the disclosure": ("Signer la déclaration", "Die Erklärung unterschreiben", "Firma la dichiarazione"),
"Type your full legal name to sign": (
 "Saisissez votre nom légal complet pour signer",
 "Geben Sie zum Unterschreiben Ihren vollständigen Namen ein",
 "Scrivi il tuo nome e cognome per firmare"),
"Sign and finish": ("Signer et terminer", "Unterschreiben und abschließen", "Firma e concludi"),
"Your full legal name": ("Votre nom légal complet", "Ihr vollständiger Name", "Il tuo nome e cognome"),
"Scan your ID": ("Scannez votre pièce d'identité", "Ausweis scannen", "Scansiona il documento"),
"Both sides of a passport, driving licence or national ID. We check the capture is readable before you send it.": (
 "Les deux faces d'un passeport, d'un permis de conduire ou d'une carte d'identité. Nous vérifions que la capture est lisible avant l'envoi.",
 "Beide Seiten von Reisepass, Führerschein oder Personalausweis. Wir prüfen vor dem Senden, ob die Aufnahme lesbar ist.",
 "Entrambi i lati di passaporto, patente o carta d'identità. Controlliamo che l'acquisizione sia leggibile prima dell'invio."),
"Take a selfie": ("Prenez un selfie", "Machen Sie ein Selfie", "Scatta un selfie"),
"Matched against the photograph on the document, with a short movement check so a still photo cannot pass.": (
 "Comparé à la photo du document, avec un court test de mouvement pour qu'une photo figée ne passe pas.",
 "Wird mit dem Foto im Dokument abgeglichen, mit einer kurzen Bewegungsprüfung, damit ein Standbild nicht durchkommt.",
 "Confrontato con la foto del documento, con una breve verifica di movimento perché una foto ferma non passi."),
"Show you can let it": ("Montrez que vous pouvez la louer", "Zeigen Sie, dass Sie vermieten dürfen", "Dimostra di poterla affittare"),
"Close the loop": ("Boucler la boucle", "Den Kreis schließen", "Chiudi il cerchio"),
"Steps 1 and 2. It says we know who you are.": (
 "Étapes 1 et 2. Cela signifie que nous savons qui vous êtes.",
 "Schritte 1 und 2. Es besagt, dass wir wissen, wer Sie sind.",
 "Passaggi 1 e 2. Vuol dire che sappiamo chi sei."),
"Listing verified": ("Annonce vérifiée", "Inserat geprüft", "Annuncio verificato"),
"Begin": ("Commencer", "Beginnen", "Inizia"),
"Start": ("Démarrer", "Starten", "Avvia"),
"No back side": ("Pas de verso", "Keine Rückseite", "Nessun retro"),
"Now a photograph of you": ("Maintenant une photo de vous", "Jetzt ein Foto von Ihnen", "Ora una foto di te"),
"Retake": ("Reprendre", "Neu aufnehmen", "Rifai"),
"Starting the camera…": ("Démarrage de la caméra…", "Kamera wird gestartet…", "Avvio della fotocamera…"),
"Capture": ("Capturer", "Aufnehmen", "Acquisisci"),
"Readable": ("Lisible", "Lesbar", "Leggibile"),
"Accepted with warnings": ("Accepté avec réserves", "Mit Hinweisen angenommen", "Accettato con riserve"),
"The address you are verifying": (
 "L'adresse que vous vérifiez",
 "Die Adresse, die Sie nachweisen",
 "L'indirizzo che stai verificando"),
"The code we post to the property": (
 "Le code que nous envoyons par courrier au logement",
 "Der Code, den wir an die Wohnung schicken",
 "Il codice che spediamo all'immobile"),
"Code from the card": ("Code figurant sur la carte", "Code von der Karte", "Codice riportato sulla cartolina"),
"Posted to": ("Envoyé à", "Verschickt an", "Spedito a"),
". Not arrived yet? Continue without it and come back — the listing publishes either way.": (
 ". Pas encore arrivé ? Continuez sans lui et revenez plus tard — l'annonce se publie dans tous les cas.",
 ". Noch nicht angekommen? Fahren Sie ohne ihn fort und kommen Sie zurück — das Inserat wird so oder so veröffentlicht.",
 ". Non è ancora arrivato? Vai avanti senza e torna più tardi — l'annuncio viene pubblicato comunque."),
"It has not arrived yet": ("Il n'est pas encore arrivé", "Er ist noch nicht angekommen", "Non è ancora arrivato"),
"Finish": ("Terminer", "Abschließen", "Concludi"),
"Result": ("Résultat", "Ergebnis", "Esito"),
"Everything you captured has been wiped.": (
 "Tout ce que vous avez capturé a été effacé.",
 "Alles, was Sie aufgenommen haben, wurde gelöscht.",
 "Tutto ciò che hai acquisito è stato cancellato."),
"Go to my listings": ("Aller à mes annonces", "Zu meinen Inseraten", "Vai ai miei annunci"),
"Run it again": ("Recommencer", "Erneut durchlaufen", "Rifallo"),
"Choose a file instead — a photograph you have already taken works exactly as well, and gets the same quality check.": (
 "Choisissez plutôt un fichier — une photo que vous avez déjà prise convient tout aussi bien et passe le même contrôle de qualité.",
 "Wählen Sie stattdessen eine Datei — ein bereits aufgenommenes Foto funktioniert genauso gut und durchläuft dieselbe Qualitätsprüfung.",
 "Scegli invece un file — una foto che hai già scattato va altrettanto bene e passa lo stesso controllo di qualità."),
"Camera unavailable — use “choose a file” below.": (
 "Caméra indisponible — utilisez « choisir un fichier » ci-dessous.",
 "Kamera nicht verfügbar — nutzen Sie unten „Datei auswählen“.",
 "Fotocamera non disponibile — usa «scegli un file» qui sotto."),
"Verification progress": ("Avancement de la vérification", "Fortschritt der Prüfung", "Avanzamento della verifica"),
"Captured image, held in memory only": (
 "Image capturée, conservée uniquement en mémoire",
 "Aufgenommenes Bild, nur im Arbeitsspeicher gehalten",
 "Immagine acquisita, tenuta solo in memoria"),
"Your role": ("Votre rôle", "Ihre Rolle", "Il tuo ruolo"),
"ID front": ("Pièce d'identité, recto", "Ausweis Vorderseite", "Documento, fronte"),
"ID back": ("Pièce d'identité, verso", "Ausweis Rückseite", "Documento, retro"),
"Selfie": ("Selfie", "Selfie", "Selfie"),
"Disclosure": ("Déclaration", "Erklärung", "Dichiarazione"),
"Posted code": ("Code envoyé par courrier", "Zugesandter Code", "Codice spedito"),
"Look straight at the camera and hold still": (
 "Regardez droit vers la caméra et ne bougez plus",
 "Schauen Sie gerade in die Kamera und halten Sie still",
 "Guarda dritto verso la fotocamera e resta fermo"),
"Turn your head slowly to your left": (
 "Tournez lentement la tête vers votre gauche",
 "Drehen Sie den Kopf langsam nach links",
 "Gira lentamente la testa verso sinistra"),
"Move a little closer to the camera": (
 "Rapprochez-vous un peu de la caméra",
 "Gehen Sie etwas näher an die Kamera",
 "Avvicinati un po' alla fotocamera"),
"I own this home": ("Je suis propriétaire de ce logement", "Diese Wohnung gehört mir", "Sono il proprietario di questa casa"),
"You hold title, or your company does.": (
 "Vous détenez le titre de propriété, ou votre société le détient.",
 "Sie oder Ihr Unternehmen stehen im Grundbuch.",
 "Il titolo è tuo, oppure della tua società."),
"I manage it for the owner": ("Je la gère pour le propriétaire", "Ich verwalte sie für den Eigentümer", "La gestisco per il proprietario"),
"An agent, a management company, or a leaseholder letting with permission.": (
 "Un agent, une société de gestion, ou un preneur à bail qui loue avec autorisation.",
 "Ein Makler, eine Hausverwaltung oder ein Mieter, der mit Erlaubnis weitervermietet.",
 "Un agente, una società di gestione o un conduttore che affitta con autorizzazione."),
"A lease-break, a sublet or a takeover. You are not the owner and you do not need to be.": (
 "Une reprise de bail, une sous-location ou une cession. Vous n'êtes pas propriétaire, et vous n'avez pas à l'être.",
 "Eine Nachmietersuche, eine Untermiete oder eine Übernahme. Sie sind nicht der Eigentümer und müssen es nicht sein.",
 "Un subentro, un subaffitto o una cessione. Non sei il proprietario e non devi esserlo."),
"I have written consent from the landlord": (
 "J'ai l'accord écrit du propriétaire",
 "Ich habe die schriftliche Zustimmung des Vermieters",
 "Ho il consenso scritto del proprietario"),
"A letter or email from the landlord or managing agent, naming the incoming person or approving the sublet in principle.": (
 "Un courrier ou un e-mail du propriétaire ou du gestionnaire, nommant la personne entrante ou approuvant la sous-location dans son principe.",
 "Ein Brief oder eine E-Mail des Vermieters oder der Hausverwaltung, die den Nachmieter benennt oder die Untermiete grundsätzlich billigt.",
 "Una lettera o una e-mail del proprietario o dell'amministratore, che indichi la persona in ingresso o approvi il subaffitto in linea di principio."),
"I served a request and they never answered": (
 "J'ai envoyé une demande et ils n'ont jamais répondu",
 "Ich habe einen Antrag gestellt und nie eine Antwort bekommen",
 "Ho notificato una richiesta e non hanno mai risposto"),
"I have not asked yet": ("Je n'ai pas encore demandé", "Ich habe noch nicht gefragt", "Non l'ho ancora chiesto"),
"Deed or property tax record": ("Acte de propriété ou avis de taxe foncière", "Grundbuchauszug oder Grundsteuerbescheid", "Atto di proprietà o documento catastale"),
"Mortgage statement": ("Relevé de prêt immobilier", "Darlehensauszug", "Estratto del mutuo"),
"Utility bill": ("Facture d'énergie", "Nebenkostenrechnung", "Bolletta"),
"Utility bill for the property": ("Facture d'énergie au nom du logement", "Nebenkostenrechnung für die Wohnung", "Bolletta intestata all'immobile"),
"Utility bill in your name at this address": (
 "Facture d'énergie à votre nom à cette adresse",
 "Nebenkostenrechnung auf Ihren Namen an dieser Adresse",
 "Bolletta a tuo nome a questo indirizzo"),
"HOA, co-op or condo statement": (
 "Appel de charges de copropriété",
 "Abrechnung der Eigentümergemeinschaft",
 "Rendiconto condominiale"),
"A maintenance or common-charge statement in your name.": (
 "Un appel de charges ou de travaux à votre nom.",
 "Eine Instandhaltungs- oder Hausgeldabrechnung auf Ihren Namen.",
 "Un rendiconto di spese condominiali o di manutenzione a tuo nome."),
"Management agreement": ("Mandat de gestion", "Verwaltervertrag", "Contratto di gestione"),
"Written authorisation from the owner": (
 "Autorisation écrite du propriétaire",
 "Schriftliche Ermächtigung des Eigentümers",
 "Autorizzazione scritta del proprietario"),
"Your lease": ("Votre bail", "Ihr Mietvertrag", "Il tuo contratto"),
"Sublet or assignment rider": (
 "Avenant de sous-location ou de cession",
 "Nachtrag zu Untermiete oder Vertragsübernahme",
 "Appendice di subaffitto o cessione"),
"This is my primary residence and I intend to return to it.": (
 "C'est ma résidence principale et j'ai l'intention d'y revenir.",
 "Das ist mein Hauptwohnsitz und ich beabsichtige zurückzukehren.",
 "Questa è la mia residenza principale e intendo tornarci."),
"I have stated whether this unit is rent-regulated, and I know what that caps me at.": (
 "J'ai indiqué si ce logement est à loyer encadré, et je sais à quoi cela me plafonne.",
 "Ich habe angegeben, ob diese Wohnung preisgebunden ist, und ich weiß, worauf mich das begrenzt.",
 "Ho dichiarato se questa unità è a canone regolamentato, e so a quanto questo mi limita."),
"I am not charging any access, key, finder’s or takeover fee.": (
 "Je ne facture aucun frais d'accès, de clés, de recherche ni de reprise.",
 "Ich berechne keine Zugangs-, Schlüssel-, Vermittlungs- oder Übernahmegebühr.",
 "Non addebito alcuna spesa di accesso, chiavi, intermediazione o subentro."),
"The rent, the term, the deposit and the fees on my listing are accurate and complete.": (
 "Le loyer, la durée, le dépôt de garantie et les frais indiqués dans mon annonce sont exacts et complets.",
 "Miete, Laufzeit, Kaution und Gebühren in meinem Inserat sind richtig und vollständig.",
 "Canone, durata, deposito e spese indicati nel mio annuncio sono esatti e completi."),
"I will not hand over keys before the landlord’s consent is settled.": (
 "Je ne remettrai pas les clés avant que l'accord du propriétaire soit réglé.",
 "Ich übergebe keine Schlüssel, bevor die Zustimmung des Vermieters geklärt ist.",
 "Non consegnerò le chiavi prima che il consenso del proprietario sia definito."),
}


def main():
    langs = ("fr", "de", "it")
    for i, code in enumerate(langs):
        path = os.path.join(ROOT, "locales", f"{code}.json")
        d = json.loads(io.open(path, encoding="utf-8").read(),
                       object_pairs_hook=collections.OrderedDict)
        added = skipped = 0
        for en, trio in T.items():
            if len(trio) != 3:
                sys.exit(f"{en!r}: expected three translations, got {len(trio)}")
            if en in d["ui"]:
                skipped += 1
                continue
            d["ui"][en] = trio[i]
            added += 1
        io.open(path, "w", encoding="utf-8").write(
            json.dumps(d, ensure_ascii=False, indent=2) + "\n")
        print(f"locales/{code}.json  +{added} added, {skipped} already present  ->  {len(d['ui'])} strings")


if __name__ == "__main__":
    main()
