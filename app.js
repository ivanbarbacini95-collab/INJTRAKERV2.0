let address = localStorage.getItem("inj_address") || "";

let displayedPrice = 0;
let targetPrice = 0;
let price24hOpen = 0;

let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;
let availableInj = 0, displayedAvailable = 0;
let apr = 0;

let chart, chartData = [];

const rewardTargets = [0.005,0.01,0.02,0.03,0.04,0.05,0.06,0.07,0.08,0.09,0.1];
const rewardBarEl = document.getElementById("rewardBar");
let rewardMarkers = [];

// ---------- Utils ----------
const fetchJSON = url => fetch(url).then(r => r.json());
const formatUSD = v => "≈ $" + v.toFixed(2);
const formatDecimal = (v,dec=4) => v.toFixed(dec);

function updateNumber(el, oldV, newV, fixed) {
  el.innerText = formatDecimal(newV,fixed);
  if(newV>oldV) el.classList.add("up"), el.classList.remove("down");
  if(newV<oldV) el.classList.add("down"), el.classList.remove("up");
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
  if(!address) return;

  try {
    const balance = await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
    availableInj = (balance.balances?.find(b => b.denom==="inj")?.amount || 0)/1e18;

    const stake = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
    stakeInj = stake.delegation_responses?.reduce((s,d)=>s+Number(d.balance.amount),0)/1e18 || 0;

    const rewards = await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    rewardsInj = rewards.rewards?.reduce((s,r)=>s + Number(r.reward[0]?.amount||0),0)/1e18 || 0;

    const inflation = await fetchJSON(`https://lcd.injective.network/cosmos/mint/v1beta1/inflation`);
    const pool = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/pool`);
    apr = (inflation.inflation * Number(pool.pool.bonded_tokens + pool.pool.not_bonded_tokens) / pool.pool.bonded_tokens) * 100;

  } catch(e){ console.error(e); }
}

loadData();
setInterval(loadData,60000);

// ---------- Price History ----------
async function fetchHistory(){
  const r = await fetch("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=1h&limit=24");
  const d = await r.json();
  chartData = d.map(c=>+c[4]);
  price24hOpen = +d[0][1];
  targetPrice = chartData.at(-1);
  drawChart();
}
fetchHistory();

// ---------- Chart ----------
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
    options:{
      plugins:{legend:{display:false}},
      scales:{x:{display:false}}
    }
  });
}

// ---------- Binance WS ----------
function startWS(){
  const ws = new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
  ws.onmessage = e => targetPrice = +JSON.parse(e.data).p;
  ws.onclose = ()=> setTimeout(startWS,3000);
}
startWS();

// ---------- Reward Bar ----------
function initRewardMarkers(){
  const container = rewardBarEl.parentElement;
  if(rewardMarkers.length>0) return;

  rewardTargets.forEach(target=>{
    const marker = document.createElement("div");
    marker.classList.add("reward-target");
    marker.style.left = (target/rewardTargets[rewardTargets.length-1]*100)+"%";
    container.appendChild(marker);
    rewardMarkers.push({el:marker,value:target,reached:false});
  });
}

function updateRewardBar(){
  initRewardMarkers();
  let fillPercent = Math.min(displayedRewards/rewardTargets[rewardTargets.length-1]*100,100);
  rewardBarEl.style.width = fillPercent+"%";

  rewardMarkers.forEach(m=>{
    if(displayedRewards >= m.value && !m.reached){
      m.reached=true;
      m.el.classList.add("reached");
      setTimeout(()=> m.el.classList.remove("reached"),500);
    }
  });
}

// ---------- Animation ----------
function animate(){
  // PRICE
  const prevP = displayedPrice;
  displayedPrice += (targetPrice - displayedPrice)*0.1;
  updateNumber(price, prevP, displayedPrice,4);
  priceDelta.innerText = formatUSD(displayedPrice - price24hOpen);
  priceChange.innerText = ((displayedPrice - price24hOpen)/price24hOpen*100).toFixed(2) + "%";
  priceDelta.className = displayedPrice>=price24hOpen?"sub up":"sub down";
  priceChange.className = displayedPrice>=price24hOpen?"sub up":"sub down";

  // AVAILABLE
  const prevA = displayedAvailable;
  displayedAvailable += (availableInj - displayedAvailable)*0.1;
  updateNumber(available, prevA, displayedAvailable,6);
  availableUsd.innerText = formatUSD(displayedAvailable*displayedPrice);

  // STAKE
  const prevS = displayedStake;
  displayedStake += (stakeInj - displayedStake)*0.1;
  updateNumber(stake, prevS, displayedStake,4);
  stakeUsd.innerText = formatUSD(displayedStake*displayedPrice);

  // REWARDS
  const prevR = displayedRewards;
  displayedRewards += (rewardsInj - displayedRewards)*0.1;
  updateNumber(rewards, prevR, displayedRewards,6);
  rewardsUsd.innerText = formatUSD(displayedRewards*displayedPrice);

  dailyRewards.innerText = (displayedStake*apr/100/365).toFixed(5) + " INJ / giorno";
  weeklyRewards.innerText = (displayedStake*apr/100/52).toFixed(5) + " INJ / settimana";

  // APR
  aprEl.innerText = apr.toFixed(2) + "%";

  // REWARD BAR
  updateRewardBar();

  // LAST UPDATE
  updated.innerText = "Last Update: " + new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}

animate();
