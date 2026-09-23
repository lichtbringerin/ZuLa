/**
 * ========================================================================
 * KERN-SKRIPT: ZENTRALE LEHRPFAD-STEUERUNG (loadProject.js)
 * ========================================================================
 * Dieses Skript verwaltet das Einlesen der XML-Konfigurationsdatei,
 * steuert den globalen Fortschritt (LocalStorage), baut dynamisch
 * die Navigation (Submenü & Statusleiste) auf und berechnet die
 * interaktiven Pins auf der Karte.
 */

// 1. URL-Parameter zum Identifizieren des aktiven Lehrpfads auslesen (z.B. ?id=1)
const urlParams = new URLSearchParams(window.location.search);
const projektId = urlParams.get("id");

// Speichert das geparste XML-Dokument global im Speicher
let globalXML = null;
/**
 * Initialisiert das Laden der XML-Konfigurationsdatei.
 * Muss asynchron (async/await) laufen, um Ladefehler bei abhängigen Funktionen zu vermeiden.
 */
async function initialisierung() {
    const res = await fetch('/LehrpfadeConfig.xml');
    const xmlString = await res.text();

    const parser = new DOMParser();
    globalXML = parser.parseFromString(xmlString, "application/xml");

    // Aktive Projekt-ID aus der URL oder als Fallback aus dem LocalStorage beziehen
    const aktiveProjektId =
        urlParams.get("id") || localStorage.getItem("projektId");

    if (!aktiveProjektId) {
        console.warn("Kein aktiver Lehrpfad");
        return;
    }
    // Hauptfunktion zum Aufbereiten der Lehrpfad-Daten aufrufen
    loadLehrpfad(aktiveProjektId, globalXML);
}

// Startet die XML-Initialisierung, sobald die DOM-Struktur bereitsteht
document.addEventListener("DOMContentLoaded", () => {
    initialisierung();
});

/**
 * Hilfsfunktion zur Bereinigung von Pfad-Strings für absolute Pfadangeben.
 * @param {string} path - Der einzulesende Relativ- oder Absolutpfad.
 * @returns {string} Ein sauber formatierter Root-Pfad mit führendem Slash.
 */
function rootPath(path) {
    return "/" + path.replace(/^\/+/, "");
}

/* ========================================================================
   GLOBALE ZUSTANDSVARIABLEN (Zentral über window-Objekt verfügbar)
   ======================================================================== */

// Name des aktuellen Lehrpfads (wird im Seitentitel verwendet)
window.urlName = "";
// Gesamtanzahl der Stationen im aktiven Pfad
window.stationsCount = 0;
// Array der bereits absolvierten Stationen (0-basierter Index) aus dem Browser-Speicher
window.stationsComplete = JSON.parse(localStorage.getItem('stationsComplete')) || [];
/**
 * Synchronisiert das Array der abgeschlossenen Stationen dauerhaft mit dem LocalStorage.
 */
function updateStationsCompleteStorage() {
    localStorage.setItem('stationsComplete', JSON.stringify(window.stationsComplete));
}

// Array für alle Stations-Objekte (Name, URL, Koordinaten) des aktiven Pfads
window.stations = [];
// ID der aktuell geöffneten Station
window.aktuelleStationId = null;

/* ========================================================================
   DYNAMISCHE BUTTON- & SCROLL-STEUERUNG ("Station abschließen" / "Zurück")
   ======================================================================== */
