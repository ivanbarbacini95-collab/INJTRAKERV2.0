// ---------------- Selettori ----------------
const price = document.getElementById("price");
const available = document.getElementById("available");
const stake = document.getElementById("stake");
const rewards = document.getElementById("rewards");
const aprEl = document.getElementById("apr");

const availableUsd = document.getElementById("availableUsd");
const stakeUsd = document.getElementById("stakeUsd");
const rewardsUsd = document.getElementById("rewardsUsd");
const dailyRewards = document.getElementById("dailyRewards");
const monthlyRewards = document.getElementById("monthlyRewards");
const updated = document.getElementById("updated");
const price24h = document.getElementById("price24h");

const addressInput = document.getElementById("addressInput");

// ---------------- Variabili ----------------
let address = localStorage.getItem("inj_address") || "";

let displayedPrice = 0;
let targetPrice = 0;
let price24hOpen = 0;

let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;
let availableInj = 0, displayedAvailable = 0;
let apr = 0;

let chart, chartData = [];

// ---------------- Utils ----------------
const fetchJSON = url => fetch(url).then(r => r.json());
const formatUSD = v => "≈ $" + v.toFixed(2);

function updateNumber(el, oldV, newV, fixed) {
  el.classList.remove("digit-up", "digit-down");
  el.innerText = newV.toFixed(fixed);
  if (newV > oldV) el.classList.add("digit-up");
  if (newV < oldV) el.classList.add("digit-down");
}

// ---------------- Gestione Indirizzo ----------------
addressInput.value = address;
addressInput.onchange = e => {
  address = e.target.value.trim();
  localStorage.setItem("inj_address", address);
  loadData();
};

// ---------------- Funzione principale ----------------
async function loadData() {
  if (!address) return;

  try {
    // Balance
    const balance = await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
    availableInj = (balance.balances?.find(b => b.denom === "inj")?.amount || 0) / 1e18;

    // Stake
    const stakeData = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
    stakeInj = stakeData.delegation_responses?.reduce((s,d)=>s+Number(d.balance.amount),0)/1e18 || 0;

    // Rewards
    const rewardsData = await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj = rewardsData.rewards?.reduce((s,r)=>s + Number(r.reward[0]?.amount||0),0)/1e18 || 0;

    // APR
    const inflation = await fetchJSON(`https://lcd.injective.network/cosmos/mint/v1beta1/inflation`);
    const pool = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/pool`);
    apr = (inflation.inflation * Number(pool.pool.bonded_tokens) / Number(pool.pool.bonded_tokens)) * 100;

    console.log("Available INJ:", availableInj);
    console.log("Stake INJ:", stakeInj);
    console.log("Rewards INJ:", rewardsInj);
    console.log("APR:", apr);

  } catch (e) {
    console.error("Errore caricamento dati:", e);
  }
}

// ---------------- Fetch Storico Prezzo ----------------
async function fetchHistory() {
  const r = await fetch("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=1h&limit=24");
  const d = await r.json();
  chartData = d.map(c => +c[4]);
  price24hOpen = +d[0][1];
  targetPrice = chartData.at(-1);
  drawChart();
  updatePriceChange();
}
fetchHistory();

// ---------------- Chart ----------------
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

// ---------------- Aggiorna variazione 24h ----------------
function updatePriceChange() {
  const diff = displayedPrice - price24hOpen;
  const pct = (diff / price24hOpen) * 100;
  price24h.innerText = `${pct.toFixed(2)}% | ≈ $${diff.toFixed(4)}`;
  price24h.classList.remove("up","down");
  if(pct>0) price24h.classList.add("up");
  if(pct<0) price24h.classList.add("down");
}

// ---------------- Binance WS ----------------
function startWS() {
  const ws = new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
  ws.onmessage = e => targetPrice = +JSON.parse(e.data).p;
  ws.onclose = () => setTimeout(startWS, 3000);
}
startWS();

// ---------------- Animazione ----------------
function animate() {
  // Prezzo
  const prevP = displayedPrice;
  displayedPrice += (targetPrice - displayedPrice) * 0.1;
  updateNumber(price, prevP, displayedPrice, 4);

  // Available
  const prevA = displayedAvailable;
  displayedAvailable += (availableInj - displayedAvailable) * 0.1;
  updateNumber(available, prevA, displayedAvailable, 6);
  availableUsd.innerText = formatUSD(displayedAvailable * displayedPrice);

  // Stake
  const prevS = displayedStake;
  displayedStake += (stakeInj - displayedStake) * 0.1;
  updateNumber(stake, prevS, displayedStake, 4);
  stakeUsd.innerText = formatUSD(displayedStake * displayedPrice);

  // Rewards (scorrimento costante)
  const prevR = displayedRewards;
  displayedRewards += ((rewardsInj + displayedRewards*0.001) - displayedRewards) * 0.1; 
  updateNumber(rewards, prevR, displayedRewards, 6);
  rewardsUsd.innerText = formatUSD(displayedRewards * displayedPrice);

  // Daily / Monthly rewards
  dailyRewards.innerText = (displayedStake * apr / 100 / 365).toFixed(4) + " INJ / giorno";
  monthlyRewards.innerText = (displayedStake * apr / 100 / 12).toFixed(4) + " INJ / mese";

  // APR
  aprEl.innerText = apr.toFixed(2) + "%";

  // 24h price change
  updatePriceChange();

  // Last update
  updated.innerText = "Last Update: " + new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}

// ---------------- Start ----------------
async function init() {
  if(address) await loadData();
  animate();
  setInterval(loadData, 60000); // aggiorna dati ogni minuto
}

init();
