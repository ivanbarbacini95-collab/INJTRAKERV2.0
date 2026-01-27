let address = localStorage.getItem("inj_address") || "";

let displayedPrice = 0;
let targetPrice = 0;
let price24hOpen = 0;

let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;
let availableInj = 0, displayedAvailable = 0;
let apr = 0;

let chart, chartData = [];

// ---------- ELEMENTS ----------
const addressInput = document.getElementById("addressInput");
const priceEl = document.getElementById("price");
const price24hEl = document.getElementById("price24h");
const availableEl = document.getElementById("available");
const availableUsdEl = document.getElementById("availableUsd");
const stakeEl = document.getElementById("stake");
const stakeUsdEl = document.getElementById("stakeUsd");
const rewardsEl = document.getElementById("rewards");
const rewardsUsdEl = document.getElementById("rewardsUsd");
const dailyRewardsEl = document.getElementById("dailyRewards");
const weeklyRewardsEl = document.getElementById("weeklyRewards");
const aprEl = document.getElementById("apr");
const updatedEl = document.getElementById("updated");

// ---------- UTILS ----------
const fetchJSON = url => fetch(url).then(r => r.json());
const formatUSD = v => "≈ $" + v.toFixed(2);

function updateNumber(el, oldV, newV, fixed) {
  el.innerText = newV.toFixed(fixed);
  el.classList.remove("up", "down");
  if(newV > oldV) el.classList.add("up");
  if(newV < oldV) el.classList.add("down");
}

// ---------- ADDRESS ----------
addressInput.value = address;
addressInput.onchange = e => {
  address = e.target.value.trim();
  localStorage.setItem("inj_address", address);
  loadData();
};

// ---------- LOAD INJECTIVE DATA ----------
async function loadData() {
  if(!address) return;

  try {
    const balance = await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
    availableInj = (balance.balances?.find(b => b.denom === "inj")?.amount || 0)/1e18;

    const stake = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
    stakeInj = stake.delegation_responses?.reduce((s,d)=>s+Number(d.balance.amount),0)/1e18 || 0;

    const rewards = await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj = rewards.rewards?.reduce((s,r)=>s + Number(r.reward[0]?.amount||0),0)/1e18 || 0;

    const inflation = await fetchJSON(`https://lcd.injective.network/cosmos/mint/v1beta1/inflation`);
    const pool = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/pool`);
    apr = (inflation.inflation * (Number(pool.pool.bonded_tokens)+Number(pool.pool.not_bonded_tokens))/Number(pool.pool.bonded_tokens))*100;

  } catch(e){
    console.error(e);
  }
}

loadData();
setInterval(loadData, 60000);

// ---------- BINANCE PRICE 24H ----------
async function fetchHistory(){
  const r = await fetch("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=1h&limit=24");
  const d = await r.json();
  chartData = d.map(c => +c[4]);
  price24hOpen = +d[0][1];
  targetPrice = chartData.at(-1);
  drawChart();
}
fetchHistory();

function drawChart(){
  const ctx = document.getElementById("priceChart");
  if(chart) chart.destroy();
  chart = new Chart(ctx,{
    type:"line",
    data:{
      labels: chartData.map((_,i)=>i),
      datasets:[{
        data: chartData,
        borderColor:"#22c55e",
        tension:0.3,
        fill:true
      }]
    },
    options:{plugins:{legend:{display:false}},scales:{x:{display:false}}}
  });
}

// ---------- BINANCE WS ----------
function startWS(){
  const ws = new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
  ws.onmessage = e => targetPrice = +JSON.parse(e.data).p;
  ws.onclose = () => setTimeout(startWS,3000);
}
startWS();

// ---------- ANIMATE ----------
function animate(){
  // Prezzo INJ
  const prevPrice = displayedPrice;
  displayedPrice += (targetPrice - displayedPrice)*0.1;
  updateNumber(priceEl, prevPrice, displayedPrice, 4);

  // 24h % e delta
  let delta = displayedPrice - price24hOpen;
  let deltaPerc = price24hOpen ? delta/price24hOpen*100 : 0;
  price24hEl.innerText = deltaPerc.toFixed(2)+"% | ≈ $"+delta.toFixed(4);
  price24hEl.classList.remove("up","down");
  if(delta>0) price24hEl.classList.add("up");
  if(delta<0) price24hEl.classList.add("down");

  // Available
  const prevA = displayedAvailable;
  displayedAvailable += (availableInj - displayedAvailable)*0.1;
  updateNumber(availableEl, prevA, displayedAvailable,6);
  availableUsdEl.innerText = formatUSD(displayedAvailable*displayedPrice);

  // Stake
  const prevS = displayedStake;
  displayedStake += (stakeInj - displayedStake)*0.1;
  updateNumber(stakeEl, prevS, displayedStake,4);
  stakeUsdEl.innerText = formatUSD(displayedStake*displayedPrice);

  // Rewards
  const prevR = displayedRewards;
  displayedRewards += (rewardsInj - displayedRewards)*0.1;
  updateNumber(rewardsEl, prevR, displayedRewards,6);
  rewardsUsdEl.innerText = formatUSD(displayedRewards*displayedPrice);
  dailyRewardsEl.innerText = (displayedStake*apr/100/365).toFixed(4)+" INJ / giorno";
  weeklyRewardsEl.innerText = (displayedStake*apr/100/52).toFixed(4)+" INJ / settimana";

  // APR
  aprEl.innerText = apr.toFixed(2)+"%";

  // Last update
  updatedEl.innerText = "Last Update: "+new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}

animate();
