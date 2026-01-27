let address = localStorage.getItem("inj_address") || "";

let displayedPrice = 0, targetPrice = 0, price24hOpen = 0;
let availableInj = 0, displayedAvailable = 0;
let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;
let apr = 0;
let chart, chartData = [];
const maxReward = 0.05;

/* ELEMENTS */
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

/* ADDRESS */
addressInput.value = address;
addressInput.onchange = e => {
  address = e.target.value.trim();
  localStorage.setItem("inj_address", address);
  loadData();
};

/* UTILS */
const fetchJSON = url => fetch(url).then(r => r.json());
const formatUSD = v => "≈ $" + v.toFixed(2);

/* COLOR CONTROL */
const lastValue = {};

function updateNumber(el, newV, fixed, key) {
  el.innerText = newV.toFixed(fixed);

  if (lastValue[key] !== undefined && lastValue[key] !== newV) {
    el.classList.remove("up","down");
    el.classList.add(newV > lastValue[key] ? "up" : "down");
    setTimeout(() => el.classList.remove("up","down"), 120);
  }
  lastValue[key] = newV;
}

/* LOAD INJ DATA */
async function loadData() {
  if (!address) return;
  try {
    const b = await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
    availableInj = (b.balances?.find(x=>x.denom==="inj")?.amount || 0)/1e18;

    const s = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
    stakeInj = s.delegation_responses?.reduce((a,d)=>a+Number(d.balance.amount),0)/1e18 || 0;

    const r = await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj = r.rewards?.reduce((a,x)=>a+Number(x.reward[0]?.amount||0),0)/1e18 || 0;
  } catch(e){ console.error(e); }
}

loadData();
setInterval(loadData, 60000);

/* HISTORY 15m */
async function fetchHistory() {
  const r = await fetch("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=15m&limit=96");
  const d = await r.json();
  chartData = d.map(c=>+c[4]);
  price24hOpen = +d[0][1];
  targetPrice = chartData.at(-1);
  drawChart();
}
fetchHistory();

/* HD CHART */
function drawChart() {
  const canvas = document.getElementById("priceChart");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr,dpr);

  if(chart) chart.destroy();
  chart = new Chart(ctx,{
    type:"line",
    data:{labels:chartData.map((_,i)=>i),
      datasets:[{
        data:chartData,
        borderColor:"#3b82f6",
        tension:0.3,
        fill:true,
        backgroundColor:"rgba(59,130,246,0.2)"
      }]
    },
    options:{plugins:{legend:{display:false}},scales:{x:{display:false}},maintainAspectRatio:false}
  });
}

/* BINANCE WS */
const ws = new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
ws.onmessage = e => targetPrice = +JSON.parse(e.data).p;

/* ANIMATION LOOP */
function animate(){
  displayedPrice += (targetPrice - displayedPrice)*0.1;
  updateNumber(price, displayedPrice, 4, "price");

  const delta = displayedPrice - price24hOpen;
  const dp = price24hOpen ? delta/price24hOpen*100 : 0;
  price24h.innerText = `${dp.toFixed(2)}% | ${formatUSD(delta)}`;

  displayedAvailable += (availableInj - displayedAvailable)*0.1;
  updateNumber(available, displayedAvailable, 6, "available");
  updateNumber(availableUsd, displayedAvailable*displayedPrice, 2, "availableUsd");

  displayedStake += (stakeInj - displayedStake)*0.1;
  updateNumber(stake, displayedStake, 4, "stake");
  updateNumber(stakeUsd, displayedStake*displayedPrice, 2, "stakeUsd");

  displayedRewards += (rewardsInj - displayedRewards)*0.05;
  updateNumber(rewards, displayedRewards, 6, "rewards");
  updateNumber(rewardsUsd, displayedRewards*displayedPrice, 2, "rewardsUsd");

  const fill = Math.min(displayedRewards/maxReward*100,100);
  rewardBarEl.style.width = fill+"%";
  rewardBarEl.innerText = fill.toFixed(1)+"%";

  updated.innerText = "Last Update: "+new Date().toLocaleTimeString();
  requestAnimationFrame(animate);
}
animate();

