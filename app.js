// ===============================
// Injective Dashboard JS completo
// ===============================

// Recupera address dal localStorage
let address = localStorage.getItem("inj_address") || "";

// ---------- Variabili principali ----------
let displayedPrice = 0, targetPrice = 0, price24hOpen = 0;
let price24hLow = 0, price24hHigh = 0;
let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;
let availableInj = 0, displayedAvailable = 0;
let apr = 0;

let chart, chartData = [];
const rewardTargetsArray = [0.005,0.01,0.02,0.03,0.04,0.05,0.06,0.07,0.08,0.09,0.1];

// Elementi DOM
const addressInput = document.getElementById("addressInput");
const priceEl = document.getElementById("price");
const price24hEl = document.getElementById("price24h");
const availableEl = document.getElementById("available");
const availableUsdEl = document.getElementById("availableUsd");
const stakeEl = document.getElementById("stake");
const stakeUsdEl = document.getElementById("stakeUsd");
const rewardsEl = document.getElementById("rewards");
const rewardsUsdEl = document.getElementById("rewardsUsd");
const aprEl = document.getElementById("apr");
const updatedEl = document.getElementById("updated");
const rewardBarEl = document.getElementById("rewardBar");
const rewardTargetsEl = document.getElementById("rewardTargets");
const priceBarEl = document.getElementById("priceBar");
const priceLineOpenEl = document.getElementById("priceLineOpen");
const priceMinEl = document.getElementById("priceMin");
const priceMaxEl = document.getElementById("priceMax");

addressInput.value = address;

// ---------- Helpers ----------
const fetchJSON = async url => {
  try {
    const res = await fetch(url);
    return await res.json();
  } catch(e){
    console.error("Fetch error:", url, e);
    return {};
  }
};

const formatUSD = v => "≈ $" + v.toFixed(2);

function updateNumber(el, oldV, newV, fixed){
  el.innerText = newV.toFixed(fixed);
  if(newV > oldV) el.classList.add("up");
  else if(newV < oldV) el.classList.add("down");
  setTimeout(()=>el.classList.remove("up","down"), 500);
}

// ---------- Input Address ----------
addressInput.onchange = e => {
  address = e.target.value.trim();
  if(!address) return;
  localStorage.setItem("inj_address", address);
  initDashboard();
};

// ---------- Inizializza Dashboard ----------
let ws;
let loadInterval, rewardsInterval;
function initDashboard(){
  loadData();
  fetchHistory();
  startWS();
  animate();

  if(loadInterval) clearInterval(loadInterval);
  loadInterval = setInterval(loadData, 60000);

  if(rewardsInterval) clearInterval(rewardsInterval);
  rewardsInterval = setInterval(updateRewards, 3000);
}

