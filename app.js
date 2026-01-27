// ---------- Elementi DOM ----------
const addressInput = document.getElementById("addressInput");
const priceEl = document.getElementById("price");
const availableEl = document.getElementById("available");
const availableUsdEl = document.getElementById("availableUsd");
const stakeEl = document.getElementById("stake");
const stakeUsdEl = document.getElementById("stakeUsd");
const rewardsEl = document.getElementById("rewards");
const rewardsUsdEl = document.getElementById("rewardsUsd");
const aprEl = document.getElementById("apr");
const updatedEl = document.getElementById("updated");
const rewardBarEl = document.getElementById("rewardBar");
const ctxChart = document.getElementById("priceChart");

// ---------- Stato ----------
let address = localStorage.getItem("inj_address") || "";
let displayedPrice = 0, targetPrice = 0;
let price24hOpen = 0;

let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;
let availableInj = 0, displayedAvailable = 0;
let apr = 0;

let chart, chartData = [], chartLabels = [];
const rewardMax = 0.05; // massimo della barra 0-0.05 INJ

// ---------- Utils ----------
const fetchJSON = url => fetch(url).then(r => r.json());
const formatUSD = v => "≈ $" + v.toFixed(2);

function updateNumber(el, oldV, newV, fixed) {
  el.innerText = newV.toFixed(fixed);
  el.classList.remove("up", "down");
  if(newV > oldV) el.classList.add("up");
  else if(newV < oldV) el.classList.add("down");
}

// ---------- Address ----------
addressInput.value = address;
addressInput.onchange = e => {
  address = e.target.value.trim();
  localStorage.setItem("inj_address", address);
  loadData();
};

// ---------- Load Injective Data ----------
async function loadData() {
  if(!address) return;

  try {
    // Balance
    const balance = await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
    availableInj = (balance.balances?.find(b => b.denom==="inj")?.amount||0)/1e18;

    // Staked
    const stake = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
    stakeInj = stake.delegation_responses?.reduce((s,d)=>s+Number(d.balance.amount),0)/1e18 || 0;

    // Rewards
    const rewards = await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj = rewards.rewards?.reduce((s,r)=>s+Number(r.reward[0]?.amount||0),0)/1e18 || 0;

    // Aggiorna subito la barra dei rewards
    displayedRewards = rewardsInj;
    updateRewardBar();

    // APR
    const inflation = await fetchJSON("https://lcd.injective.network/cosmos/mint/v1beta1/inflation");
    const pool = await fetchJSON("https://lcd.injective.network/cosmos/staking/v1beta1/pool");
    apr = (inflation.inflation * (Number(pool.pool.bonded_tokens) + Number(pool.pool.not_bonded_tokens)) / Number(pool.pool.bonded_tokens)) * 100;

  } catch(e){ console.error(e); }
}
loadData();
setInterval(loadData, 60000);

// ---------- Price History 24h / 15min ----------
async function fetchHistory() {
  try {
    const r = await fetch("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=15m&limit=96");
    const d = await r.json();

    chartData = d.map(c => +c[4]); // prezzi di chiusura
    chartLabels = d.map(c => {
      const date = new Date(c[0]);
      const h = date.getHours().toString().padStart(2,'0');
      const m = date.getMinutes().toString().padStart(2,'0');
      return `${h}:${m}`;
    });

    price24hOpen = +d[0][1];
    targetPrice = chartData.at(-1);
    drawChart();
  } catch(e){ console.error("Errore fetchHistory:", e); }
}
fetchHistory();
setInterval(fetchHistory, 15*60*1000); // refresh ogni 15 minuti

function drawChart() {
  if(chart) chart.destroy();

  chart = new Chart(ctxChart, {
    type: "line",
    data: {
      labels: chartLabels,
      datasets: [{
        data: chartData,
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.2)",
        tension: 0.3,
        fill: true
      }]
    },
    options: {
      plugins:{ legend:{ display:false } },
      scales:{
        x:{ display:true, title:{ display:true, text:"Ora" } },
        y:{ beginAtZero:false, title:{ display:true, text:"Prezzo USDT" } }
      },
      animation:false
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

// ---------- Reward Bar ----------
function updateRewardBar() {
  const percent = Math.min(displayedRewards / rewardMax * 100, 100);
  rewardBarEl.style.width = percent + "%";
  rewardBarEl.innerHTML = `<span>${percent.toFixed(1)}%</span>`;
}

// ---------- Animazione principale ----------
function animate() {
  // Price
  const prevP = displayedPrice;
  displayedPrice += (targetPrice - displayedPrice) * 0.1;
  updateNumber(priceEl, prevP, displayedPrice, 4);

  // Available
  const prevA = displayedAvailable;
  displayedAvailable += (availableInj - displayedAvailable) * 0.1;
  updateNumber(availableEl, prevA, displayedAvailable, 6);
  availableUsdEl.innerText = formatUSD(displayedAvailable * displayedPrice);

  // Stake
  const prevS = displayedStake;
  displayedStake += (stakeInj - displayedStake) * 0.1;
  updateNumber(stakeEl, prevS, displayedStake, 4);
  stakeUsdEl.innerText = formatUSD(displayedStake * displayedPrice);

  // Rewards
  displayedRewards += (rewardsInj - displayedRewards) * 0.02;
  updateNumber(rewardsEl, 0, displayedRewards, 6);
  rewardsUsdEl.innerText = formatUSD(displayedRewards * displayedPrice);
  updateRewardBar();

  // APR
  aprEl.innerText = apr.toFixed(2) + "%";

  // Last update
  updatedEl.innerText = "Last Update: " + new Date().toLocaleTimeString();

  // Aggiorna l'ultimo punto del grafico in realtime
  if(chart){
    chart.data.datasets[0].data[chart.data.datasets[0].data.length-1] = displayedPrice;
    chart.update('none');
  }

  requestAnimationFrame(animate);
}

animate();
