let address = localStorage.getItem("inj_address") || "";

// Variabili
let displayedPrice = 0, targetPrice = 0, price24hOpen = 0;
let price24hLow = 0, price24hHigh = 0;
let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;
let availableInj = 0, displayedAvailable = 0;
let apr = 0;

let chart, chartData = [];
const rewardTargetsArray = [0.005,0.01,0.02,0.03,0.04,0.05];
const rewardMax = 0.05;

// Elementi DOM
const addressInput = document.getElementById("addressInput");
const priceEl = document.getElementById("price");
const price24hEl = document.getElementById("price24h");
const priceBarEl = document.getElementById("priceBar");
const priceLineOpenEl = document.getElementById("priceLineOpen");
const priceMinEl = document.getElementById("priceMin");
const priceMaxEl = document.getElementById("priceMax");
const priceOpenEl = document.getElementById("priceOpen");

const availableEl = document.getElementById("available");
const availableUsdEl = document.getElementById("availableUsd");

const stakeEl = document.getElementById("stake");
const stakeUsdEl = document.getElementById("stakeUsd");

const rewardsEl = document.getElementById("rewards");
const rewardsUsdEl = document.getElementById("rewardsUsd");
const rewardBarEl = document.getElementById("rewardBar");
const rewardPercentEl = document.getElementById("rewardPercent");

const aprEl = document.getElementById("apr");
const updatedEl = document.getElementById("updated");

// Funzioni helper
const fetchJSON = async url => {
  try {
    const res = await fetch(url);
    return await res.json();
  } catch(e){
    console.error("Fetch error:", url, e);
    return {};
  }
};

function updateNumber(el, oldV, newV, fixed){
  el.innerText = newV.toFixed(fixed);
  if(newV>oldV) el.classList.add("up");
  else if(newV<oldV) el.classList.add("down");
  setTimeout(()=>el.classList.remove("up","down"),500);
}

// ---------- Input indirizzo ----------
addressInput.value = address;
addressInput.onchange = e => {
  address = e.target.value.trim();
  localStorage.setItem("inj_address", address);
  loadData();
};

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

    console.log("Dati caricati:", {availableInj, stakeInj, rewardsInj, apr});
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

// ---------- Animate ----------
function animate(){
  // ---- Price ----
  const prevP = displayedPrice;
  displayedPrice += (targetPrice-displayedPrice)*0.1;
  updateNumber(priceEl, prevP, displayedPrice, 4);

  // Delta %
  const delta = ((displayedPrice-price24hOpen)/price24hOpen)*100;
  price24hEl.innerText = (delta>0?"▲ ":"▼ ") + Math.abs(delta).toFixed(2) + "%";
  price24hEl.className = "sub " + (delta>0?"up":delta<0?"down":"");

  // Price bar
  const minVal = price24hLow, maxVal = price24hHigh, range = maxVal-minVal||1;
  const leftPercent = (displayedPrice-price24hOpen)/range*100 + 50; // apertura al centro
  priceBarEl.style.left = leftPercent >= 50 ? "50%" : leftPercent+"%";
  priceBarEl.style.width = Math.abs(leftPercent-50)+"%";
  priceBarEl.style.background = displayedPrice>=price24hOpen?"#22c55e":"#ef4444";

  // Min / Open / Max
  updateNumber(priceMinEl, Number(priceMinEl.innerText), price24hLow, 4);
  updateNumber(priceMaxEl, Number(priceMaxEl.innerText), price24hHigh, 4);
  updateNumber(priceOpenEl, Number(priceOpenEl.innerText), price24hOpen, 4);

  // ---- Available ----
  const prevA = displayedAvailable;
  displayedAvailable += (availableInj-displayedAvailable)*0.1;
  updateNumber(availableEl, prevA, displayedAvailable, 6);
  updateNumber(availableUsdEl, prevA*displayedPrice, displayedAvailable*displayedPrice, 2);

  // ---- Stake ----
  const prevS = displayedStake;
  displayedStake += (stakeInj-displayedStake)*0.1;
  updateNumber(stakeEl, prevS, displayedStake, 4);
  updateNumber(stakeUsdEl, prevS*displayedPrice, displayedStake*displayedPrice, 2);

  // ---- Rewards ----
  const prevR = displayedRewards;
  displayedRewards += (rewardsInj-displayedRewards)*0.05;

  if(displayedRewards>prevR){
    rewardsEl.classList.add("up");
    rewardsUsdEl.classList.add("up");
  } else if(displayedRewards<prevR){
    rewardsEl.classList.add("down");
    rewardsUsdEl.classList.add("down");
  }

  rewardsEl.innerText = displayedRewards.toFixed(6);
  rewardsUsdEl.innerText = (displayedRewards*displayedPrice).toFixed(2);

  setTimeout(()=>{
    rewardsEl.classList.remove("up","down");
    rewardsUsdEl.classList.remove("up","down");
  },600);

  // Barra reward
  const rewardPercent = Math.min(displayedRewards/rewardMax*100,100);
  rewardBarEl.style.width = rewardPercent+"%";
  rewardPercentEl.innerText = rewardPercent.toFixed(1)+"%";

  // ---- APR ----
  aprEl.innerText = apr.toFixed(2)+"%";

  // ---- Last Update ----
  updatedEl.innerText = "Last Update: " + new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}
animate();

// ---------- Aggiorna rewards ogni 3 secondi ----------
setInterval(async ()=>{
  if(!address) return;
  try{
    const rewardsRes = await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj = rewardsRes.rewards?.reduce((sum,r)=>sum+Number(r.reward[0]?.amount||0),0)/1e18||0;
  } catch(e){ console.error("Errore aggiornamento rewards:", e); }
},3000);
