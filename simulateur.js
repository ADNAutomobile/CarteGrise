
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
  const seuilMars2022 = new Date("2022-03-01").getTime();

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
  const carte = carteGrise[dep] * cv + 11 + 2.76;
  const total = malusFinal + poidsTaxe + carte;

  document.getElementById("info-message").style.display = "none";
  document.getElementById("resultat").innerHTML = `
    <div class="card card-body">
      <p><strong>Année barème :</strong> ${annee}</p>
      <p><strong>Ancienneté :</strong> ${mois} mois → ${decote}% abattement CO₂</p>
      <p><strong>Malus CO₂ :</strong> ${malusFinal.toFixed(2)} €</p>
      <p><strong>Taxe au poids :</strong> ${poidsTaxe.toFixed(2)} €</p>
      <p><strong>Carte grise :</strong> ${carte.toFixed(2)} €</p>
      <hr />
      <p><strong>Total :</strong> ${total.toFixed(2)} €</p>
    </div>
  `;
}

function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const content = document.getElementById("resultat");
  if (!content.innerText.trim()) {
    alert("Veuillez d'abord calculer.");
    return;
  }
  let y = 10;
  doc.text("Résultat du simulateur", 10, y);
  y += 10;
  content.innerText.split("\n").forEach(line => {
    doc.text(line, 10, y);
    y += 7;
  });
  doc.save("simulateur_adn.pdf");
}
