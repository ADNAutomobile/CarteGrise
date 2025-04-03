
let baremeCO2 = {};
let baremePoids = {};
let carteGrise = {};

window.onload = async function () {
  baremeCO2 = await fetch('malus_co2.json').then(r => r.json());
  baremePoids = await fetch('malus_poids.json').then(r => r.json());
  carteGrise = await fetch('carte_grise.json').then(r => r.json());
};

function toggleAutonomie() {
  const type = document.getElementById("typeVehicule").value;
  document.getElementById("autonomieField").style.display = (type === "hybride") ? "block" : "none";
}

function getMalusCO2(annee, co2) {
  const bar = baremeCO2[annee];
  if (!bar || bar.length === 0) return 0;
  const sorted = [...bar].sort((a, b) => a.g - b.g);
  if (co2 < sorted[0].g) return 0;
  if (co2 > sorted[sorted.length - 1].g) return sorted[sorted.length - 1].montant;
  let result = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].g <= co2) {
      result = sorted[i].montant;
    } else {
      break;
    }
  }
  return result;
}

function getMalusPoids(dateMec, poids, type, autonomie) {
  const year = dateMec.getFullYear();
  const mecTimestamp = dateMec.getTime();
  const debutPoids = new Date("2022-01-01").getTime();
  const seuilMars2022 = new Date("2022-01-01").getTime();

  if (mecTimestamp < debutPoids) return 0;
  if (year === 2022 && mecTimestamp < seuilMars2022) return 0;
  if (type === "electrique") return 0;
  if (type === "hybride" && autonomie > 50) return 0;

  const bar = baremePoids[year];
  if (!bar) return 0;

  // Réduction de 100 kg pour hybrides < 50 km
  if (type === "hybride" && autonomie <= 50) {
    poids -= 100;
    poids = Math.max(poids, 0);
  }

  let malus = 0;
  for (let i = 0; i < bar.length; i++) {
    if (poids >= bar[i].seuil) {
      malus = (poids - bar[i].seuil) * bar[i].tarif;
    }
  }

  // Décote
  const mois = calculerMoisDepuis(dateMec);
  let decote = 0;

  if (type === "hybride" && autonomie <= 50) {
    decote = getDecote(mois); // même barème que CO2
  } else {
    decote = Math.min(mois, 100); // 1%/mois
  }

  malus = malus * (1 - decote / 100);
  return Math.round(malus);
}

function calculerMoisDepuis(dateMec) {
  const now = new Date();
  let mois = (now.getFullYear() - dateMec.getFullYear()) * 12 + now.getMonth() - dateMec.getMonth();
  if (now.getDate() < dateMec.getDate()) mois--;
  return Math.max(0, mois);
}

function getDecote(mois) {
  if (mois < 1) return 0;
  if (mois <= 3) return 3;
  if (mois <= 6) return 6;
  if (mois <= 9) return 9;
  if (mois <= 12) return 12;
  if (mois <= 18) return 16;
  if (mois <= 24) return 20;
  if (mois <= 36) return 28;
  if (mois <= 48) return 33;
  if (mois <= 60) return 38;
  if (mois <= 72) return 43;
  if (mois <= 84) return 48;
  if (mois <= 96) return 53;
  if (mois <= 108) return 58;
  if (mois <= 120) return 64;
  if (mois <= 132) return 70;
  if (mois <= 144) return 76;
  if (mois <= 156) return 82;
  if (mois <= 168) return 88;
  if (mois <= 180) return 94;
  return 100;
}

function calculer() {
  const dateMec = new Date(document.getElementById("dateMec").value);
  const co2 = parseInt(document.getElementById("co2").value);
  const poids = parseInt(document.getElementById("poids").value);
  const dep = document.getElementById("departement").value;
  const cv = parseInt(document.getElementById("puissanceFiscale").value);
  const type = document.getElementById("typeVehicule").value;
  const autonomie = parseInt(document.getElementById("autonomieElec").value) || 0;

  const annee = dateMec.getFullYear();
  const mois = calculerMoisDepuis(dateMec);
  const decote = getDecote(mois);
  const malusBrut = (type !== "electrique") ? getMalusCO2(annee, co2) : 0;
  const malusFinal = malusBrut * (1 - decote / 100);
  const poidsTaxe = getMalusPoids(dateMec, poids, type, autonomie);
  const carte = carteGrise[dep] * cv;
  const taxe = 11;
  const acheminement = 2.76;
  const total = malusFinal + poidsTaxe + carte + taxe + acheminement;

  document.getElementById("info-message").style.display = "none";
  document.getElementById("resultat").innerHTML = `
    <div class="card card-body">
      <p><strong>Année barème :</strong> ${annee}</p>
      <p><strong>Vétusté :</strong> ${mois} mois -> ${decote}% abattement Co2</p>
      <p><strong>Malus :</strong> ${malusFinal.toFixed(2)} €</p>
      <p><strong>Taxe au poids :</strong> ${poidsTaxe.toFixed(2)} €</p>
      <p><strong>Taxe :</strong> ${taxe.toFixed(2)} €</p>
      <p><strong>Acheminement :</strong> ${acheminement.toFixed(2)} €</p>
      <p><strong>Carte grise :</strong> ${carte.toFixed(2)} €</p>
      <hr />
      <p><strong>Total :</strong> ${total.toFixed(2)} €</p>
    </div>
  `;
}

function ancienexportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const content = document.getElementById("resultat");
  if (!content || !content.innerText.trim()) {
    alert("Veuillez d'abord effectuer un calcul.");
    return;
  }

  const logo = new Image();
  logo.src = "assets/logo.png";

  logo.onload = () => {
    doc.addImage(logo, "PNG", 10, 10, 40, 15);
    doc.setFont("helvetica", "normal");

    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text("Simulation Malus, Taxe Poids & Carte Grise", 60, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Exporté le : " + new Date().toLocaleDateString(), 200, 28, { align: "right" });

    doc.setDrawColor(150);
    doc.line(10, 30, 200, 30);

    // Récupère les lignes de texte et les nettoie
    let y = 40;
    const lignes = Array.from(content.querySelectorAll("p")).map(p =>
      p.innerText
        .replace(/\u202F/g, " ")   // espace insécable fine ( )
        .replace(/\u00A0/g, " ")   // espace insécable classique
        .replace(/→/g, "->")       // flèche typographique
        .trim()
    );

    doc.setFontSize(12);
    doc.setTextColor(0);

    lignes.forEach(line => {
      doc.text(line, 10, y);
      y += 8;
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
    });

    doc.save("simulation_adn.pdf");
  };

  if (logo.complete) {
    logo.onload();
  }
}
function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const content = document.getElementById("resultat");
  if (!content || !content.innerText.trim()) {
    alert("Veuillez d'abord effectuer un calcul.");
    return;
  }

  const logo = new Image();
  logo.src = "assets/logo.png";

  logo.onload = () => {
    doc.addImage(logo, "PNG", 10, 10, 40, 15);
    doc.setFont("helvetica", "normal");

    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text("Simulation Malus, Taxe Poids & Carte Grise", 60, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text("Exporté le : " + new Date().toLocaleDateString(), 200, 28, { align: "right" });

    doc.setDrawColor(150);
    doc.line(10, 30, 200, 30);

    // 📝 DONNÉES DE SAISIE
    const dateMec = document.getElementById("dateMec").value;
    const co2 = document.getElementById("co2").value;
    const poids = document.getElementById("poids").value;
    const departement = document.getElementById("departement").value;
    const puissance = document.getElementById("puissanceFiscale").value;
    const type = document.getElementById("typeVehicule").value;
    const autonomie = document.getElementById("autonomieElec").value || "-";

    const infos = [
      `Date de 1ère mise en circulation : ${dateMec}`,
      `Émissions de Co2 : ${co2} g/km`,
      `Poids du véhicule : ${poids} kg`,
      `Département : ${departement}`,
      `Puissance fiscale : ${puissance} CV`,
      `Type de véhicule : ${type}`,
      (type === "hybride" ? `Autonomie électrique : ${autonomie} km` : "")
    ];

    // Affichage des infos
    let y = 40;
    doc.setFontSize(12);
    doc.setTextColor(30);

    infos.forEach(line => {
      if (line) {
        doc.text(line, 10, y);
        y += 8;
      }
    });

    // Espace avant les résultats
    y += 4;
    doc.setTextColor(0);
    doc.setDrawColor(180);
    doc.line(10, y, 200, y);
    y += 10;

    // 🧾 RÉSULTATS CALCULÉS
    const resultats = Array.from(content.querySelectorAll("p")).map(p =>
      p.innerText
        .replace(/\u202F/g, " ")
        .replace(/\u00A0/g, " ")
        .replace(/→/g, "->")
        .trim()
    );

    resultats.forEach(line => {
      doc.text(line, 10, y);
      y += 8;
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
    });

    doc.save("simulation_adn.pdf");
  };

  if (logo.complete) {
    logo.onload();
  }
}

