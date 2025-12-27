// ein skript welches die informationen zu allen gespeicherten lehrpfäden enthält; 
// diese werden über die ID in der URL des QR codes bestimmt
// die entsprechenden variablen werden hier gesetzt.

// im format von: https://meine-seite.de/projekt?id=123
const urlParams = new URLSearchParams(window.location.search);
const projektId = urlParams.get("id");

// festlegen von globalen variablen

let globalXML = null;
// XML daten Laden, also die Konfiguration der Pfade
// MUSS initial asynchron laufen, sonst gibt es später fehler wenn das xml nicht rechtzeitig lädt!!
async function initialisierung() {
    const res = await fetch('./LehrpfadeConfig.xml');
    const xmlString = await res.text();

    const parser = new DOMParser();
    globalXML = parser.parseFromString(xmlString, "application/xml");

    // 🔹 NUR wenn eine ID existiert
    if (projektId) {
        loadLehrpfad(projektId, globalXML);
    }
}

initialisierung();

// der name der später in der URL angezeigt wird
window.urlName = "";
// setzt die anzahl der stationen fest (oben in der )
window.stationsCount = 0;
// anzahl der abgeschlossenen stationen
window.stationsComplete = [];
// legt die dateien, namen und koordinaten auf der karte der stationen fest
window.stations = [
    {},
    {}
];
window.aktuelleStationId = 0;

// alles was nach dem laden der xml gemacht werden muss unten in der funktion aufrufen, sonst bekommt man leere ergebnisse
// weil die xml noch nicht eingelesen ist
function loadLehrpfad(ID, xml) {

    // schauen ob xml geladen
    if (!globalXML) {
        throw new Error("XML noch nicht geladen");
    }

    // lehrpfade laden
    const lehrpfade = [...globalXML.getElementsByTagName("Lehrpfad")];

    // den lehrpfad raussuchen der mit project id übereinstimmt
    const pfad = lehrpfade.find(p =>
        p.getElementsByTagName("PfadId")[0].textContent === projektId
    );

    //fehlerbehandlung falls id im qr code falsch
    if (!pfad) {
        throw new Error("Kein Lehrpfad mit ID " + projektId);
    }

    // setzt werte
    window.urlName = pfad.getElementsByTagName("UrlName")[0].textContent;
    window.ordnerPath = pfad.getElementsByTagName("OrdnerPfad")[0].textContent;
    window.stationsCount = parseInt(
        pfad.getElementsByTagName("StationsCount")[0].textContent
    );

    // stationen auslesen
    const stationXML = [...pfad.getElementsByTagName("Station")];

    // mapping auf die window.stations struktur
    window.stations = stationXML.map(s => ({
        name: s.getElementsByTagName("Name")[0].textContent,
        url: s.getElementsByTagName("Url")[0].textContent,
        icon: s.getElementsByTagName("Icon")[0].textContent,
        koords: {
            x: parseInt(s.getElementsByTagName("X")[0].textContent),
            y: parseInt(s.getElementsByTagName("Y")[0].textContent)
        }
    }));


    // HIER ALLES LADEN WAS NACH DEM LADEN DER XML GEMACHT WIRD:

    // setzt den titel der seite
    document.title = window.urlName;

    // baut das submenü unter der karte auf
    submenu(window.stations);

    // legt hier die anzahl der stationen in der fortschrittsanzeige oben fest
    statusleisteSetzen();

    // setzt die navigationselemente für die Stationen auf die Karte
    // Karte ist hier noch nicht geladen, daher verlegt in Startseite.html
    //stationenAufKarteSetzen();

}

// setzt die einträge der stationen im submenü
function submenu(items) {
    const submenu = document.getElementById("karte-submenu");
    submenu.innerHTML = ""; // vorher leeren, nötig bei mehreren Pfaden in der Zukunft?

    // für jedes festgelegte item in der liste der stationen werden name und URL aufruf hinterlegt
    items.forEach((item, index) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = "#";
        a.textContent = item.name;
        // hier ist der URL aufruf eingebaut
        a.onclick = function () {
            // zusammenbauen aus ordnerPfad (da liegen alle bilder etc zum jeweiligen lehrpfad) und der URL der jeweiligen station 
            loadSection(window.ordnerPath + "/" + item.url);
            window.aktuelleStationId = index + 1;
            return false;
        };
        // hinzufügen an das menü unter der karte
        li.appendChild(a);
        submenu.appendChild(li);
    });
}

// Funktion für den zurück auf die karte button bzw. den station abschliessen button
// Wird aufgerufen, nachdem eine Section geladen wird
function updateKarteButton(url) {
    const btn = document.getElementById("karte-button");

    // Auf der Karte → Button ausblenden
    if (url.includes("karte.html")) {
        window.aktuelleStationId = null;
        btn.style.display = "none";
        return;
    }

    // Nicht auf Karte → Button anzeigen
    btn.style.display = "block";

    // Änderung des Button-Textes
    if (window.aktuelleStationId) {
        btn.textContent = "Station abschließen";
    } else {
        btn.textContent = "Zurück zur Karte";
    }
}

