let address = localStorage.getItem("inj_address") || "";

let displayedPrice = 0;
let targetPrice = 0;
let price24hOpen = 0;
let price24hLow = 0, price24hHigh = 0;

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
  if (newV > oldV) el.classList.add("up");
  else if (newV < oldV) el.classList.add("down");
  setTimeout(()=>el.classList.remove("up","down"), 500);
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
    apr = (inflation.inflation * (Number(pool.pool.bonded_tokens) + Number(pool.pool.not_bonded_tokens)) / Number(pool.pool.bonded_tokens)) * 100;

  } catch (e) { console.error(e); }
}
loadData();

// ---------- Fetch price 24h ----------
async function fetchHistory() {
  const r = await fetch("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=15m&limit=96");
  const d = await r.json();
  chartData = d.map(c=>+c[4]);
  price24hOpen = +d[0][1];
  price24hLow = Math.min(...chartData);
  price24hHigh = Math.max(...chartData);
  targetPrice = chartData.at(-1);
  drawChart();
}
fetchHistory();

// ---------- Draw chart ----------
function drawChart() {
  const ctx = document.getElementById("priceChart");
  if (chart) chart.destroy();
  chart = new Chart(ctx,{
    type:"line",
    data:{labels:chartData.map((_,i)=>i), datasets:[{data:chartData,borderColor:"#22c55e",tension:0.3,fill:true}]},
    options:{plugins:{legend:{display:false}},scales:{x:{display:false}}}
  });
}

// ---------- Binance WS ----------
function startWS() {
  const ws = new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
  ws.onmessage = e => {
    const p = +JSON.parse(e.data).p;
    targetPrice = p;
    if(p>price24hHigh) price24hHigh=p;
    if(p<price24hLow) price24hLow=p;
  };
  ws.onclose = ()=>setTimeout(startWS,3000);
}
startWS();

// ---------- Reward bar ----------
const rewardBarEl = document.getElementById("rewardBar");
const rewardTargetsEl = document.getElementById("rewardTargets");

function updateRewardBar() {
  const maxReward = Math.max(rewardsInj, rewardTargetsArray[rewardTargetsArray.length-1]);
  const fillPercent = Math.min(displayedRewards/maxReward*100,100);
  rewardBarEl.style.width = fillPercent+"%";
  rewardTargetsEl.innerHTML="";
  rewardTargetsArray.forEach(t=>{
    const span = document.createElement("span");
    span.style.left = (t/maxReward*100)+"%";
    span.innerText = t;
    rewardTargetsEl.appendChild(span);
  });
}

// ---------- Price bar ----------
const priceBarEl = document.getElementById("priceBar");
const priceLineOpenEl = document.getElementById("priceLineOpen");
const priceMinEl = document.getElementById("priceMin");
const priceMaxEl = document.getElementById("priceMax");

// ---------- Animate numbers & bars ----------
function animate() {
  // Price
  const prevP = displayedPrice;
  displayedPrice += (targetPrice-displayedPrice)*0.1;
  updateNumber(price, prevP, displayedPrice,4);

  // Delta %
  const delta = ((displayedPrice-price24hOpen)/price24hOpen)*100;
  const deltaText = (delta>0? "▲ ":"▼ ")+Math.abs(delta).toFixed(2)+"%";
  price24h.innerText = deltaText;
  price24h.className="sub "+(delta>0?"up":delta<0?"down":"");

  // Price bar
  const barWidth=200; // px
  const minVal=price24hLow, maxVal=price24hHigh;
  const range=maxVal-minVal||1;
  const leftPercent=(displayedPrice-minVal)/range*100;
  priceBarEl.style.width=leftPercent+"%";
  priceBarEl.style.background=delta>=0?"#22c55e":"#ef4444";
  priceLineOpenEl.style.left=((price24hOpen-minVal)/range*100)+"%";
  priceMinEl.innerText=minVal.toFixed(4);
  priceMaxEl.innerText=maxVal.toFixed(4);

  // Available
  const prevA=displayedAvailable;
  displayedAvailable += (availableInj-displayedAvailable)*0.1;
  updateNumber(available, prevA, displayedAvailable,6);
  updateNumber(availableUsd, prevA*displayedPrice, displayedAvailable*displayedPrice,2);

  // Stake
  const prevS=displayedStake;
  displayedStake += (stakeInj-displayedStake)*0.1;
  updateNumber(stake, prevS, displayedStake,4);
  updateNumber(stakeUsd, prevS*displayedPrice, displayedStake*displayedPrice,2);

  // Rewards
  displayedRewards += (rewardsInj-displayedRewards)*0.05;
  updateNumber(rewards, displayedRewards, displayedRewards,6);
  updateNumber(rewardsUsd, displayedRewards*displayedPrice, displayedRewards*displayedPrice,2);
  updateRewardBar();

  // APR
  aprEl.innerText=apr.toFixed(2)+"%";

  // Last update
  updated.innerText="Last Update: "+new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}
animate();

// ---------- Update rewards every 3 sec ----------
setInterval(async()=>{
  if(!address) return;
  try{
    const rewards = await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj = rewards.rewards?.reduce((s,r)=>s+Number(r.reward[0]?.amount||0),0)/1e18||0;
  }catch(e){console.error(e);}
},3000);
