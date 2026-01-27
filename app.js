let address = localStorage.getItem("inj_address") || "";

let displayedPrice = 0, targetPrice = 0, price24hOpen = 0;
let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;
let availableInj = 0, displayedAvailable = 0;
let apr = 0;

let chart, chartData = [];

// ---------- DOM Elements ----------
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

// ---------- Utils ----------
const fetchJSON = url => fetch(url).then(r => r.json());
const formatUSD = v => "≈ $" + v.toFixed(2);

function fitTextToContainer(el, maxFont = 28, minFont = 10) {
  let fontSize = maxFont;
  el.style.fontSize = fontSize + "px";
  while ((el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight) && fontSize > minFont) {
    fontSize -= 1;
    el.style.fontSize = fontSize + "px";
  }
}

function updateNumber(el, oldV, newV, fixed) {
  el.classList.remove("digit-up", "digit-down");
  el.innerText = newV.toFixed(fixed);
  if (newV > oldV) el.classList.add("digit-up");
  if (newV < oldV) el.classList.add("digit-down");
  fitTextToContainer(el, 28, 10);
}

// ---------- Address ----------
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
    const balance = await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
    availableInj = (balance.balances?.find(b => b.denom === "inj")?.amount || 0) / 1e18;

    const stakeResp = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
    stakeInj = stakeResp.delegation_responses?.reduce((s,d)=>s+Number(d.balance.amount),0)/1e18 || 0;

    const rewardsResp = await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj = rewardsResp.rewards?.reduce((s,r)=>s + Number(r.reward[0]?.amount||0),0)/1e18 || 0;

    const inflation = await fetchJSON(`https://lcd.injective.network/cosmos/mint/v1beta1/inflation`);
    const pool = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/pool`);
    apr = (inflation.inflation * (Number(pool.pool.bonded_tokens) + Number(pool.pool.not_bonded_tokens)) / Number(pool.pool.bonded_tokens)) * 100;

  } catch (e) {
    console.error("Errore caricamento dati:", e);
  }
}

// ---------- Price History ----------
async function fetchHistory() {
  try {
    const r = await fetch("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=1h&limit=24");
    const d = await r.json();
    chartData = d.map(c => +c[4]);
    price24hOpen = +d[0][1];
    targetPrice = chartData.at(-1);
    drawChart();
  } catch(e) {
    console.error("Errore caricamento storico prezzi:", e);
  }
}

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

// ---------- Animation ----------
async function init() {
  await loadData();
  fetchHistory();
  animate();
}

function animate() {
  // ---------- Price ----------
  const prevP = displayedPrice;
  displayedPrice += (targetPrice - displayedPrice) * 0.1;
  updateNumber(price, prevP, displayedPrice, 4);

  // ---------- Available ----------
  const prevA = displayedAvailable;
  displayedAvailable += (availableInj - displayedAvailable) * 0.1;
  updateNumber(available, prevA, displayedAvailable, 6);
  availableUsd.innerText = formatUSD(displayedAvailable * displayedPrice);

  // ---------- Stake ----------
  const prevS = displayedStake;
  displayedStake += (stakeInj - displayedStake) * 0.1;
  updateNumber(stake, prevS, displayedStake, 4);
  stakeUsd.innerText = formatUSD(displayedStake * displayedPrice);

  // ---------- Rewards sempre scorrevoli ----------
  const rewardSpeed = rewardsInj / 3600; // piccolo incremento costante
  displayedRewards += rewardSpeed / 60;   // frame rate
  updateNumber(rewards, 0, displayedRewards, 7); // 1 decimale in più
  rewardsUsd.innerText = formatUSD(displayedRewards * displayedPrice);

  dailyRewards.innerText = (displayedStake * apr / 100 / 365).toFixed(5) + " INJ / giorno";
  monthlyRewards.innerText = (displayedStake * apr / 100 / 12).toFixed(5) + " INJ / mese";

  aprEl.innerText = apr.toFixed(2) + "%";

  updated.innerText = "Last Update: " + new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}

// ---------- Refresh dati ogni minuto ----------
setInterval(loadData, 60000);

// ---------- Start ----------
init();
