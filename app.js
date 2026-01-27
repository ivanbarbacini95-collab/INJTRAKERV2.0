// ---------- Globals ----------
let address = localStorage.getItem("inj_address") || "";

let displayedPrice = 0;
let targetPrice = 0;
let price24hOpen = 0;

let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;
let availableInj = 0, displayedAvailable = 0;
let apr = 0;

let chart, chartData = [];

// ---------- DOM ----------
const price = document.getElementById("price");
const price24h = document.getElementById("price24h");

const available = document.getElementById("available");
const availableUsd = document.getElementById("availableUsd");

const stake = document.getElementById("stake");
const stakeUsd = document.getElementById("stakeUsd");

const rewards = document.getElementById("rewards");
const rewardsUsd = document.getElementById("rewardsUsd");

const dailyRewards = document.getElementById("dailyRewards");
const monthlyRewards = document.getElementById("monthlyRewards");

const aprEl = document.getElementById("apr");
const updated = document.getElementById("updated");

const addressInput = document.getElementById("addressInput");
addressInput.value = address;

// ---------- Utils ----------
const fetchJSON = url => fetch(url).then(r => r.json());
const formatUSD = v => "≈ $" + v.toFixed(2);

function updateNumber(el, oldV, newV, fixed) {
  el.classList.remove("digit-up", "digit-down");
  el.innerText = newV.toFixed(fixed);
  if (newV > oldV) el.classList.add("digit-up");
  if (newV < oldV) el.classList.add("digit-down");
}

// ---------- Address ----------
addressInput.onchange = e => {
  address = e.target.value.trim();
  localStorage.setItem("inj_address", address);
  loadData();
};

// ---------- Load Injective Data ----------
async function loadData() {
  if (!address) return;

  try {
    // ---------- Balance ----------
    const balanceResp = await fetchJSON(
      `https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`
    );
    console.log("Balances raw:", balanceResp.balances);

    availableInj = 0;
    if (balanceResp.balances && balanceResp.balances.length > 0) {
      // Cerca uinj
      let injToken = balanceResp.balances.find(b => b.denom === "uinj");
      // fallback: qualsiasi token che contenga "inj"
      if (!injToken) {
        injToken = balanceResp.balances.find(b => b.denom.toLowerCase().includes("inj"));
      }
      if (injToken) availableInj = Number(injToken.amount) / 1e18;

      console.log("Token trovato per INJ:", injToken);
      console.log("Balance calcolato:", availableInj);
    }

    // ---------- Stake ----------
    const stakeResp = await fetchJSON(
      `https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`
    );
    console.log("Stake:", stakeResp.delegation_responses);

    stakeInj = 0;
    if (stakeResp.delegation_responses && stakeResp.delegation_responses.length > 0) {
      stakeInj = stakeResp.delegation_responses.reduce(
        (s, d) => s + Number(d.balance.amount),
        0
      ) / 1e18;
    }

    // ---------- Rewards ----------
    const rewardsResp = await fetchJSON(
      `https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`
    );
    console.log("Rewards:", rewardsResp.rewards);

    rewardsInj = 0;
    if (rewardsResp.rewards && rewardsResp.rewards.length > 0) {
      rewardsInj = rewardsResp.rewards.reduce(
        (s, r) => s + Number(r.reward[0]?.amount || 0),
        0
      ) / 1e18;
    }

    // ---------- APR ----------
    const inflationResp = await fetchJSON(
      `https://lcd.injective.network/cosmos/mint/v1beta1/inflation`
    );
    const poolResp = await fetchJSON(
      `https://lcd.injective.network/cosmos/staking/v1beta1/pool`
    );

    const bonded = Number(poolResp.pool.bonded_tokens);
    const total = bonded + Number(poolResp.pool.not_bonded_tokens);
    apr = bonded > 0
      ? (Number(inflationResp.inflation) * total / bonded) * 100
      : 0;

  } catch (e) {
    console.error("Errore loadData:", e);
  }
}

loadData();
setInterval(loadData, 60000);

// ---------- Price History ----------
async function fetchHistory() {
  try {
    const r = await fetch(
      "https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=1h&limit=24"
    );
    const d = await r.json();
    chartData = d.map(c => +c[4]);
    price24hOpen = +d[0][1];
    targetPrice = chartData.at(-1);
    drawChart();
  } catch (e) {
    console.error("Errore fetchHistory:", e);
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
      labels: chartData.map((_, i) => i),
      datasets: [{
        data: chartData,
        borderColor: "#22c55e",
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        backgroundColor: ctx => {
          const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 200);
          g.addColorStop(0, "rgba(34,197,94,0.35)");
          g.addColorStop(1, "rgba(34,197,94,0)");
          return g;
        }
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { x: { display: false }, y: { display: false } }
    }
  });
}

// ---------- Binance WebSocket ----------
function startWS() {
  const ws = new WebSocket(
    "wss://stream.binance.com:9443/ws/injusdt@trade"
  );

  ws.onmessage = e => targetPrice = +JSON.parse(e.data).p;
  ws.onclose = () => setTimeout(startWS, 3000);
}
startWS();

// ---------- Price 24h ----------
function updatePrice24h() {
  if (!price24hOpen) return;

  const diff = displayedPrice - price24hOpen;
  const pct = (diff / price24hOpen) * 100;

  price24h.innerText =
    `${diff >= 0 ? "+" : ""}${pct.toFixed(2)}% | ≈ $${diff.toFixed(2)}`;

  price.classList.toggle("up", diff >= 0);
  price.classList.toggle("down", diff < 0);
}

// ---------- Animation ----------
function animate() {
  // Price
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

  // Rewards
  const prevR = displayedRewards;
  displayedRewards += (rewardsInj - displayedRewards) * 0.1;
  updateNumber(rewards, prevR, displayedRewards, 6);
  rewardsUsd.innerText = formatUSD(displayedRewards * displayedPrice);

  // Daily / Monthly Rewards
  dailyRewards.innerText =
    (displayedStake * apr / 100 / 365).toFixed(4) + " INJ / giorno";
  monthlyRewards.innerText =
    (displayedStake * apr / 100 / 12).toFixed(4) + " INJ / mese";

  // APR
  aprEl.innerText = apr > 0 ? apr.toFixed(2) + "%" : "--";

  // Updated + Price24h
  updated.innerText = "Last Update: " + new Date().toLocaleTimeString();
  updatePrice24h();

  requestAnimationFrame(animate);
}

animate();
