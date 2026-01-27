let address = localStorage.getItem("inj_address") || "";

let targetPrice = 0;
let displayedPrice = 0;
let price24hOpen = 0;

let availableInj = 0, displayedAvailable = 0;
let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;
let apr = 0;

let chart, chartData = [];
let high24h = 0, low24h = 0;
const MAX_REWARD = 0.05;

/* ELEMENTS */
const priceEl = price;
const price24hEl = document.getElementById("price24h");
const arrowEl = document.getElementById("priceArrow");
const deltaPctEl = document.getElementById("priceDelta");
const deltaUsdEl = document.getElementById("priceDeltaUsd");
const highLowEl = document.getElementById("highLow");

/* ADDRESS */
addressInput.value = address;
addressInput.onchange = e => {
  address = e.target.value.trim();
  localStorage.setItem("inj_address", address);
  loadData();
};

/* UTILS */
const fetchJSON = u => fetch(u).then(r => r.json());
const formatUSD = v => "≈ $" + v.toFixed(2);

const last = {};
function setNumber(el, v, d, k) {
  if (last[k] !== undefined && v !== last[k]) {
    el.classList.remove("up", "down");
    el.classList.add(v > last[k] ? "up" : "down");
    setTimeout(() => el.classList.remove("up", "down"), 120);
  }
  last[k] = v;
  el.innerText = v.toFixed(d);
}

/* INJ DATA */
async function loadData() {
  if (!address) return;

  const b = await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
  availableInj = (b.balances?.find(x => x.denom === "inj")?.amount || 0) / 1e18;

  const s = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
  stakeInj = s.delegation_responses?.reduce((a, d) => a + +d.balance.amount, 0) / 1e18 || 0;

  const r = await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
  rewardsInj = r.rewards?.reduce((a, d) => a + +(d.reward[0]?.amount || 0), 0) / 1e18 || 0;

  const i = await fetchJSON(`https://lcd.injective.network/cosmos/mint/v1beta1/inflation`);
  const p = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/pool`);
  apr = i.inflation * (p.pool.bonded_tokens / p.pool.bonded_tokens) * 100;
}
loadData();
setInterval(loadData, 60000);

/* HISTORY 15m */
async function fetchHistory() {
  const r = await fetch("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=15m&limit=96");
  const d = await r.json();
  chartData = d.map(c => +c[4]);
  price24hOpen = +d[0][1];
  high24h = Math.max(...chartData);
  low24h = Math.min(...chartData);
  highLowEl.innerText = `H: $${high24h.toFixed(2)} | L: $${low24h.toFixed(2)}`;
  targetPrice = chartData.at(-1);
  drawChart();
}
fetchHistory();

/* CHART */
function drawChart() {
  if (chart) chart.destroy();
  chart = new Chart(priceChart, {
    type: "line",
    data: {
      labels: chartData.map((_, i) => i),
      datasets: [{
        data: chartData,
        borderColor: "#3b82f6",
        backgroundColor: "rgba(59,130,246,0.2)",
        tension: 0.3,
        fill: true
      }]
    },
    options: { plugins: { legend: { display: false } }, scales: { x: { display: false } } }
  });
}

/* WS */
const ws = new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
ws.onmessage = e => targetPrice = +JSON.parse(e.data).p;

/* LOOP */
function animate() {
  displayedPrice += (targetPrice - displayedPrice) * 0.1;
  setNumber(priceEl, displayedPrice, 4, "price");

  const delta = displayedPrice - price24hOpen;
  const pct = price24hOpen ? delta / price24hOpen * 100 : 0;

  price24hEl.classList.remove("up", "down", "neutral");
  if (pct > 0.01) { price24hEl.classList.add("up"); arrowEl.innerText = "▲"; }
  else if (pct < -0.01) { price24hEl.classList.add("down"); arrowEl.innerText = "▼"; }
  else { price24hEl.classList.add("neutral"); arrowEl.innerText = "▬"; }

  deltaPctEl.innerText = pct.toFixed(2) + "%";
  deltaUsdEl.innerText = formatUSD(delta);

  displayedAvailable += (availableInj - displayedAvailable) * 0.1;
  setNumber(available, displayedAvailable, 6, "avail");
  setNumber(availableUsd, displayedAvailable * displayedPrice, 2, "availUsd");

  displayedStake += (stakeInj - displayedStake) * 0.1;
  setNumber(stake, displayedStake, 4, "stake");
  setNumber(stakeUsd, displayedStake * displayedPrice, 2, "stakeUsd");

  displayedRewards += (rewardsInj - displayedRewards) * 0.05;
  setNumber(rewards, displayedRewards, 6, "rew");
  setNumber(rewardsUsd, displayedRewards * displayedPrice, 2, "rewUsd");

  rewardBar.style.width = Math.min(displayedRewards / MAX_REWARD * 100, 100) + "%";
  rewardBar.innerText = (displayedRewards / MAX_REWARD * 100).toFixed(1) + "%";

  aprEl.innerText = apr.toFixed(2) + "%";
  updated.innerText = "Last Update: " + new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}
animate();
