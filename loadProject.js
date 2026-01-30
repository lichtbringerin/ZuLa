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
    const res = await fetch('/LehrpfadeConfig.xml');
    const xmlString = await res.text();

    const parser = new DOMParser();
    globalXML = parser.parseFromString(xmlString, "application/xml");

    // 🔹 NUR wenn eine ID existiert
    const aktiveProjektId =
        urlParams.get("id") || localStorage.getItem("projektId");

    if (!aktiveProjektId) {
        console.warn("Kein aktiver Lehrpfad");
        return;
    }
    loadLehrpfad(aktiveProjektId, globalXML);
}

document.addEventListener("DOMContentLoaded", () => {
    initialisierung();
});

//hilfefunktion die saubere Rootpaths erlaubt
function rootPath(path) {
    return "/" + path.replace(/^\/+/, "");
}

// der name der später in der URL angezeigt wird
window.urlName = "";
// setzt die anzahl der stationen fest (oben in der )
window.stationsCount = 0;
// anzahl der abgeschlossenen stationen
window.stationsComplete = JSON.parse(localStorage.getItem('stationsComplete')) || [];
// aktualisiert die stationsComplete variable. Nötig, sonst gehen die infos beim seitenwechsel verloren
function updateStationsCompleteStorage() {
    localStorage.setItem('stationsComplete', JSON.stringify(window.stationsComplete));
}

// legt die dateien, namen und koordinaten auf der karte der stationen fest
window.stations = [
    {},
    {}
];
window.aktuelleStationId = null;

