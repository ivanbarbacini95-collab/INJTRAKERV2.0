let address = localStorage.getItem("inj_address") || "";

// Variabili
let displayedPrice = 0, targetPrice = 0, price24hOpen = 0;
let price24hLow = 0, price24hHigh = 0;
let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;
let availableInj = 0, displayedAvailable = 0;
let apr = 0;

let chart, chartData = [];
const rewardMax = 0.05; // 0 - 0.05

// Elementi
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

const priceBarEl = document.getElementById("priceBar");
const priceLineOpenEl = document.getElementById("priceLineOpen");
const priceMinEl = document.getElementById("priceMin");
const priceMaxEl = document.getElementById("priceMax");

const rewardBarEl = document.getElementById("rewardBar");
const rewardContainerEl = rewardBarEl.parentElement;

const addressInput = document.getElementById("addressInput");
addressInput.value = address;
addressInput.onchange = e => {
  address = e.target.value.trim();
  localStorage.setItem("inj_address", address);
  loadData();
};

// ---------- Fetch JSON ----------
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
  if(newV>oldV) el.classList.add("up");
  else if(newV<oldV) el.classList.add("down");
  setTimeout(()=>el.classList.remove("up","down"),500);
}

// ---------- Load Injective Data ----------
async function loadData(){
  if(!address) return;

  try{
    // Bank balance
    const balanceRes = await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
    const injBalance = balanceRes.balances?.find(b => b.denom === "inj");
    availableInj = injBalance ? Number(injBalance.amount)/1e18 : 0;

    // Staking
    const stakeRes = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
    stakeInj = stakeRes.delegation_responses?.reduce((sum,d) => sum + Number(d.balance.amount||0),0)/1e18 || 0;

    // Rewards
    const rewardsRes = await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj = rewardsRes.rewards?.reduce((sum,r)=>sum+Number(r.reward[0]?.amount||0),0)/1e18||0;

    // Inflation & pool
    const inflationRes = await fetchJSON(`https://lcd.injective.network/cosmos/mint/v1beta1/inflation`);
    const poolRes = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/pool`);
    const bonded = Number(poolRes.pool?.bonded_tokens||0);
    const notBonded = Number(poolRes.pool?.not_bonded_tokens||0);
    apr = (inflationRes.inflation * (bonded + notBonded) / bonded) * 100;

  } catch(e){ console.error("Errore caricamento dati Injective:", e); }
}

loadData();
setInterval(loadData,60000);

// ---------- Price History ----------
async function fetchHistory(){
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
fetchHistory();

// ---------- Draw chart ----------
function drawChart(){
  const ctx=document.getElementById("priceChart");
  if(chart) chart.destroy();
  chart=new Chart(ctx,{
    type:"line",
    data:{labels:chartData.map((_,i)=>i),datasets:[{data:chartData,borderColor:"#22c55e",tension:0.3,fill:true}]},
    options:{plugins:{legend:{display:false}},scales:{x:{display:false}}}
  });
}

// ---------- Binance WS ----------
function startWS(){
  const ws=new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
  ws.onmessage=e=>{
    const p = +JSON.parse(e.data).p;
    targetPrice = p;
    if(p>price24hHigh) price24hHigh=p;
    if(p<price24hLow) price24hLow=p;
  };
  ws.onclose=()=>setTimeout(startWS,3000);
}
startWS();

// ---------- Reward bar ----------
function updateRewardBar(){
  const percent = Math.min(displayedRewards/rewardMax*100,100);
  rewardBarEl.style.width = percent+"%";

  let percentEl = rewardContainerEl.querySelector("span");
  if(!percentEl){
    percentEl = document.createElement("span");
    rewardContainerEl.appendChild(percentEl);
  }
  percentEl.innerText = percent.toFixed(2)+"%";
}

// ---------- Animate ----------
function animate(){
  // Price
  const prevP = displayedPrice;
  displayedPrice += (targetPrice-displayedPrice)*0.1;
  updateNumber(price, prevP, displayedPrice, 4);

  // Delta %
  const delta = ((displayedPrice-price24hOpen)/price24hOpen)*100;
  price24h.innerText = (delta>0?"▲ ":"▼ ") + Math.abs(delta).toFixed(2) + "%";
  price24h.className = "sub " + (delta>0?"up":delta<0?"down":"");

  // Price bar
  const minVal = price24hLow, maxVal = price24hHigh, range = maxVal-minVal||1;
  const leftPercent = (displayedPrice-minVal)/range*100;
  priceBarEl.style.left = Math.min(leftPercent,100)+"%";
  priceBarEl.style.width = Math.abs(leftPercent-((price24hOpen-minVal)/range*100))+"%";
  priceBarEl.style.background = (displayedPrice>=price24hOpen) ? "#22c55e" : "#ef4444";
  priceLineOpenEl.style.left = ((price24hOpen-minVal)/range*100)+"%";
  priceMinEl.innerText = minVal.toFixed(4);
  priceMaxEl.innerText = maxVal.toFixed(4);

  // Available
  const prevA = displayedAvailable;
  displayedAvailable += (availableInj-displayedAvailable)*0.1;
  updateNumber(available, prevA, displayedAvailable, 6);
  updateNumber(availableUsd, prevA*displayedPrice, displayedAvailable*displayedPrice, 2);

  // Stake
  const prevS = displayedStake;
  displayedStake += (stakeInj-displayedStake)*0.1;
  updateNumber(stake, prevS, displayedStake, 4);
  updateNumber(stakeUsd, prevS*displayedPrice, displayedStake*displayedPrice, 2);

  // Rewards
  displayedRewards += (rewardsInj-displayedRewards)*0.05;
  updateNumber(rewards, displayedRewards, displayedRewards, 6);
  updateNumber(rewardsUsd, displayedRewards*displayedPrice, displayedRewards*displayedPrice, 2);
  updateRewardBar();

  // APR
  aprEl.innerText = apr.toFixed(2)+"%";

  // Last update
  updated.innerText = "Last Update: " + new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}
animate();

// ---------- Aggiorna rewards ogni 3 secondi ----------
setInterval(async()=>{
  if(!address) return;
  try{
    const rewardsRes = await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj = rewardsRes.rewards?.reduce((sum,r)=>sum+Number(r.reward[0]?.amount||0),0)/1e18||0;
  } catch(e){ console.error("Errore aggiornamento rewards:", e); }
},3000);
