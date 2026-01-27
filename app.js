let address = localStorage.getItem("inj_address") || "";

let displayedPrice = 0;
let targetPrice = 0;
let price24hOpen = 0;
let price24hMin = 0;
let price24hMax = 0;

let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;
let availableInj = 0, displayedAvailable = 0;
let apr = 0;

let chart, chartData = [];
const rewardTargetsArray = [0.005,0.01,0.02,0.03,0.04,0.05,0.06,0.07,0.08,0.09,0.1];

const fetchJSON = url => fetch(url).then(r => r.json());
const formatUSD = v => "≈ $" + v.toFixed(2);

function updateNumber(el, oldV, newV, fixed) {
  el.innerText = newV.toFixed(fixed);
  if(newV>oldV){el.classList.add("up");el.classList.remove("down");}
  else if(newV<oldV){el.classList.add("down");el.classList.remove("up");}
  else{el.classList.remove("up","down");}
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
    const balance = await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
    availableInj = (balance.balances?.find(b => b.denom === "inj")?.amount || 0)/1e18;

    const stake = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
    stakeInj = stake.delegation_responses?.reduce((s,d)=>s+Number(d.balance.amount),0)/1e18 || 0;

    const rewards = await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj = rewards.rewards?.reduce((s,r)=>s + Number(r.reward[0]?.amount||0),0)/1e18 || 0;

    const inflation = await fetchJSON(`https://lcd.injective.network/cosmos/mint/v1beta1/inflation`);
    const pool = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/pool`);
    apr = (inflation.inflation*(Number(pool.pool.bonded_tokens)+Number(pool.pool.not_bonded_tokens))/Number(pool.pool.bonded_tokens))*100;
  } catch(e){console.error(e);}
}
loadData();
setInterval(loadData,60000);

// ---------- Price History 15min ----------
const price = document.getElementById("price");
const price24hEl = document.getElementById("price24h");
const priceBarLeft = document.getElementById("priceBarLeft");
const priceBarRight = document.getElementById("priceBarRight");
const priceLowEl = document.getElementById("priceLow");
const priceHighEl = document.getElementById("priceHigh");

async function fetchHistory(){
  const r = await fetch("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=15m&limit=96");
  const d = await r.json();
  chartData = d.map(c=>+c[4]);
  price24hOpen = +d[0][1];
  price24hMin = Math.min(...chartData);
  price24hMax = Math.max(...chartData);
  targetPrice = chartData.at(-1);
  priceLowEl.innerText = price24hMin.toFixed(4);
  priceHighEl.innerText = price24hMax.toFixed(4);
  drawChart();
}
fetchHistory();

// ---------- Chart ----------
function drawChart(){
  const ctx = document.getElementById("priceChart");
  if(chart) chart.destroy();
  chart = new Chart(ctx,{
    type:"line",
    data:{labels:chartData.map((_,i)=>i),datasets:[{data:chartData,borderColor:"#22c55e",tension:0.3,fill:true}]},
    options:{plugins:{legend:{display:false}},scales:{x:{display:false}}}
  });
}

// ---------- Binance WS ----------
function startWS(){
  const ws = new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
  ws.onmessage=e=>targetPrice=+JSON.parse(e.data).p;
  ws.onclose=()=>setTimeout(startWS,3000);
}
startWS();

// ---------- Reward Bar ----------
const rewardBarEl = document.getElementById("rewardBar");
function updateRewardBar(){
  const maxReward = Math.max(rewardsInj, rewardTargetsArray[rewardTargetsArray.length-1]);
  const fillPercent = Math.min(displayedRewards/maxReward*100,100);
  rewardBarEl.style.width = fillPercent+"%";
}

// ---------- Price Bar Divisa ----------
function updatePriceBar(current){
  const center = price24hOpen;
  const leftPercent = center>current ? ((center-current)/(center-price24hMin))*50 : 0;
  const rightPercent = current>center ? ((current-center)/(price24hMax-center))*50 : 0;
  priceBarLeft.style.width = leftPercent+"%";
  priceBarRight.style.width = rightPercent+"%";
}

// ---------- Animate ----------
const available = document.getElementById("available");
const availableUsd = document.getElementById("availableUsd");
const stake = document.getElementById("stake");
const stakeUsd = document.getElementById("stakeUsd");
const rewards = document.getElementById("rewards");
const rewardsUsd = document.getElementById("rewardsUsd");
const aprEl = document.getElementById("apr");
const updated = document.getElementById("updated");

function animate(){
  // Price
  const prevP = displayedPrice;
  displayedPrice+=(targetPrice-displayedPrice)*0.1;
  updateNumber(price,prevP,displayedPrice,4);
  price24hEl.innerText=(displayedPrice-price24hOpen>0?"+":"")+((displayedPrice-price24hOpen)/price24hOpen*100).toFixed(2)+"% | "+formatUSD(displayedPrice);

  // Available
  const prevA = displayedAvailable;
  displayedAvailable+=(availableInj-displayedAvailable)*0.1;
  updateNumber(available,prevA,displayedAvailable,6);
  availableUsd.innerText=formatUSD(displayedAvailable*displayedPrice);

  // Stake
  const prevS = displayedStake;
  displayedStake+=(stakeInj-displayedStake)*0.1;
  updateNumber(stake,prevS,displayedStake,4);
  stakeUsd.innerText=formatUSD(displayedStake*displayedPrice);

  // Rewards
  displayedRewards+=(rewardsInj-displayedRewards)*0.02;
  updateNumber(rewards,displayedRewards,displayedRewards,6);
  rewardsUsd.innerText=formatUSD(displayedRewards*displayedPrice);
  updateRewardBar();

  // APR
  aprEl.innerText=apr.toFixed(2)+"%";

  // Price Bar
  updatePriceBar(displayedPrice);

  // Last update
  updated.innerText="Last Update: "+new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}
animate();