// hier wird die "station abschliessen" button logic geprüft / gesetzt
document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("karte-button");
    if (!btn) return;

    let hasUserScrolled = false;

    function getFileName() {
        const p = window.location.pathname;
        const last = p.split("/").pop();
        return (last || "").toLowerCase();
    }

    function isOnMapPage() {
        const path = window.location.pathname.toLowerCase();
        return (
            path === "/" ||
            path.endsWith("/index.html") ||
            path.endsWith("/startseite") ||
            path.endsWith("/startseite.html")
        );
    }

    function stationsLoaded() {
        return Array.isArray(window.stations) && window.stations.length > 0;
    }

    function getStationNumberIfStationPage() {
        if (!stationsLoaded()) return null;

        const fileName = getFileName();
        const idx = window.stations.findIndex(
            s => (s.url || "").toLowerCase() === fileName
        );
        return idx >= 0 ? (idx + 1) : null;
    }

    function isStationCompleted(nummer) {
        return window.stationsComplete.includes(nummer);
    }

    function isAtScrollBottom() {
        const sc = document.scrollingElement || document.documentElement;
        const scrollTop = sc.scrollTop;
        const viewportH = window.innerHeight;
        const fullH = sc.scrollHeight;
        return (viewportH + scrollTop) >= (fullH - 50);
    }

    function updateButton() {
        // 1) Karte: nie Button
        if (isOnMapPage()) {
            btn.style.display = "none";
            return;
        }

        // 2) Solange Stationsdaten nicht da sind: nichts anzeigen (kein Flicker)
        if (!stationsLoaded()) {
            btn.style.display = "none";
            return;
        }

        const stationNr = getStationNumberIfStationPage();

        // 3) Stationsseite
        if (stationNr != null) {
            window.aktuelleStationId = stationNr;

            if (isStationCompleted(stationNr)) {
                btn.style.display = "block";
                btn.textContent = "Zurück zur Karte";
                return;
            }

            // nicht abgeschlossen -> nur nach Scroll + unten
            btn.textContent = "Station abschließen";
            if (!hasUserScrolled) {
                btn.style.display = "none";
            } else {
                btn.style.display = isAtScrollBottom() ? "block" : "none";
            }
            return;
        }

        // 4) Alle anderen Seiten: immer zurück
        window.aktuelleStationId = null;
        btn.style.display = "block";
        btn.textContent = "Zurück zur Karte";
    }

    // Klick-Handler: EINMAL registrieren (nicht in updateButton!)
    btn.addEventListener("click", () => {
        if (!stationsLoaded()) {
            window.location.href = "/Startseite.html";
            return;
        }

        const stationNr = getStationNumberIfStationPage();

        // Nur Stationsseiten abschließen
        if (stationNr != null && !isStationCompleted(stationNr)) {
            window.stationsComplete.push(stationNr);
            updateStationsCompleteStorage();

            statusleisteSetzen();
            stationenAufKarteSetzen();
        }

        window.aktuelleStationId = null;
        window.location.href = "/Startseite.html";
    });

    // Events: EINMAL registrieren
    window.addEventListener("scroll", () => {
        hasUserScrolled = true;
        updateButton();
    }, { passive: true });

    window.addEventListener("resize", updateButton);

    document.addEventListener("lehrpfadLoaded", () => {
        hasUserScrolled = false; // Reset pro Stations-/Pfad-Ladezyklus
        updateButton();
    });

    // Initial
    updateButton();
});




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
        p.getElementsByTagName("PfadId")[0].textContent === ID
    );

    //fehlerbehandlung falls id im qr code falsch
    if (!pfad) {
        console.log("Fehler: Kein Lehrpfad mit ID " + ID);
        return;
    }

    // speichert die project ID local
    localStorage.setItem("projektId", ID);

    // setzt werte
    window.urlName = pfad.getElementsByTagName("UrlName")[0].textContent;
    window.ordnerPath = pfad.getElementsByTagName("OrdnerPfad")[0].textContent;
    window.iconName = pfad.getElementsByTagName("IconName")[0].textContent;
    window.stationsCount = parseInt(
        pfad.getElementsByTagName("StationsCount")[0].textContent
    );

    // stationen auslesen
    const stationXML = [...pfad.getElementsByTagName("Station")];

    // mapping auf die window.stations struktur
    window.stations = stationXML.map(s => ({
        name: s.getElementsByTagName("Name")[0].textContent,
        url: s.getElementsByTagName("Url")[0].textContent,
        nummer: s.getElementsByTagName("Nummer")[0].textContent,
        koords: {
            x: parseInt(s.getElementsByTagName("X")[0].textContent),
            y: parseInt(s.getElementsByTagName("Y")[0].textContent)
        }
    }));


    // HIER ALLES LADEN WAS NACH DEM LADEN DER XML GEMACHT WIRD:

    // setzt den titel der seite
    document.title = window.urlName;
    // setzt webseitenicon
    setFavicon(window.iconName);


    // baut das submenü unter der karte auf
    submenu(window.stations);

    // legt hier die anzahl der stationen in der fortschrittsanzeige oben fest
    statusleisteSetzen();

    // setzt die navigationselemente für die Stationen auf die Karte
    // Karte initialisieren, sobald das Kartenbild geladen ist
    const karteImg = document.querySelector("#karte img");

    if (karteImg) {
        if (karteImg.complete) {
            // Bild ist bereits geladen (Cache)
            stationenAufKarteSetzen();
        } else {
            // Bild lädt noch
            karteImg.addEventListener("load", () => {
                stationenAufKarteSetzen();
            }, { once: true });
        }
    }

    // wenn nichts im einleitungs container steht = lehrpfad geladen, wird hier ein anderer text eingeblendet der die bedienung
    // vom lehrpfad erklärt
    const einleitungContainer = document.getElementById("einleitung");
    if (pfad) {

        einleitungContainer.innerHTML =
            `<h2>` + window.urlName + `</h2>` +
            ` Aktuell befindest du dich auf der Startseite. Das Programm auf deinem Smartphone leitet dich durch den Lehrpfad. Begib
            dich zur ersten Station. Diese findest du als Symbole auf der nachfolgenden Karte, und in der Navigation oben. Vor Ort kannst du die Station über die Navigation auswählen oder du
            scannst den QR-Code vor Ort.
            <br>Viel Spaß.`
            ;
    }

    setAktuelleStationFromXML();
    document.dispatchEvent(new CustomEvent("lehrpfadLoaded"));
}

function loadSection(url) {
    window.location.href = rootPath(url);
}