// ---------- Load Injective Data ----------
async function loadData(){
  if(!address) return;

  try {
    // Available balance
    const balanceRes = await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
    const injBalance = balanceRes.balances?.find(b => b.denom === "inj");
    availableInj = injBalance ? Number(injBalance.amount)/1e18 : 0;

    // Stake
    const stakeRes = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
    stakeInj = stakeRes.delegation_responses?.reduce((sum,d) => sum + Number(d.balance.amount||0),0)/1e18 || 0;

    // APR
    const inflationRes = await fetchJSON(`https://lcd.injective.network/cosmos/mint/v1beta1/inflation`);
    const poolRes = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/pool`);
    const bonded = Number(poolRes.pool?.bonded_tokens || 0);
    const notBonded = Number(poolRes.pool?.not_bonded_tokens || 0);
    apr = (inflationRes.inflation * (bonded + notBonded) / bonded) * 100;

  } catch(e){ console.error("Errore caricamento dati Injective:", e); }
}

// ---------- Aggiorna rewards ----------
async function updateRewards(){
  if(!address) return;
  try {
    const rewardsRes = await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj = rewardsRes.rewards?.reduce((sum,r)=>sum+Number(r.reward[0]?.amount||0),0)/1e18 || 0;
  } catch(e){ console.error("Errore aggiornamento rewards:", e); }
}

// ---------- Fetch Price History ----------
async function fetchHistory(){
  if(!address) return;
  try{
    const res = await fetch("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=15m&limit=96");
    const d = await res.json();
    chartData = d.map(c => +c[4]);
    price24hOpen = +d[0][1];
    price24hLow = Math.min(...chartData);
    price24hHigh = Math.max(...chartData);
    targetPrice = chartData.at(-1);
    drawChart();
  } catch(e){ console.error("Errore price history:", e); }
}

// ---------- Draw / Update Chart ----------
function drawChart(){
  const ctx = document.getElementById("priceChart");
  if(chart) {
    chart.data.datasets[0].data = chartData;
    chart.update('none');
    return;
  }
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: chartData.map((_,i)=>i),
      datasets: [{ data: chartData, borderColor: "#22c55e", tension: 0.3, fill: true }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { x: { display: false } },
      animation: { duration: 0 }
    }
  });
}

// ---------- WebSocket Live Prices ----------
function startWS(){
  if(!address) return;
  if(ws) ws.close();

  ws = new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
  ws.onmessage = e => {
    const p = +JSON.parse(e.data).p;
    targetPrice = p;
    if(p > price24hHigh) price24hHigh = p;
    if(p < price24hLow) price24hLow = p;
  };
  ws.onclose = () => setTimeout(startWS, 3000);
}

// ---------- Reward Bar (range 0 → 0.05) ----------
function updateRewardBar(){
  const maxReward = 0.05; // range fisso
  const fillPercent = Math.min(displayedRewards / maxReward * 100, 100);
  rewardBarEl.style.width = fillPercent + "%";

  rewardTargetsEl.innerHTML = "";
  const frag = document.createDocumentFragment();

  rewardTargetsArray.forEach(t=>{
    if(t <= maxReward){
      const span = document.createElement("span");
      span.style.left = (t / maxReward * 100) + "%";
      span.innerText = t;
      frag.appendChild(span);
    }
  });
  rewardTargetsEl.appendChild(frag);
}

// ---------- Price Bar con logica ATH/ATL ----------
function updatePriceBar() {
  const minVal = price24hLow;
  const maxVal = price24hHigh;
  const range = maxVal - minVal || 1;

  const openPercent = (price24hOpen - minVal) / range * 100;
  const pricePercent = (displayedPrice - minVal) / range * 100;

  if (displayedPrice >= price24hOpen) {
    priceBarEl.style.left = openPercent + "%";
    priceBarEl.style.width = (pricePercent - openPercent) + "%";
    priceBarEl.style.background = "#22c55e"; // verde
  } else {
    priceBarEl.style.left = pricePercent + "%";
    priceBarEl.style.width = (openPercent - pricePercent) + "%";
    priceBarEl.style.background = "#ef4444"; // rosso
  }

  priceLineOpenEl.style.left = openPercent + "%";

  // ATH/ATL numeri gialli
  if (displayedPrice >= price24hHigh) {
    priceMaxEl.classList.add("ath");
    price24hHigh = displayedPrice;
  } else {
    priceMaxEl.classList.remove("ath");
  }

  if (displayedPrice <= price24hLow) {
    priceMinEl.classList.add("atl");
    price24hLow = displayedPrice;
  } else {
    priceMinEl.classList.remove("atl");
  }

  priceMinEl.innerText = price24hLow.toFixed(4);
  priceMaxEl.innerText = price24hHigh.toFixed(4);
}

// ---------- Animate Numbers ----------
function animate(){
  if(!address) return;

  // Price
  const prevP = displayedPrice;
  displayedPrice += (targetPrice - displayedPrice) * 0.1;
  updateNumber(priceEl, prevP, displayedPrice, 4);

  // Price delta %
  const delta = ((displayedPrice - price24hOpen)/price24hOpen)*100;
  price24hEl.innerText = (delta>0?"▲ ":"▼ ") + Math.abs(delta).toFixed(2) + "%";
  price24hEl.className = "sub " + (delta>0?"up":delta<0?"down":"");

  // Price bar
  updatePriceBar();

  // Available
  const prevA = displayedAvailable;
  displayedAvailable += (availableInj - displayedAvailable) * 0.1;
  updateNumber(availableEl, prevA, displayedAvailable, 6);
  updateNumber(availableUsdEl, prevA*displayedPrice, displayedAvailable*displayedPrice, 2);

  // Stake
  const prevS = displayedStake;
  displayedStake += (stakeInj - displayedStake) * 0.1;
  updateNumber(stakeEl, prevS, displayedStake, 4);
  updateNumber(stakeUsdEl, prevS*displayedPrice, displayedStake*displayedPrice, 2);

  // Rewards
  displayedRewards += (rewardsInj - displayedRewards) * 0.05;
  updateNumber(rewardsEl, displayedRewards, displayedRewards, 6);
  updateNumber(rewardsUsdEl, displayedRewards*displayedPrice, displayedRewards*displayedPrice, 2);
  updateRewardBar();

  // APR
  aprEl.innerText = apr.toFixed(2) + "%";

  // Last update
  updatedEl.innerText = "Last Update: " + new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}
