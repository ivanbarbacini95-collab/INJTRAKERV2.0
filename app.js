// ----- ELEMENTI HTML -----
const price = document.getElementById("price");
const price24h = document.getElementById("price24h");
const available = document.getElementById("available");
const availableUsd = document.getElementById("availableUsd");
const stake = document.getElementById("stake");
const stakeUsd = document.getElementById("stakeUsd");
const rewards = document.getElementById("rewards");
const rewardsUsd = document.getElementById("rewardsUsd");
const dailyRewards = document.getElementById("dailyRewards");
const weeklyRewards = document.getElementById("weeklyRewards");
const aprEl = document.getElementById("apr");
const updated = document.getElementById("updated");
const rewardBar = document.getElementById("rewardBar");

// ----- STATE -----
let address = localStorage.getItem("inj_address") || "";
let displayedPrice = 0, targetPrice = 0, price24hOpen = 0;
let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;
let availableInj = 0, displayedAvailable = 0;
let apr = 0;
let chart, chartData = [];
const rewardTargets = [0.005,0.01,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1];
let reachedTargets = new Set();

// ----- UTILS -----
const fetchJSON = url => fetch(url).then(r=>r.json());
const formatUSD = v => "≈ $"+v.toFixed(2);

function updateNumber(el, oldV, newV, fixed){
  el.innerText = newV.toFixed(fixed);
  el.classList.remove("up","down");
  if(newV>oldV) el.classList.add("up");
  else if(newV<oldV) el.classList.add("down");
}

// ----- ADDRESS INPUT -----
const addressInput = document.getElementById("addressInput");
addressInput.value = address;
addressInput.onchange = e=>{
  address = e.target.value.trim();
  localStorage.setItem("inj_address", address);
  loadData();
};

// ----- LOAD DATA -----
async function loadData(){
  if(!address) return;
  try {
    const balance = await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
    const injBalance = balance.balances?.find(b=>b.denom==="inj")?.amount || "0";
    availableInj = Number(injBalance)/1e18;

    const stakeData = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
    stakeInj = stakeData.delegation_responses?.reduce((s,d)=>s+Number(d.balance.amount),0)/1e18 || 0;

    const rewardsData = await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj = rewardsData.rewards?.reduce((s,r)=>s+Number(r.reward[0]?.amount||0),0)/1e18 || 0;

    const inflation = await fetchJSON(`https://lcd.injective.network/cosmos/mint/v1beta1/inflation`);
    const pool = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/pool`);
    const totalSupply = Number(pool.pool.bonded_tokens)+Number(pool.pool.not_bonded_tokens);
    apr = (Number(inflation.inflation)*totalSupply/Number(pool.pool.bonded_tokens))*100;

  } catch(e){ console.error(e); }
}

loadData();
setInterval(loadData,60000);

// ----- PRICE HISTORY -----
async function fetchHistory(){
  const r = await fetch("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=1h&limit=24");
  const d = await r.json();
  chartData = d.map(c=>+c[4]);
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
    data:{labels:chartData.map((_,i)=>i),datasets:[{data:chartData,borderColor:"#22c55e",tension:0.3,fill:true}]},
    options:{plugins:{legend:{display:false}},scales:{x:{display:false}}}
  });
}

// ----- BINANCE WS -----
function startWS(){
  const ws = new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
  ws.onmessage = e => targetPrice = +JSON.parse(e.data).p;
  ws.onclose = ()=> setTimeout(startWS,3000);
}
startWS();

// ----- REWARD BAR -----
function updateRewardBar(){
  let pct = Math.min(displayedRewards/1*100,100);
  rewardBar.style.width = pct+"%";

  rewardTargets.forEach(t=>{
    if(displayedRewards>=t && !reachedTargets.has(t)){
      reachedTargets.add(t);
      // animazione flash semplice
      const targetEl = document.createElement("div");
      targetEl.classList.add("reward-target","reached");
      targetEl.style.left = (t*100)+"%";
      rewardBar.parentElement.appendChild(targetEl);
      setTimeout(()=>targetEl.remove(),600);

      // notifiche
      if(Notification.permission==="granted") new Notification(`Target ${t} INJ raggiunto!`);
    }
  });
}

// ----- ANIMATE -----
function animate(){
  const prevP = displayedPrice;
  displayedPrice += (targetPrice - displayedPrice)*0.1;
  updateNumber(price,prevP,displayedPrice,4);

  const prevA = displayedAvailable;
  displayedAvailable += (availableInj - displayedAvailable)*0.1;
  updateNumber(available,prevA,displayedAvailable,6);
  availableUsd.innerText = formatUSD(displayedAvailable*displayedPrice);

  const prevS = displayedStake;
  displayedStake += (stakeInj - displayedStake)*0.1;
  updateNumber(stake,prevS,displayedStake,4);
  stakeUsd.innerText = formatUSD(displayedStake*displayedPrice);

  displayedRewards += (rewardsInj - displayedRewards)*0.01;
  updateNumber(rewards,displayedRewards,displayedRewards,6);
  rewardsUsd.innerText = formatUSD(displayedRewards*displayedPrice);
  dailyRewards.innerText = (displayedStake*apr/100/365).toFixed(5)+" INJ / giorno";
  weeklyRewards.innerText = (displayedStake*apr/100/52).toFixed(5)+" INJ / settimana";

  updateRewardBar();

  aprEl.innerText = apr.toFixed(2)+"%";
  updated.innerText = "Last Update: "+new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}
animate();

// ----- NOTIFICATION PERMISSION -----
if("Notification" in window && Notification.permission!=="granted"){
  Notification.requestPermission();
}