// setzt die einträge der stationen im submenü
function submenu(items) {
    const submenu = document.getElementById("karte-submenu");
    submenu.innerHTML = ""; // vorher leeren, nötig bei mehreren Pfaden in der Zukunft?

    // für jedes festgelegte item in der liste der stationen werden name und URL aufruf hinterlegt
    items.forEach((item, index) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = rootPath(`${window.ordnerPath}/${item.url}`);
        a.textContent = item.name;
        // hinzufügen an das menü unter der karte
        li.appendChild(a);
        submenu.appendChild(li);
    });
    if (localStorage.getItem("projektId") == 1) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = rootPath(`${window.ordnerPath}/Glossar.html`);
        a.textContent = "Glossar";
        li.appendChild(a);
        submenu.appendChild(li);

        const li2 = document.createElement("li");
        const a2 = document.createElement("a");
        a2.href = rootPath(`${window.ordnerPath}/InfoLK.html`);
        a2.textContent = "Infos für Lehrkräfte";
        li2.appendChild(a2);
        submenu.appendChild(li2);
    }
}

// Funktion für den zurück auf die karte button bzw. den station abschliessen button
// Wird aufgerufen, nachdem eine Section geladen wird
function updateKarteButton(url) {
    const btn = document.getElementById("karte-button");

    // Auf der Karte → Button ausblenden
    if (url.includes("Startseite.html")) {
        btn.style.display = "none";
        return;
    }
}

// Wird beim Klick auf den Button ausgeführt
function navigationsButtonClick() {
    if (window.aktuelleStationId) {
        const nummer = window.aktuelleStationId;

        // Station nur hinzufügen, wenn sie noch nicht abgeschlossen ist
        if (!window.stationsComplete.includes(nummer)) {
            window.stationsComplete.push(nummer);
            updateStationsCompleteStorage();
        }
    }

    // Statusleiste & Karte sofort aktualisieren
    statusleisteSetzen();
    stationenAufKarteSetzen();

    // Aktuelle Station zurücksetzen und zur Karte
    window.aktuelleStationId = null;
    window.location.href = "/Startseite.html";
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

        let bildPfad = `/NavStationen.png`;
        if (window.stationsComplete.includes(nummer)) {
            bildPfad = `/NavStationenComp.png`;
        }
        img.src = bildPfad;

        img.style.cursor = "pointer"; // macht Mauszeiger zum "klicken-zeiger"
        img.addEventListener("click", (event) => { // legt ein event fest das klickbarkeit der bilder erlaubt
            const station = window.stations[i];
            window.aktuelleStationId = i + 1;
            loadSection(`/${window.ordnerPath}/${station.url}`); // läd entsprechende section beim klick
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

// hier werden die stationen auf der karte gesetzt
function stationenAufKarteSetzen() {
    // auch hier falls es keine daten gibt zurückgehen
    if (!window.stations || window.stations.length === 0) return;

    const karte = document.getElementById("karte");
    // wenn es keine karte gibt werden keine icons gesetzt, daher hier funktion beenden
    if (!karte) return; // ❗ KEINE KARTE → nichts tun
    const karteImg = karte.querySelector(".karte-bild");
    if (!karteImg || karteImg.clientWidth === 0) return;

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
        img.src = `/NavStationen.png`;;
        if (window.stationsComplete.includes(index + 1)) {
            img.src = `/NavStationenComp.png`;
        }

        const nummer = document.createElement("span");
        nummer.classList.add("nummer");
        nummer.textContent = index + 1;

        wrapper.appendChild(img);
        wrapper.appendChild(nummer);

        wrapper.addEventListener("click", () => {
            loadSection(`${window.ordnerPath}/${station.url}`);
            window.aktuelleStationId = index + 1;
        });

        karte.appendChild(wrapper);
    });
}

function setAktuelleStationFromXML() {
    if (!globalXML) {
        console.warn("XML noch nicht geladen");
        return;
    }

    const fileName = window.location.pathname.split("/").pop();

    const stations = globalXML.getElementsByTagName("Station");

    for (const station of stations) {
        const url = station.getElementsByTagName("Url")[0]?.textContent;

        if (url === fileName) {
            const nummer = parseInt(
                station.getElementsByTagName("Nummer")[0].textContent,
                10
            );

            window.aktuelleStationId = nummer;
            localStorage.setItem("aktuelleStationId", nummer);

            console.log("Station erkannt:", nummer);
            return;
        }
    }

    console.warn("Keine Station im XML gefunden für:", fileName);
}

function setFavicon(iconName) {
    if (!iconName) return;

    const favicon = document.getElementById("favicon");
    if (!favicon) return;

    favicon.href = `/${iconName}`;
}

