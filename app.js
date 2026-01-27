/* ================== STATE ================== */
let address = localStorage.getItem("inj_address") || "";

let targetPrice = 0;
let price24hOpen = 0;
let displayedPrice = 0;

let availableInj = 0, displayedAvailable = 0;
let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;
let apr = 0;

let chart, chartData = [];
const MAX_REWARD = 0.05;

/* ================== ELEMENTS ================== */
const priceEl = document.getElementById("price");
const price24hEl = document.getElementById("price24h");
const availableEl = document.getElementById("available");
const availableUsdEl = document.getElementById("availableUsd");
const stakeEl = document.getElementById("stake");
const stakeUsdEl = document.getElementById("stakeUsd");
const rewardsEl = document.getElementById("rewards");
const rewardsUsdEl = document.getElementById("rewardsUsd");
const rewardBarEl = document.getElementById("rewardBar");
const aprEl = document.getElementById("apr");
const updatedEl = document.getElementById("updated");
const addressInput = document.getElementById("addressInput");

/* ================== ADDRESS ================== */
addressInput.value = address;
addressInput.onchange = e => {
  address = e.target.value.trim();
  localStorage.setItem("inj_address", address);
  loadInjData();
};

/* ================== UTILS ================== */
const fetchJSON = url => fetch(url).then(r => r.json());
const formatUSD = v => "≈ $" + v.toFixed(2);

/* ================== COLOR CONTROL ================== */
const lastValue = {};

function flashColor(el, key, value) {
  if (lastValue[key] !== undefined && lastValue[key] !== value) {
    el.classList.remove("up", "down");
    el.classList.add(value > lastValue[key] ? "up" : "down");
    setTimeout(() => el.classList.remove("up", "down"), 120);
  }
  lastValue[key] = value;
}

function setNumber(el, value, decimals, key) {
  el.innerText = value.toFixed(decimals);
  flashColor(el, key, value);
}

/* ================== LOAD INJECTIVE ================== */
async function loadInjData() {
  if (!address) return;

  try {
    const balance = await fetchJSON(
      `https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`
    );
    availableInj =
      (balance.balances?.find(b => b.denom === "inj")?.amount || 0) / 1e18;

    const stake = await fetchJSON(
      `https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`
    );
    stakeInj =
      stake.delegation_responses?.reduce(
        (s, d) => s + Number(d.balance.amount),
        0
      ) / 1e18 || 0;

    const rewards = await fetchJSON(
      `https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`
    );
    rewardsInj =
      rewards.rewards?.reduce(
        (s, r) => s + Number(r.reward[0]?.amount || 0),
        0
      ) / 1e18 || 0;

    const inflation = await fetchJSON(
      `https://lcd.injective.network/cosmos/mint/v1beta1/inflation`
    );
    const pool = await fetchJSON(
      `https://lcd.injective.network/cosmos/staking/v1beta1/pool`
    );

    apr =
      (inflation.inflation *
        (Number(pool.pool.bonded_tokens) +
          Number(pool.pool.not_bonded_tokens))) /
      Number(pool.pool.bonded_tokens) *
      100;
  } catch (e) {
    console.error(e);
  }
}

loadInjData();
setInterval(loadInjData, 60000);

/* ================== PRICE HISTORY 15m ================== */
async function fetchHistory() {
  const r = await fetch(
    "https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=15m&limit=96"
  );
  const d = await r.json();
  chartData = d.map(c => +c[4]);
  price24hOpen = +d[0][1];
  targetPrice = chartData.at(-1);
  drawChart();
}
fetchHistory();

/* ================== HD CHART ================== */
function drawChart() {
  const canvas = document.getElementById("priceChart");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: chartData.map((_, i) => i),
      datasets: [
        {
          data: chartData,
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59,130,246,0.2)",
          tension: 0.3,
          fill: true
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { x: { display: false } },
      maintainAspectRatio: false
    }
  });
}

/* ================== BINANCE WS ================== */
function startWS() {
  const ws = new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
  ws.onmessage = e => (targetPrice = +JSON.parse(e.data).p);
  ws.onclose = () => setTimeout(startWS, 3000);
}
startWS();

/* ================== ANIMATION LOOP ================== */
function animate() {
  /* PRICE */
  displayedPrice += (targetPrice - displayedPrice) * 0.1;
  setNumber(priceEl, displayedPrice, 4, "price");

  /* DELTA 24H */
  const delta = displayedPrice - price24hOpen;
  const deltaPct = price24hOpen ? (delta / price24hOpen) * 100 : 0;
  flashColor(price24hEl, "delta", deltaPct);
  price24hEl.innerText = `${deltaPct.toFixed(2)}% | ${formatUSD(delta)}`;

  /* AVAILABLE */
  displayedAvailable += (availableInj - displayedAvailable) * 0.1;
  setNumber(availableEl, displayedAvailable, 6, "available");
  setNumber(
    availableUsdEl,
    displayedAvailable * displayedPrice,
    2,
    "availableUsd"
  );

  /* STAKE */
  displayedStake += (stakeInj - displayedStake) * 0.1;
  setNumber(stakeEl, displayedStake, 4, "stake");
  setNumber(
    stakeUsdEl,
    displayedStake * displayedPrice,
    2,
    "stakeUsd"
  );

  /* REWARDS */
  displayedRewards += (rewardsInj - displayedRewards) * 0.05;
  setNumber(rewardsEl, displayedRewards, 6, "rewards");
  setNumber(
    rewardsUsdEl,
    displayedRewards * displayedPrice,
    2,
    "rewardsUsd"
  );

  const fill = Math.min((displayedRewards / MAX_REWARD) * 100, 100);
  rewardBarEl.style.width = fill + "%";
  rewardBarEl.innerText = fill.toFixed(1) + "%";

  /* APR */
  aprEl.innerText = apr.toFixed(2) + "%";

  updatedEl.innerText =
    "Last Update: " + new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}

animate();
