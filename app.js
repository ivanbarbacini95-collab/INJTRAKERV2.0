let address = localStorage.getItem("inj_address") || "";

let displayedPrice = 0, targetPrice = 0, price24hOpen = 0;
let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;
let availableInj = 0, displayedAvailable = 0;
let apr = 0;
let chart, chartData = [];
const maxReward = 0.05; // barra fino a 0.05 INJ

// ---------- ELEMENTI HTML ----------
const price = document.getElementById("price");
const price24h = document.getElementById("price24h");
const available = document.getElementById("available");
const availableUsd = document.getElementById("availableUsd");
const stake = document.getElementById("stake");
const stakeUsd = document.getElementById("stakeUsd");
const rewards = document.getElementById("rewards");
const rewardsUsd = document.getElementById("rewardsUsd");
const aprEl = document.getElementById("apr");
const updated = document.getElementById("updated");
const rewardBarEl = document.getElementById("rewardBar");
const addressInput = document.getElementById("addressInput");

addressInput.value = address;
addressInput.onchange = e => {
  address = e.target.value.trim();
  localStorage.setItem("inj_address", address);
  loadData();
};

// ---------- UTILS ----------
const fetchJSON = url => fetch(url).then(r => r.json());
const formatUSD = v => "≈ $" + v.toFixed(2);

function updateNumber(el, oldV, newV, fixed) {
  el.innerText = newV.toFixed(fixed);
  el.classList.remove("up", "down");
  if (newV > oldV) el.classList.add("up");
  else if (newV < oldV) el.classList.add("down");
}

// ---------- LOAD DATA INJ ----------
async function loadData() {
  if (!address) return;
  try {
    const balance = await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
    availableInj = (balance.balances?.find(b => b.denom === "inj")?.amount || 0)/1e18;

    const stakeData = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
    stakeInj = stakeData.delegation_responses?.reduce((s,d)=>s + Number(d.balance.amount),0)/1e18 || 0;

    const rewardsData = await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj = rewardsData.rewards?.reduce((s,r)=>s + Number(r.reward[0]?.amount||0),0)/1e18 || 0;

    const inflation = await fetchJSON(`https://lcd.injective.network/cosmos/mint/v1beta1/inflation`);
    const pool = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/pool`);
    apr = (inflation.inflation * (Number(pool.pool.bonded_tokens)+Number(pool.pool.not_bonded_tokens))/Number(pool.pool.bonded_tokens))*100;

  } catch(e){ console.error(e); }
}

loadData();
setInterval(loadData, 60000);

// ---------- PRICE HISTORY ----------
async function fetchHistory() {
  try {
    const r = await fetch("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=15m&limit=96");
    const d = await r.json();
    chartData = d.map(c => +c[4]);
    price24hOpen = +d[0][1];
    targetPrice = chartData.at(-1);
    drawChart();
  } catch(e){ console.error(e); }
}
fetchHistory();

// ---------- DRAW CHART ----------
function drawChart() {
  const ctx = document.getElementById("priceChart");
  if(chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: chartData.map((_,i)=>i),
      datasets:[{
        data: chartData,
        borderColor:"#3b82f6",
        tension:0.3,
        fill:true,
        backgroundColor:"rgba(59,130,246,0.2)"
      }]
    },
    options:{plugins:{legend:{display:false}}, scales:{x:{display:false}}}
  });
}

// ---------- BINANCE WS ----------
function startWS(){
  const ws = new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
  ws.onmessage = e => targetPrice = +JSON.parse(e.data).p;
  ws.onclose = ()=>setTimeout(startWS,3000);
}
startWS();

// ---------- REWARD BAR ----------
function updateRewardBar(){
  displayedRewards += (rewardsInj - displayedRewards)*0.05;
  const fillPercent = Math.min(displayedRewards/maxReward*100,100);
  rewardBarEl.style.width = fillPercent + "%";
  rewardBarEl.innerHTML = `<span>${fillPercent.toFixed(1)}%</span>`;
}

// ---------- ANIMATE DASHBOARD ----------
function animate(){
  displayedPrice += (targetPrice-displayedPrice)*0.1;
  updateNumber(price, displayedPrice, displayedPrice,4);

  displayedAvailable += (availableInj-displayedAvailable)*0.1;
  updateNumber(available, displayedAvailable, displayedAvailable,6);
  availableUsd.innerText = formatUSD(displayedAvailable*displayedPrice);

  displayedStake += (stakeInj-displayedStake)*0.1;
  updateNumber(stake, displayedStake, displayedStake,4);
  stakeUsd.innerText = formatUSD(displayedStake*displayedPrice);

  updateRewardBar();
  updateNumber(rewards, displayedRewards, displayedRewards,6);
  rewardsUsd.innerText = formatUSD(displayedRewards*displayedPrice);

  aprEl.innerText = apr.toFixed(2)+"%";
  updated.innerText = "Last Update: "+new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}
animate();
