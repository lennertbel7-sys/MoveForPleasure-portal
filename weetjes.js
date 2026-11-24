// ============================================================
// weetjes.js — een vaste verzameling weetjes over bewegen
//
// Gebruikt door:
//   - de app (app/berichten.js): elke maandag verschijnt er
//     automatisch een nieuw "Weetje van de week" bij Berichten.
//   - de adminpagina (admin.js): de knop "🎲 Willekeurig weetje"
//     vult er één in het berichtformulier in.
//
// Nieuwe weetjes toevoegen? Zet ze gewoon onderaan de lijst.
// Houd ze vrolijk, kort en zonder medisch advies.
// ============================================================

const weetjes = [
  { titel: "Je hart is een spier", tekst: "Net als je benen wordt ook je hart sterker als je het regelmatig laat werken. Een sterker hart pompt meer bloed per slag, en hoeft daardoor minder vaak te kloppen." },
  { titel: "Wandelen telt écht", tekst: "Stevig doorstappen is al matig intensief bewegen. Je hoeft dus geen hardloper te zijn om goed bezig te zijn: een flinke wandeling telt volledig mee." },
  { titel: "Spierpijn is normaal", tekst: "Spierpijn een dag of twee na een nieuwe oefening is heel gewoon. Je spieren passen zich aan de nieuwe belasting aan. Rustig blijven bewegen helpt vaak juist." },
  { titel: "Bewegen maakt vrolijk", tekst: "Tijdens het bewegen maakt je lichaam stofjes aan zoals endorfine. Daarom voel je je na een wandeling of training vaak opgeruimder en ontspannener." },
  { titel: "Rust is ook training", tekst: "Sterker worden gebeurt niet tijdens de training zelf, maar erna, als je lichaam herstelt. Rustdagen horen dus gewoon bij je plan." },
  { titel: "Slaap en bewegen zijn vrienden", tekst: "Mensen die regelmatig bewegen, vallen vaak makkelijker in slaap en slapen dieper. En wie goed slaapt, heeft weer meer zin om te bewegen." },
  { titel: "Kleine stukjes tellen op", tekst: "Drie keer tien minuten bewegen op een dag telt net zo goed als één keer dertig minuten. Elke trap, elk wandelingetje, elk dansje doet mee." },
  { titel: "Gewoontes hebben tijd nodig", tekst: "Een nieuwe gewoonte voelt pas na een paar weken tot maanden vanzelfsprekend. Lukt het nog niet elke keer? Dat is normaal, blijf gewoon opnieuw beginnen." },
  { titel: "Opwarmen loont", tekst: "Een paar minuten rustig opwarmen maakt je spieren soepeler en je hartslag stijgt geleidelijk. Zo voelt de rest van je training vaak een stuk lichter." },
  { titel: "Drink een slokje water", tekst: "Bij het bewegen verlies je vocht via zweet. Een glas water voor en na het sporten helpt je fris te blijven, zeker op warme dagen." },
  { titel: "Spieren zijn er voor het leven", tekst: "Krachttraining is goed op elke leeftijd. Ook als je pas later begint, kunnen je spieren nog flink sterker worden." },
  { titel: "Je botten houden van beweging", tekst: "Bewegen waarbij je je eigen gewicht draagt, zoals wandelen, traplopen of springen, helpt je botten sterk te houden." },
  { titel: "Buiten bewegen geeft extra energie", tekst: "Bewegen in de natuur of gewoon buiten voelt voor veel mensen extra ontspannend. Daglicht helpt bovendien je dag- en nachtritme op koers te houden." },
  { titel: "Samen houd je het langer vol", tekst: "Met een vriend(in) afspreken om te bewegen maakt het niet alleen leuker, je slaat ook minder snel over. Je wilt de ander tenslotte niet laten wachten!" },
  { titel: "Muziek als turbo", tekst: "Met je favoriete muziek op voelt bewegen voor veel mensen makkelijker en leuker. Een vrolijke playlist kan zomaar je beste trainingsmaatje zijn." },
  { titel: "Traplopen is een mini-workout", tekst: "Traplopen laat je beenspieren en je hart en longen flink werken. Kies vaker de trap: het is een gratis training die je overal tegenkomt." },
  { titel: "Plezier wint van discipline", tekst: "Mensen die een sport kiezen die ze echt leuk vinden, houden het veel langer vol. Zoek dus vooral wat jij fijn vindt, niet wat 'moet'." },
  { titel: "Je longen werken mee", tekst: "Als je beweegt, adem je dieper en sneller. Regelmatig bewegen traint je ademhalingsspieren, waardoor inspanning na een tijdje makkelijker aanvoelt." },
  { titel: "Zitten onderbreken helpt", tekst: "Lang stilzitten is niet goed voor je lichaam. Even opstaan, rekken of een rondje lopen om het half uur maakt al verschil." },
  { titel: "Dansen is volwaardig bewegen", tekst: "Dansen traint je conditie, je evenwicht én je coördinatie. En het is gewoon heel leuk. Dansen in de woonkamer telt dus mee!" },
  { titel: "Evenwicht kun je trainen", tekst: "Even op één been staan terwijl je je tanden poetst? Zo train je je evenwicht, iets wat je je hele leven goed van pas komt." },
  { titel: "Je brein beweegt mee", tekst: "Bewegen zorgt voor meer doorbloeding in je hersenen. Veel mensen merken dat ze na een wandeling helderder kunnen nadenken." },
  { titel: "Fietsen is goed voor je knieën", tekst: "Fietsen is een sport waarbij je gewrichten weinig schokken krijgen. Daardoor is het voor veel mensen een fijne manier om hun conditie op te bouwen." },
  { titel: "Zwemmen draagt je", tekst: "In het water draagt het water een groot deel van je gewicht. Zo kun je je hele lichaam trainen terwijl je gewrichten gespaard blijven." },
  { titel: "Rekken voelt goed", tekst: "Rustig rekken na het bewegen kan prettig ontspannend voelen. Doe het zacht en zonder te forceren: het mag nooit pijn doen." },
  { titel: "Progressie is geleidelijk", tekst: "Je lichaam wordt sterker als je het stap voor stap een beetje meer vraagt. Een beetje meer gewicht, een minuutje langer: kleine stappen werken het best." },
  { titel: "Elke stap telt", tekst: "Er is geen magisch aantal stappen dat je moet halen. Elke stap meer dan gisteren is al winst, hoe klein ook." },
  { titel: "Een slechte dag mag", tekst: "Sommige trainingen voelen zwaar, en dat is oké. Ook op zo'n dag heb je je lichaam iets goeds gegeven. Morgen is een nieuwe kans." },
  { titel: "Plannen helpt", tekst: "Wie vooraf vastlegt wanneer en waar hij gaat bewegen, doet het vaker ook echt. Probeer het eens in je weekplanning hier in de app!" },
  { titel: "Je hartslag vertelt veel", tekst: "Een vuistregel: als je nog kunt praten maar niet meer kunt zingen, beweeg je matig intensief. Kun je nog zingen? Dan mag het iets steviger." },
  { titel: "Je lichaam went snel", tekst: "Na enkele weken regelmatig bewegen voelt dezelfde inspanning vaak al lichter. Dat is het teken dat je conditie beter wordt!" },
  { titel: "Ochtend of avond?", tekst: "Het beste moment om te bewegen is het moment dat bij jóu past. Of dat nu 's ochtends vroeg of 's avonds laat is: wat je volhoudt, werkt." },
  { titel: "Krachttraining zonder gewichten", tekst: "Je eigen lichaam is een prima trainingsmiddel. Squats, push-ups tegen de muur of een plank: je hebt geen sportschool nodig om sterker te worden." },
  { titel: "Lachen is ook een beetje sporten", tekst: "Bij een stevige lachbui werken je buikspieren en je ademhaling mee. Bewegen met vrienden en veel lachen is dus dubbel goed." },
  { titel: "Variatie houdt het fris", tekst: "Afwisselen tussen verschillende soorten beweging traint telkens andere spieren én houdt het leuk. Kracht en cardio vullen elkaar mooi aan." },
  { titel: "Je houding dankt je", tekst: "Sterke rug- en buikspieren helpen je rechtop te staan en te zitten. Krachttraining is dus ook goed voor je dagelijkse houding." },
  { titel: "Tuinieren telt mee", tekst: "Spitten, harken, bukken en tillen: tuinieren is verrassend actief. Ook klussen in huis of de auto wassen zorgt voor beweging." },
  { titel: "Wandelvergadering?", tekst: "Bellen kan prima al wandelend. Zo combineer je werk of een babbel met wat extra beweging." },
  { titel: "Ademhaling bij krachttraining", tekst: "Houd je adem niet in tijdens het tillen. Een handige regel: uitademen bij de zware beweging, inademen bij het terugkeren." },
  { titel: "Je eigen tempo is het juiste tempo", tekst: "Iedereen begint ergens. Vergelijk jezelf niet met anderen, maar met jezelf van een maand geleden. Daar zie je de echte vooruitgang." },
  { titel: "Bewegen geeft energie", tekst: "Moe? Een korte wandeling geeft vaak méér energie dan dat het kost. Probeer het eens als je je slap voelt na de middag." },
  { titel: "Touwspringen is topcardio", tekst: "Touwspringen laat je hart flink werken en traint tegelijk je coördinatie. Een paar minuten is al een stevige workout. Begin rustig!" },
  { titel: "Racketsporten zijn sociaal", tekst: "Padel, tennis of badminton combineren beweging met spel en gezelschap. Je bent zo druk met het spel dat je bijna vergeet dat je aan het sporten bent." },
  { titel: "Vier je mijlpalen", tekst: "Jezelf belonen na een gehaald doel helpt je gemotiveerd te blijven. Een badge, een nieuw sportshirt of gewoon trots zijn: je verdient het!" },
  { titel: "Wintersporten binnenshuis", tekst: "Slecht weer? Een online dansles, een paar oefeningen in de woonkamer of traplopen in huis houden je ook in de winter in beweging." },
  { titel: "Schoenen maken verschil", tekst: "Goede, passende schoenen maken wandelen en lopen een stuk comfortabeler. Voelen je schoenen versleten aan? Misschien is het tijd voor een nieuw paar." },
  { titel: "Je spieren hebben geheugen", tekst: "Heb je een tijdje niet bewogen? Goed nieuws: wat je eerder opbouwde, komt vaak sneller terug dan de eerste keer. Opnieuw beginnen loont altijd." },
  { titel: "Bewegen en stress", tekst: "Bewegen helpt veel mensen om stress los te laten. Een wandeling of een korte training kan net de pauze zijn die je hoofd nodig heeft." },
  { titel: "De eerste stap is de moeilijkste", tekst: "Het lastigste moment is vaak het moment voor je begint. Spreek met jezelf af dat je maar vijf minuten doet: meestal ga je daarna vanzelf door." },
  { titel: "Wandelen na het eten", tekst: "Een rustig wandelingetje na de maaltijd voelt voor veel mensen fijn en licht. Een mooie gewoonte om je dag mee af te sluiten." },
  { titel: "Je bent sterker dan je denkt", tekst: "Kijk eens terug in je agenda hier in de app: elk stipje is een moment waarop je voor jezelf koos. Dat is iets om trots op te zijn." },
  { titel: "Een heel jaar weetjes!", tekst: "Dit was weetje nummer 52. Als je ze allemaal gelezen hebt, ben je al een jaar met bewegen bezig. Wat een prestatie, ga zo door! 🧡" }
];

// Telt de weken sinds maandag 1 januari 2024. Zo krijgt elke week
// (van maandag tot zondag) een ander weetje, ook over de jaarwisseling heen.
function weekNummerSindsStart(datum = new Date()) {
  const start = new Date(2024, 0, 1); // een maandag
  const d = new Date(datum.getFullYear(), datum.getMonth(), datum.getDate());
  return Math.floor((d - start) / (7 * 86400000));
}

function weetjeVanDeWeek(datum = new Date()) {
  const week = weekNummerSindsStart(datum);
  const maandag = new Date(2024, 0, 1 + week * 7, 8, 0); // maandag 8:00
  return {
    ...weetjes[week % weetjes.length],
    id: "weetje-week-" + week,
    categorie: "weetje",
    vastgepind: false,
    gepubliceerd_op: maandag.toISOString(),
    automatisch: true
  };
}

// Willekeurig weetje (voor de adminknop), liefst niet hetzelfde als het vorige
function willekeurigWeetje(nietDezeTitel) {
  const keuze = weetjes.filter(w => w.titel !== nietDezeTitel);
  return keuze[Math.floor(Math.random() * keuze.length)];
}
