const K = 32;

// 🔹 PROFILE (TY DODAJESZ JPG + IMIONA)
const defaultProfiles = [
    { id: 1, name: "Mitsuri Kanroji", img: "girlA.jpg", elo: 1400 },
    { id: 2, name: "Jolyne Cujoh", img: "girlB.jpg", elo: 1400 },
    { id: 3, name: "Shura Kirigakure", img: "girlC.jpg", elo: 1400 },
    { id: 4, name: "Rumi Usagiyama", img: "girlD.jpg", elo: 1400 },
    { id: 5, name: "Reze", img: "girlE.jpg", elo: 1400 },
    { id: 6, name: "Rukia Kuchiki", img: "girlF.jpg", elo: 1400 },
    { id: 7, name: "Tasuka Maraka", img: "girlG.jpg", elo: 1400 },
    { id: 8, name: "Merei Oleander", img: "girlH.jpg", elo: 1400 },
    { id: 9, name: "Tsunade", img: "girlI.jpg", elo: 1400 },
    { id: 10, name: "Erza Scarlet", img: "girlJ.jpg", elo: 1400 },
    { id: 11, name: "Yamato", img: "girlK.jpg", elo: 1400 },
    { id: 12, name: "Yoruichi Shihouin", img: "girlL.jpg", elo: 1400 },
    { id: 13, name: "Casca", img: "girlM.jpg", elo: 1400 },
    { id: 14, name: "Seras Victoria", img: "girlN.jpg", elo: 1400 },
    { id: 15, name: "Esdeath", img: "girlO.jpg", elo: 1400 },
    { id: 16, name: "Rin Yamabuki", img: "girlP.jpg", elo: 1400 }

];

// 🔹 INIT STORAGE
let profiles = JSON.parse(localStorage.getItem("profiles"));
if (!profiles) {
  profiles = defaultProfiles;
  localStorage.setItem("profiles", JSON.stringify(profiles));
}

let currentPair = [];

// 🔹 LOSUJ DWIE RÓŻNE OSOBY
function pickPair() {
  let a, b;
  do {
    a = profiles[Math.floor(Math.random() * profiles.length)];
    b = profiles[Math.floor(Math.random() * profiles.length)];
  } while (a.id === b.id);

  currentPair = [a, b];

  document.getElementById("imgA").src = a.img;
  document.getElementById("nameA").textContent = a.name;

  document.getElementById("imgB").src = b.img;
  document.getElementById("nameB").textContent = b.name;
}

// 🔹 ELO CALC
function expected(rA, rB) {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

function updateElo(winner, loser) {
  const eW = expected(winner.elo, loser.elo);
  const eL = expected(loser.elo, winner.elo);

  winner.elo += Math.round(K * (1 - eW));
  loser.elo += Math.round(K * (0 - eL));
}

// 🔹 GŁOS
function vote(index) {
  const winner = currentPair[index];
  const loser = currentPair[index === 0 ? 1 : 0];

  updateElo(winner, loser);
  localStorage.setItem("profiles", JSON.stringify(profiles));
  pickPair();
}

// 🔹 START
pickPair();