document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("karte-button");
    if (!btn) return;

    let hasUserScrolled = false;
    // Hilfsfunktion: Dateiname der aktuell aufgerufenen Seite ermitteln
    function getFileName() {
        const p = window.location.pathname;
        const last = p.split("/").pop();
        return (last || "").toLowerCase();
    }
    // Hilfsfunktion: Prüfen, ob sich der Nutzer aktuell auf der Hauptkartenseite befindet
    function isOnMapPage() {
        const path = window.location.pathname.toLowerCase();
        return (
            path === "/" ||
            path.endsWith("/index.html") ||
            path.endsWith("/startseite") ||
            path.endsWith("/startseite.html")
        );
    }
    // Hilfsfunktion: Prüfen, ob Stationsdaten bereits im Speicher geladen sind
    function stationsLoaded() {
        return Array.isArray(window.stations)
            && window.stations.length > 0
            && window.stations.every(s => typeof s.url === "string" && s.url.length > 0);
    }
    // Ermittelt die Stationsnummer anhand des aktuellen Dateinamens
    function getStationNumberIfStationPage() {
        if (!stationsLoaded()) return null;

        const fileName = getFileName();
        const idx = window.stations.findIndex(
            s => (s.url || "").toLowerCase() === fileName
        );
        return idx >= 0 ? (idx + 1) : null;
    }
    // Prüft, ob eine bestimmte Station bereits absolviert wurde
    function isStationCompleted(nummer) {
        return window.stationsComplete.includes(nummer);
    }
    // Prüft, ob der Nutzer ans Ende der Seite gescrollt hat
    function isAtScrollBottom() {
        const sc = document.scrollingElement || document.documentElement;
        const scrollTop = sc.scrollTop;
        const viewportH = window.innerHeight;
        const fullH = sc.scrollHeight;
        return (viewportH + scrollTop) >= (fullH - 50);
    }
    /**
    * Steuert die Sichtbarkeit und den Text des Stationschliessen-Buttons am unteren Bildschirmrand
    */
    function updateButton() {
        // 1. Auf der Übersichtskarte wird der Button nicht benötigt
        if (isOnMapPage()) {
            btn.style.display = "none";
            return;
        }

        // 2. Solange Daten noch laden: Button ausblenden (verhindert UI-Flimmern)
        if (!stationsLoaded()) {
            btn.style.display = "none";
            return;
        }

        const stationNr = getStationNumberIfStationPage();

        // 3. Logik für Stationsseiten
        if (stationNr != null) {
            window.aktuelleStationId = stationNr;

            // Bereits absolvierte Station: Direkt "Zurück zur Karte" anbieten
            if (isStationCompleted(stationNr)) {
                btn.style.display = "block";
                btn.textContent = "Zurück zur Karte";
                return;
            }

            btn.textContent = "Station abschließen";

            // Wenn die Seite kurz ist und kein Scrollen erfordert, Button direkt anzeigen
            const sc = document.scrollingElement || document.documentElement;
            const isScrollable = sc.scrollHeight > (window.innerHeight + 5);

            if (!isScrollable) {
                btn.style.display = "block";
                return;
            }

            // Bei längeren Seiten Button erst nach Scrollen am Seitenende einblenden
            if (!hasUserScrolled) {
                btn.style.display = "none";
            } else {
                btn.style.display = isAtScrollBottom() ? "block" : "none";
            }
            return;
        }

        // 4. Für sonstige Nebenseiten (z.B. Kontakt/Glossar): Standard-Zurück-Button
        window.aktuelleStationId = null;
        btn.style.display = "block";
        btn.textContent = "Zurück zur Karte";
    }

    // Registrierung des Klick-Events auf dem Stationschliessen-Button
    btn.addEventListener("click", () => {
        if (!stationsLoaded()) {
            window.location.href = "/Startseite.html";
            return;
        }

        const stationNr = getStationNumberIfStationPage();

        // Absolvieren einer Station im Speicher festhalten
        if (stationNr != null && !isStationCompleted(stationNr)) {
            window.stationsComplete.push(stationNr);
            updateStationsCompleteStorage();

            statusleisteSetzen();
            stationenAufKarteSetzen();
        }

        window.aktuelleStationId = null;
        window.location.href = "/Startseite.html";
    });

    // Event-Listener zur Dynamisierung des Buttons bei Interaktion und Layout-Änderungen
    window.addEventListener("scroll", () => {
        hasUserScrolled = true;
        updateButton();
    }, { passive: true });

    window.addEventListener("resize", updateButton);

    document.addEventListener("lehrpfadLoaded", () => {
        hasUserScrolled = false;
        updateButton();
    });

    // Initial
    updateButton();

    // Nach dem kompletten Laden (Bilder/Fonts/Layout) nochmal bewerten
    window.addEventListener("load", updateButton);
    // Observer registrieren, um Layout-Verschiebungen (z.B. durch nachladende Bilder) abzufangen
    const ro = new ResizeObserver(() => updateButton());
    ro.observe(document.body);
});


