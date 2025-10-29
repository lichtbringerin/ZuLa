// ein skript welches die informationen zu allen gespeicherten lehrpfäden enthält; 
// diese werden über die ID in der URL des QR codes bestimmt
// die entsprechenden variablen werden hier gesetzt.

// im format von: https://meine-seite.de/projekt?id=123
const urlParams = new URLSearchParams(window.location.search);
const projektId = urlParams.get("id");

// festlegen von globalen variablen

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


// switch case für die einzelnen lehrpfade und deren inforamtionen
switch (projektId) {
    // case 1 ist der Einflüsse des Menschen auf Ökosysteme Lehrpfad
    case "1":
        window.urlName = "Einfluss des Menschen auf Ökosysteme";
        window.stationsCount = 6;
        window.stations = [
            { url: "EinflussMensch/Wald.html", name: "Wald", koords: "" },
            { url: "EinflussMensch/Wiese.html", name: "Wiese", koords: "" },
            { url: "EinflussMensch/Tropenhaus.html", name: "Tropenhaus", koords: "" },
            { url: "EinflussMensch/Bauerngarten.html", name: "Bauerngarten", koords: "" },
            { url: "EinflussMensch/Nutzpflanzenterasse.html", name: "Nutzpflanzenterasse", koords: "" },
            { url: "EinflussMensch/Abschluss.html", name: "Abschluss", koords: "" }
        ]

        break;
    default:
        // der default sollte einen fehler werfen? 
        break;
}

// setzt den titel der seite
document.title = window.urlName;

// baut das submenü unter der karte auf
submenu(window.stations);

// legt hier die anzahl der stationen in der fortschrittsanzeige oben fest
statusleisteSetzen();


function submenu(items) {
    const submenu = document.getElementById("karte-submenu");
    submenu.innerHTML = ""; // vorher leeren, nötig bei mehreren Pfaden in der Zukunft?

    // für jedes festgelegte item in der liste der stationen werden name und URL aufruf hinterlegt
    items.forEach(item => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = "#";
        a.textContent = item.name;
        // hier ist der URL aufruf eingebaut
        a.onclick = function () {
            loadSection(item.url);
            return false;
        };
        // hinzufügen an das menü unter der karte
        li.appendChild(a);
        submenu.appendChild(li);
    });
}

// setzt die fortschrittsanzeige
function statusleisteSetzen() {
    // navbar als container bekommen
    const progressContainer = document.getElementById('progress-container');

    // Punkte erzeugen
    for (let i = 0; i < window.stationsCount; i++) {
        const point = document.createElement('div');
        point.classList.add('progress-point');

        // Wenn die station abgeschlossen war als abgeschlossen markieren
        if (window.stationsComplete.includes(i)) {
            point.classList.add('completed');
        }

        progressContainer.appendChild(point);
    }
}
