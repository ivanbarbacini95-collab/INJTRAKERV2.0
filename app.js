let address = localStorage.getItem("inj_address") || "";

let targetPrice = 0, displayedPrice = 0, price24hOpen = 0;
let availableInj = 0, displayedAvailable = 0;
let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;
let apr = 0;
let high24h = 0, low24h = 0;
const MAX_REWARD = 0.05;

const priceEl = document.getElementById("price");
const priceArrowEl = document.getElementById("priceArrow");
const deltaPctEl = document.getElementById("priceDelta");
const deltaUsdEl = document.getElementById("priceDeltaUsd");
const highLowEl = document.getElementById("highLow");

const availableEl = document.getElementById("available");
const availableUsdEl = document.getElementById("availableUsd");

const stakeEl = document.getElementById("stake");
const stakeUsdEl = document.getElementById("stakeUsd");

const rewardsEl = document.getElementById("rewards");
const rewardsUsdEl = document.getElementById("rewardsUsd");
const rewardBarEl = document.getElementById("rewardBar");

const aprEl = document.getElementById("apr");
const updatedEl = document.getElementById("updated");

const priceLineEl = document.getElementById("priceLine");
const priceLowEl = document.getElementById("priceLow");
const priceHighEl = document.getElementById("priceHigh");

const addressInput = document.getElementById("addressInput");
addressInput.value = address;
addressInput.onchange = e => {
  address = e.target.value.trim();
  localStorage.setItem("inj_address", address);
  loadData();
};

const fetchJSON = u => fetch(u).then(r => r.json());

const formatUSD = v => "≈ $" + v.toFixed(2);

const last = {};
function setNumber(el, v, d, k) {
  if (last[k] !== undefined && v !== last[k]) {
    el.classList.remove("up", "down");
    el.classList.add(v > last[k] ? "up" : "down");
    setTimeout(() => el.classList.remove("up", "down"), 120);
  }
  last[k] = v;
  el.innerText = v.toFixed(d);
}

async function loadData() {
  if (!address) return;
  try {
    const b = await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
    availableInj = (b.balances?.find(x => x.denom==="inj")?.amount||0)/1e18;

    const s = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
    stakeInj = s.delegation_responses?.reduce((a,d)=>a+ +d.balance.amount,0)/1e18 ||0;

    const r = await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj = r.rewards?.reduce((a,d)=>a+ +(d.reward[0]?.amount||0),0)/1e18||0;

    const i = await fetchJSON(`https://lcd.injective.network/cosmos/mint/v1beta1/inflation`);
    const p = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/pool`);
    apr = (i.inflation*(+p.pool.bonded_tokens + +p.pool.not_bonded_tokens)/ +p.pool.bonded_tokens)*100;
  } catch(e){console.error(e);}
}
loadData();
setInterval(loadData,60000);

let chartData = [];
async function fetchHistory() {
  try {
    const r = await fetch("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=15m&limit=96");
    const d = await r.json();
    chartData = d.map(c=>+c[4]);
    price24hOpen = +d[0][1];
    high24h = Math.max(...chartData);
    low24h = Math.min(...chartData);
    priceLowEl.innerText = "$"+low24h.toFixed(2);
    priceHighEl.innerText = "$"+high24h.toFixed(2);
    targetPrice = chartData.at(-1);
    drawChart();
  } catch(e){console.error(e);}
}
fetchHistory();
setInterval(fetchHistory,900000);

let chart;
function drawChart(){
  if(chart) chart.destroy();
  chart=new Chart(document.getElementById("priceChart"),{
    type:"line",
    data:{labels:chartData.map((_,i)=>i),datasets:[{data:chartData,borderColor:"#3b82f6",backgroundColor:"rgba(59,130,246,0.2)",tension:0.3,fill:true}]},
    options:{plugins:{legend:{display:false}},scales:{x:{display:false}}}
  });
}

const ws = new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
ws.onmessage = e=>targetPrice = +JSON.parse(e.data).p;
ws.onclose = ()=>setTimeout(()=>startWS(),3000);

function updatePriceBar(){
  const min = low24h || price24hOpen;
  const max = high24h || price24hOpen;
  const percent = ((displayedPrice - min)/(max-min))*100;
  priceLineEl.style.left = percent+"%";
  if(displayedPrice>price24hOpen) priceLineEl.style.background="#22c55e";
  else if(displayedPrice<price24hOpen) priceLineEl.style.background="#ef4444";
  else priceLineEl.style.background="#f9fafb";
}

function animate(){
  displayedPrice+=(targetPrice-displayedPrice)*0.1;
  setNumber(priceEl,displayedPrice,4,"price");

  const delta=displayedPrice-price24hOpen;
  const pct=price24hOpen? delta/price24hOpen*100:0;
  deltaPctEl.classList.remove("up","down","neutral");
  if(pct>0.01){ deltaPctEl.classList.add("up"); priceArrowEl.innerText="▲"; }
  else if(pct<-0.01){ deltaPctEl.classList.add("down"); priceArrowEl.innerText="▼"; }
  else { deltaPctEl.classList.add("neutral"); priceArrowEl.innerText="▬"; }
  deltaPctEl.innerText=pct.toFixed(2)+"%";
  deltaUsdEl.innerText=formatUSD(delta);

  displayedAvailable+=(availableInj-displayedAvailable)*0.1;
  setNumber(availableEl,displayedAvailable,6,"avail");
  setNumber(availableUsdEl,displayedAvailable*displayedPrice,2,"availUsd");

  displayedStake+=(stakeInj-displayedStake)*0.1;
  setNumber(stakeEl,displayedStake,4,"stake");
  setNumber(stakeUsdEl,displayedStake*displayedPrice,2,"stakeUsd");

  displayedRewards+=(rewardsInj-displayedRewards)*0.05;
  setNumber(rewardsEl,displayedRewards,6,"rew");
  setNumber(rewardsUsdEl,displayedRewards*displayedPrice,2,"rewUsd");

  rewardBarEl.style.width=Math.min(displayedRewards/MAX_REWARD*100,100)+"%";
  rewardBarEl.innerText=(displayedRewards/MAX_REWARD*100).toFixed(1)+"%";

  aprEl.innerText=apr.toFixed(2)+"%";

  updatedEl.innerText="Last Update: "+new Date().toLocaleTimeString();

  updatePriceBar();

  requestAnimationFrame(animate);
}
animate();