/* ========================================================================
   XML-DATENVERARBEITUNG & SEITEN-BUILDER
   ======================================================================== */

/**
 * Liest die detaillierten Pfadinformationen aus der XML aus und baut die UI auf.
 * @param {string} ID - Die PfadId des gewählten Lehrpfads.
 * @param {Document} xml - Das geparste XML-Dokument.
 */
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

    // Aktive Projekt-ID dauerhaft speichern
    localStorage.setItem("projektId", ID);

    // Globale Daten aus der XML auslesen
    window.urlName = pfad.getElementsByTagName("UrlName")[0].textContent;
    window.ordnerPath = pfad.getElementsByTagName("OrdnerPfad")[0].textContent;
    window.iconName = pfad.getElementsByTagName("IconName")[0].textContent;
    window.kartePath = pfad.getElementsByTagName("Karte")[0].textContent;
    window.stationsCount = parseInt(
        pfad.getElementsByTagName("StationsCount")[0].textContent
    );
    const sprachIcon =
        pfad.getElementsByTagName("SprachIcon")[0]?.textContent || "";

    if (sprachIcon.toLowerCase().includes("deutsch")) {
        window.sprache = "de";
    } else if (sprachIcon.toLowerCase().includes("englisch")) {
        window.sprache = "en";
    } else {
        window.sprache = "de"; // fallback
    }

    // Stationen-Array inkl. Koordinaten und URLs strukturieren
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


    // Dynamische Anpassungen der Benutzeroberfläche vornehmen

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

    if (karteImg && window.location.pathname.toLowerCase().includes("startseite")) {
        const imgPath = rootPath(window.kartePath);
        karteImg.src = imgPath;

        // Nach dem Laden die Stationen setzen (damit Maße stimmen)
        karteImg.addEventListener("load", () => {
            stationenAufKarteSetzen();
        }, { once: true });

        // Falls es aus dem Cache sofort schon fertig ist:
        if (karteImg.complete) {
            stationenAufKarteSetzen();
        }
    } else {
        // Auf anderen Seiten: falls irgendwo eine Karte existiert, wie bisher
        if (karteImg) {
            if (karteImg.complete) stationenAufKarteSetzen();
            else karteImg.addEventListener("load", stationenAufKarteSetzen, { once: true });
        }
    }


    // wenn nichts im einleitungs container steht = lehrpfad geladen, wird hier ein anderer text eingeblendet der die bedienung
    // vom lehrpfad erklärt
    const einleitungContainer = document.getElementById("einleitung");
    if (einleitungContainer && window.location.pathname.toLowerCase().includes("startseite")) {

        if (window.sprache === "de") {
            einleitungContainer.innerHTML =
                `<h2>` + window.urlName + `</h2>` + `<h3>Startseite:</h3>` +
                ` Aktuell befindest Du dich auf der Startseite. Das Programm auf deinem Smartphone zeigt Dir die Lage der verschiedenen Stationen des Audioguides. Diese findest Du als Symbole auf der nachfolgenden Karte und in der Navigation oben. Die Reihenfolge der Stationen kannst Du selbst wählen. Vor Ort kannst Du die Station über die Navigation auswählen oder Du scannst den QR-Code am Schild in der Station. 
            <br>Viel Spaß auf Deinem Rundgang!
            `;
        }

        if (window.sprache === "en") {
            einleitungContainer.innerHTML =
                `<h2>` + window.urlName + `</h2>` + `<h3>Home Page:</h3>` +
                ` You are currently on the starting page. This programme on your smartphone shows you the locations of the various audio guide stops. These are marked as icons on the map below and in the navigation bar at the top. You can choose the order of the stops yourself. Once you’re there, you can select the stop using the navigation bar or scan the QR-code on site. 
            <br>Enjoy your tour!
            `;
        }


    }

    setAktuelleStationFromXML();
    document.dispatchEvent(new CustomEvent("lehrpfadLoaded"));
}
/**
 * Leitet auf eine neue relativen Sektions-URL weiter.
 * @param {string} url - Ziel-URL
 */
