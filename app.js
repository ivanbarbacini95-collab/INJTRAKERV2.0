let address = localStorage.getItem("inj_address") || "";

let displayedPrice = 0;
let targetPrice = 0;
let price24hOpen = 0;

let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;
let availableInj = 0, displayedAvailable = 0;
let apr = 0;

let chart, chartData = [];

// DOM
const priceEl = document.getElementById("price");
const pricePct = document.getElementById("pricePct");
const priceDelta = document.getElementById("priceDelta");

const availableEl = document.getElementById("available");
const stakeEl = document.getElementById("stake");
const rewardsEl = document.getElementById("rewards");
const aprEl = document.getElementById("apr");

const availableUsdEl = document.getElementById("availableUsd");
const stakeUsdEl = document.getElementById("stakeUsd");
const rewardsUsdEl = document.getElementById("rewardsUsd");

const rewardDaily = document.getElementById("rewardDaily");
const rewardWeekly = document.getElementById("rewardWeekly");

const rewardBar = document.getElementById("rewardBar");
const updatedEl = document.getElementById("updated");

// Utils
const fetchJSON = url => fetch(url).then(r => r.json());
const formatUSD = v => "≈ $" + v.toFixed(2);

function updateNumber(el, oldV, newV, decimals) {
  el.classList.remove("up", "down");
  if (newV > oldV) el.classList.add("up");
  if (newV < oldV) el.classList.add("down");
  el.textContent = newV.toFixed(decimals);
}

// Address
const addressInput = document.getElementById("addressInput");
addressInput.value = address;
addressInput.onchange = e => {
  address = e.target.value.trim();
  localStorage.setItem("inj_address", address);
  loadData();
};

// Load data
async function loadData() {
  if (!address) return;

  try {
    const balance = await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
    availableInj = (balance.balances?.find(b => b.denom === "inj")?.amount || 0) / 1e18;

    const stake = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
    stakeInj = stake.delegation_responses?.reduce((s,d)=>s+Number(d.balance.amount),0)/1e18 || 0;

    const rewards = await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj = rewards.rewards?.reduce((s,r)=>s + Number(r.reward[0]?.amount||0),0)/1e18 || 0;

    const inflation = await fetchJSON(`https://lcd.injective.network/cosmos/mint/v1beta1/inflation`);
    apr = Number(inflation.inflation) * 100;

  } catch (e) {
    console.error("Errore loadData:", e);
  }
}

loadData();
setInterval(loadData, 60000);

// Price history
async function fetchHistory() {
  const r = await fetch("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=1h&limit=24");
  const d = await r.json();
  chartData = d.map(c => Number(c[4]));
  price24hOpen = Number(d[0][1]);
  targetPrice = chartData.at(-1);
  drawChart();
}
fetchHistory();

// Chart
function drawChart() {
  const ctx = document.getElementById("priceChart").getContext("2d");
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: chartData.map((_,i)=>i),
      datasets: [{
        data: chartData,
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.15)",
        tension: 0.35,
        pointRadius: 0,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins:{legend:{display:false}},
      scales:{x:{display:false},y:{display:false}}
    }
  });
}

// Binance WS
function startWS() {
  const ws = new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
  ws.onmessage = e => targetPrice = Number(JSON.parse(e.data).p);
  ws.onclose = () => setTimeout(startWS, 3000);
}
startWS();

// Animate
function animate() {
  const prevP = displayedPrice;
  displayedPrice += (targetPrice - displayedPrice) * 0.1;
  updateNumber(priceEl, prevP, displayedPrice, 4);

  const delta = displayedPrice - price24hOpen;
  const pct = (delta / price24hOpen) * 100 || 0;
  pricePct.textContent = pct.toFixed(2) + "%";
  priceDelta.textContent = (delta >= 0 ? "+$" : "-$") + Math.abs(delta).toFixed(2);
  pricePct.className = pct >= 0 ? "up" : "down";
  priceDelta.className = pct >= 0 ? "up" : "down";

  displayedAvailable += (availableInj - displayedAvailable) * 0.1;
  updateNumber(availableEl, displayedAvailable, displayedAvailable, 6);
  availableUsdEl.textContent = formatUSD(displayedAvailable * displayedPrice);

  displayedStake += (stakeInj - displayedStake) * 0.1;
  updateNumber(stakeEl, displayedStake, displayedStake, 4);
  stakeUsdEl.textContent = formatUSD(displayedStake * displayedPrice);

  const prevR = displayedRewards;
  displayedRewards += (rewardsInj - displayedRewards) * 0.02 + rewardsInj * 0.000002;
  updateNumber(rewardsEl, prevR, displayedRewards, 7);
  rewardsUsdEl.textContent = formatUSD(displayedRewards * displayedPrice);

  const daily = displayedStake * apr / 100 / 365;
  rewardDaily.textContent = daily.toFixed(7) + " INJ / giorno";
  rewardWeekly.textContent = (daily * 7).toFixed(7) + " INJ / settimana";

  aprEl.textContent = apr.toFixed(2) + "%";

  rewardBar.style.width = Math.min(displayedRewards * 100, 100) + "%";

  updatedEl.textContent = "Last update: " + new Date().toLocaleTimeString();
  requestAnimationFrame(animate);
}
animate();
