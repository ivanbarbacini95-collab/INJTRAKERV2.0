// ---------- Variabili globali ----------
let address = localStorage.getItem("inj_address") || "";

let displayedPrice = 0, targetPrice = 0, price24hOpen = 0;
let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;
let availableInj = 0, displayedAvailable = 0;
let apr = 0;

let chart, chartData = [];
let rewardsPerSecond = 0;

// ---------- Utils ----------
const fetchJSON = url => fetch(url).then(r => r.json());
const formatUSD = v => "≈ $" + v.toFixed(2);

// ---------- Aggiorna numeri con animazione colore ----------
function updateNumber(el, oldV, newV, fixed) {
  el.classList.remove("digit-up", "digit-down");
  el.innerText = newV.toFixed(fixed);
  if (newV > oldV) el.classList.add("digit-up");
  if (newV < oldV) el.classList.add("digit-down");
}

// ---------- Address Input ----------
const addressInput = document.getElementById("addressInput");
addressInput.value = address;
addressInput.onchange = e => {
  address = e.target.value.trim();
  localStorage.setItem("inj_address", address);
  loadData();
};

// ---------- Load Injective Data ----------
async function loadData() {
  if (!address) return;

  try {
    // AVAILABLE BALANCE
    const balance = await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
    availableInj = (balance.balances?.find(b => b.denom === "inj")?.amount || 0) / 1e18;

    // STAKE
    const stake = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
    stakeInj = stake.delegation_responses?.reduce((s,d)=>s+Number(d.balance.amount),0)/1e18 || 0;

    // REWARDS
    const rewards = await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj = rewards.rewards?.reduce((s,r)=>s + Number(r.reward[0]?.amount||0),0)/1e18 || 0;

    // APR CORRETTO
    const inflationData = await fetchJSON(`https://lcd.injective.network/cosmos/mint/v1beta1/inflation`);
    const inflationRate = Number(inflationData.inflation) || 0;
    apr = inflationRate * 100; // percentuale annua

    // CALCOLO REWARDS PER SECONDO
    rewardsPerSecond = (stakeInj * apr / 100 / 365) / 86400; // INJ/sec

  } catch (e) {
    console.error(e);
  }
}

// Carica dati ogni 60 secondi
loadData();
setInterval(loadData, 60000);

// ---------- Price History ----------
async function fetchHistory() {
  try {
    const r = await fetch("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=1h&limit=24");
    const d = await r.json();
    chartData = d.map(c => +c[4]);
    price24hOpen = +d[0][1];
    targetPrice = chartData.at(-1);
    drawChart();
  } catch (e) {
    console.error("Errore fetch price history:", e);
  }
}
fetchHistory();

// ---------- Chart ----------
function drawChart() {
  const ctx = document.getElementById("priceChart");
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: chartData.map((_,i)=>i),
      datasets: [{
        data: chartData,
        borderColor: "#22c55e",
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      plugins:{legend:{display:false}},
      scales:{x:{display:false}}
    }
  });
}

// ---------- Binance WS ----------
function startWS() {
  const ws = new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
  ws.onmessage = e => targetPrice = +JSON.parse(e.data).p;
  ws.onclose = () => setTimeout(startWS, 3000);
}
startWS();

// ---------- Elementi DOM ----------
const priceEl = document.getElementById("price");
const availableEl = document.getElementById("available");
const availableUsd = document.getElementById("availableUsd");
const stakeEl = document.getElementById("stake");
const stakeUsd = document.getElementById("stakeUsd");
const rewardsEl = document.getElementById("rewards");
const rewardsUsd = document.getElementById("rewardsUsd");
const dailyRewardsEl = document.getElementById("dailyRewards");
const monthlyRewardsEl = document.getElementById("monthlyRewards");
const aprEl = document.getElementById("apr");
const updated = document.getElementById("updated");

// Variabile per il tempo trascorso
let lastTime = Date.now() / 1000;

// ---------- Animazione numeri con effetto caricamento ----------
function animate() {
  const now = Date.now() / 1000;
  const delta = now - lastTime;
  lastTime = now;

  // ---------- PRICE ----------
  const prevP = displayedPrice;
  displayedPrice += (targetPrice - displayedPrice) * 0.1;
  updateNumber(priceEl, prevP, displayedPrice, 4);

  // ---------- AVAILABLE ----------
  const prevA = displayedAvailable;
  displayedAvailable += (availableInj - displayedAvailable) * 0.1;
  updateNumber(availableEl, prevA, displayedAvailable, 6);
  availableUsd.innerText = formatUSD(displayedAvailable * displayedPrice);

  // ---------- STAKE ----------
  const prevS = displayedStake;
  displayedStake += (stakeInj - displayedStake) * 0.1;
  updateNumber(stakeEl, prevS, displayedStake, 4);
  stakeUsd.innerText = formatUSD(displayedStake * displayedPrice);

  // ---------- REWARDS (scorre in tempo reale) ----------
  rewardsInj += rewardsPerSecond * delta; // incremento continuo
  const prevR = displayedRewards;
  displayedRewards += (rewardsInj - displayedRewards) * 0.1;
  updateNumber(rewardsEl, prevR, displayedRewards, 6);
  rewardsUsd.innerText = formatUSD(displayedRewards * displayedPrice);

  // ---------- APR ----------
  aprEl.classList.remove("digit-up","digit-down");
  const prevAPR = Number(aprEl.innerText) || 0;
  aprEl.innerText = apr.toFixed(2) + "%";
  if (apr > prevAPR) aprEl.classList.add("digit-up");
  if (apr < prevAPR) aprEl.classList.add("digit-down");

  // ---------- DAILY / MONTHLY ----------
  dailyRewardsEl.innerText = (displayedStake * apr / 100 / 365).toFixed(4) + " INJ / giorno";
  monthlyRewardsEl.innerText = (displayedStake * apr / 100 / 12).toFixed(4) + " INJ / mese";

  // ---------- LAST UPDATE ----------
  updated.innerText = "Last Update: " + new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}

animate();