// Wird beim Klick auf den Button ausgeführt
function navigationsButtonClick() {

    // Falls eine Station aktiv ist → als abgeschlossen markieren
    if (window.aktuelleStationId) {
        stationsComplete.push(window.aktuelleStationId - 1); // minus eins da in der statusleiste bei 0 startet aber stations IDS ab 1 starten
        console.log("Station abgeschlossen:", window.aktuelleStationId);
        window.aktuelleStationId = null;

        // Statusleiste sofort aktualisieren
        statusleisteSetzen();
        // stationsicons aktualisieren
        stationenAufKarteSetzen();
    }

    // Zurück zur Karte
    loadSection("karte.html");
}


// setzt die fortschrittsanzeige
function statusleisteSetzen() {
    // navbar als container bekommen
    const progressContainer = document.getElementById('progress-container');
    progressContainer.innerHTML = ""; // reset

    // einzelne stationen erzeugen
    for (let i = 0; i < window.stationsCount; i++) {

        const wrapper = document.createElement('div');
        wrapper.classList.add('progress-item');

        const img = document.createElement('img');
        img.classList.add('progress-img');

        const nummer = i + 1;

        let bildPfad = `${window.ordnerPath}/Bilder/NavStationen.png`;

        // Wenn die station abgeschlossen war als abgeschlossen markieren
        if (window.stationsComplete.includes(i)) {
            bildPfad = `${window.ordnerPath}/Bilder/NavStationenComp.png`;
        }

        img.src = bildPfad;
        img.style.cursor = "pointer"; // macht Mauszeiger zum "klicken-zeiger"
        img.addEventListener("click", (event) => { // legt ein event fest das klickbarkeit der bilder erlaubt
            const station = window.stations[i];
            window.aktuelleStationId = i + 1;
            loadSection(window.ordnerPath + "/" + station.url); // läd entsprechende section beim klick
        });

        // Nummer von der Station
        const label = document.createElement('span');
        label.classList.add('progress-number');
        label.textContent = nummer;

        // nummer und stationsbild
        wrapper.appendChild(img);
        wrapper.appendChild(label);
        progressContainer.appendChild(wrapper);
    }
}

async function ladeEinleitungstext() {
    // wenn es keinen pfad zum projekt gibt einfach zurückgehen und funktion überspringen
    if (!window.ordnerPath) return;

    const einleitungsContainer = document.getElementById("einleitung");
    const dateiPfad = `${window.ordnerPath}/Einführungstext.html`;

    try {
        const res = await fetch(dateiPfad);
        if (!res.ok) {
            einleitungsContainer.innerHTML = ""; // keine Datei → leerer Bereich
            return;
        }
        const html = await res.text();
        einleitungsContainer.innerHTML = html;
    } catch (err) {
        console.warn("Einführungstext konnte nicht geladen werden:", err);
        einleitungsContainer.innerHTML = "";
    }
}

// hier werden die stationen auf der karte gesetzt
function stationenAufKarteSetzen() {
    // auch hier falls es keine daten gibt zurückgehen
    if (!window.stations || window.stations.length === 0) return;

    const karte = document.getElementById("karte");
    // wenn es keine karte gibt werden keine icons gesetzt, daher hier funktion beenden
    if (!karte) return; // ❗ KEINE KARTE → nichts tun
    const karteImg = karte.querySelector("img");

    // alte Stationsicons entfernen
    karte.querySelectorAll(".karte-station").forEach(e => e.remove());

    const karteOriginalBreite = 1850;
    const karteOriginalHoehe = 1459;

    const scaleX = karteImg.clientWidth / karteOriginalBreite;
    const scaleY = karteImg.clientHeight / karteOriginalHoehe;

    window.stations.forEach((station, index) => {
        const wrapper = document.createElement("div");
        wrapper.classList.add("karte-station");

        // Skalierte Position
        wrapper.style.left = (station.koords.x * scaleX) + "px";
        wrapper.style.top = (station.koords.y * scaleY) + "px";

        const img = document.createElement("img");
        img.src = `${window.ordnerPath}/Bilder/NavStationen.png`;

        if (window.stationsComplete.includes(index)) {
            img.src = `${window.ordnerPath}/Bilder/NavStationenComp.png`;
        }

        const nummer = document.createElement("span");
        nummer.classList.add("nummer");
        nummer.textContent = index + 1;

        wrapper.appendChild(img);
        wrapper.appendChild(nummer);

        wrapper.addEventListener("click", () => {
            loadSection(window.ordnerPath + "/" + station.url);
            window.aktuelleStationId = index + 1;
        });

        karte.appendChild(wrapper);
    });
}

function ladeDefaultAnsicht() {

    window.urlName = "";
    window.ordnerPath = null;
    window.stations = [];
    window.stationsCount = 0;

    // navigation zurücksetzen
    document.getElementById("karte-submenu").innerHTML = "";
    document.getElementById("progress-container").innerHTML = "";

    ladeDefaultEinleitungstext();
}

async function ladeDefaultEinleitungstext() {
    const einleitungsContainer = document.getElementById("einleitung");

    try {
        const res = await fetch("Einführungstext.html");
        if (!res.ok) {
            einleitungsContainer.innerHTML = "";
            return;
        }
        einleitungsContainer.innerHTML = await res.text();
    } catch {
        einleitungsContainer.innerHTML = "";
    }
}