function loadSection(url) {
    window.location.href = rootPath(url);
}

/**
 * Baut das Navigations-Submenü im Hamburger-Menü dynamisch auf.
 * @param {Array} items - Array der verfügbaren Stations-Objekte
 */
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

// Sorgt dafür, dass der hintergrund (Stationsseiten) stehen bleibt solange menü offen sit und gescrollt wird
const menuToggle = document.getElementById("menu-toggle");

menuToggle.addEventListener("change", () => {
    document.body.classList.toggle("menu-open", menuToggle.checked);
});

/**
 * Aktualisiert die Sichtbarkeit des Stationschliesen-Buttons anhand der aktuellen Seiten-URL.
 * @param {string} url - Aktuelle Pathname-URL
 */
function updateKarteButton(url) {
    const btn = document.getElementById("karte-button");

    // Auf der Karte → Button ausblenden
    if (url.includes("Startseite.html")) {
        btn.style.display = "none";
        return;
    }
}

/**
 * Klick-Handler für den "Station abschließen"-Button.
 * Speichert den Fortschritt und leitet zur Startseite zurück.
 */
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


/**
 * Rendert die obere Fortschritts-Leiste (Nav-Stationen Icons) in der Navbar.
 */
function statusleisteSetzen() {
    // navbar als container bekommen
    const progressContainer = document.getElementById('progress-container');
    if (!progressContainer) return;
    // inneren wrapper sicherstellen
    let inner = document.getElementById("progress-inner");
    if (!inner) {
        inner = document.createElement("div");
        inner.id = "progress-inner";
        progressContainer.appendChild(inner);
    }

    inner.innerHTML = ""; // reset
    // einzelne stationen erzeugen
    for (let i = 0; i < window.stationsCount; i++) {
        const wrapper = document.createElement('div');
        wrapper.classList.add('progress-item');

        const img = document.createElement('img');
        img.classList.add('progress-img');

        const nummer = i + 1;

        let bildPfad = `Bilder/NavStationen.png`;
        if (window.stationsComplete.includes(nummer)) {
            bildPfad = `Bilder/NavStationenComp.png`;
        }
        img.src = bildPfad;

        img.style.cursor = "pointer";
        img.addEventListener("click", () => {
            const station = window.stations[i];
            window.aktuelleStationId = i + 1;
            loadSection(`/${window.ordnerPath}/${station.url}`);
        });

        const label = document.createElement('span');
        label.classList.add('progress-number');
        label.textContent = nummer;

        wrapper.appendChild(img);
        wrapper.appendChild(label);

        inner.appendChild(wrapper);
    }
}

/**
 * Platziert die interaktiven Stations-Pins proportional skaliert auf dem Kartenbild.
 */
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
/**
 * Liest den aktuellen Dateinamen der URL aus und gleicht ihn mit der XML ab,
 * um 'window.aktuelleStationId' korrekt zu setzen.
 */
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
/**
 * Setzt das Favicon der Webseite dynamisch aus dem in der XML definierten Dateinamen.
 * @param {string} iconName - Name der Favicon-Bilddatei
 */
function setFavicon(iconName) {
    if (!iconName) return;

    const favicon = document.getElementById("favicon");
    if (!favicon) return;

    favicon.href = `/${iconName}`;
}

