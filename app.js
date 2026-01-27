let address = localStorage.getItem("inj_address") || "";

let displayedPrice = 0;
let targetPrice = 0;
let price24hOpen = 0;

let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;
let availableInj = 0, displayedAvailable = 0;
let apr = 0;

let chart, chartData = [];

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

    const bonded = Number(pool.pool.bonded_tokens);
    const total = bonded + Number(pool.pool.not_bonded_tokens);

    apr = bonded > 0
      ? (Number(inflation.inflation) * total / bonded) * 100
      : 0;

  } catch (e) {
    console.error(e);
  }
}

loadData();
setInterval(loadData, 60000);

// ---------- Price History ----------
async function fetchHistory() {
  const r = await fetch(
    "https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=1h&limit=24"
  );
  const d = await r.json();

  chartData = d.map(c => +c[4]);
  price24hOpen = +d[0][1];
  targetPrice = chartData.at(-1);

  drawChart();
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

  ws.onmessage = e => {
    targetPrice = +JSON.parse(e.data).p;
  };

  ws.onclose = () => setTimeout(startWS, 3000);
}
startWS();

// ---------- Price 24h ----------
function updatePrice24h() {
  if (!price24hOpen) return;

  const diff = displayedPrice - price24hOpen;
  const pct = (diff / price24hOpen) * 100;

  price24h.innerText =
    `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}% | ≈ $${diff.toFixed(2)}`;

  price.classList.toggle("up", diff >= 0);
  price.classList.toggle("down", diff < 0);
}

// ---------- Animation ----------
function animate() {
  const prevP = displayedPrice;
  displayedPrice += (targetPrice - displayedPrice) * 0.1;
  updateNumber(price, prevP, displayedPrice, 4);

  const prevA = displayedAvailable;
  displayedAvailable += (availableInj - displayedAvailable) * 0.1;
  updateNumber(available, prevA, displayedAvailable, 6);
  availableUsd.innerText = formatUSD(displayedAvailable * displayedPrice);

  const prevS = displayedStake;
  displayedStake += (stakeInj - displayedStake) * 0.1;
  updateNumber(stake, prevS, displayedStake, 4);
  stakeUsd.innerText = formatUSD(displayedStake * displayedPrice);

  const prevR = displayedRewards;
  displayedRewards += (rewardsInj - displayedRewards) * 0.1;
  updateNumber(rewards, prevR, displayedRewards, 6);
  rewardsUsd.innerText = formatUSD(displayedRewards * displayedPrice);

  dailyRewards.innerText =
    (displayedStake * apr / 100 / 365).toFixed(4) + " INJ / giorno";
  monthlyRewards.innerText =
    (displayedStake * apr / 100 / 12).toFixed(4) + " INJ / mese";

  aprEl.innerText = apr > 0 ? apr.toFixed(2) + "%" : "--";
  updated.innerText = "Last Update: " + new Date().toLocaleTimeString();

  updatePrice24h();
  requestAnimationFrame(animate);
}
animate();
