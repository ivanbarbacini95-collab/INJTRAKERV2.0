let address = localStorage.getItem("inj_address") || "";
let displayedPrice=0, targetPrice=0;
let stakeInj=0, displayedStake=0;
let rewardsInj=0, displayedRewards=0;
let availableInj=0, displayedAvailable=0;
let apr=0;
let price24hOpen=0;
let chart, chartData=[];

// ---- Utility ----
const fetchJSON = url => fetch(url).then(r=>r.json());
const formatUSD = v=>"≈ $"+v.toFixed(2);

function updateNumber(el, oldV, newV, fixed=4){
  oldV = oldV||0;
  const oldNum=parseFloat(oldV), newNum=parseFloat(newV);
  el.classList.remove("digit-up","digit-down");
  el.innerText=newNum.toFixed(fixed);
  if(newNum>oldNum) el.classList.add("digit-up");
  else if(newNum<oldNum) el.classList.add("digit-down");
}

// ---- Input indirizzo ----
const addressInput=document.getElementById("addressInput");
addressInput.value=address;
addressInput.addEventListener("change", async e=>{
  address=e.target.value.trim();
  localStorage.setItem("inj_address", address);
  await loadData();
});

// ---- Load dati principali ----
async function loadData(){
  if(!address) return;
  try{
    // Balance
    const balanceData = await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
    let injBalance=0;
    balanceData.balances?.forEach(b=>{ if(b.denom==="inj") injBalance=Number(b.amount)/1e18; });
    availableInj=injBalance;

    // Stake
    const stakeData = await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
    stakeInj = stakeData.delegation_responses?.reduce((s,d)=>s+Number(d.balance?.amount||0),0)/1e18 ||0;

    // Rewards
    const rewardsData = await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    let rewardsRaw=0;
    rewardsData.rewards?.forEach(r=>r.reward?.forEach(c=>{ if(c.denom==="inj") rewardsRaw+=Number(c.amount); }));
    rewardsInj = rewardsRaw/1e18;

    // APR
    const inflationData = await fetchJSON("https://lcd.injective.network/cosmos/mint/v1beta1/inflation");
    const poolData = await fetchJSON("https://lcd.injective.network/cosmos/staking/v1beta1/pool");
    const bonded=Number(poolData.pool.bonded_tokens);
    const total=bonded+Number(poolData.pool.not_bonded_tokens);
    apr=(inflationData.inflation/(bonded/total))*100;

  }catch(err){ console.error(err); }
}
loadData(); setInterval(loadData,60000);

// ---- Prezzo e storico ----
async function fetchPriceHistory(){
  try{
    const res=await fetch("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=1h&limit=24");
    const data=await res.json();
    chartData=data.map(c=>parseFloat(c[4]));
    price24hOpen=parseFloat(data[0][1]);
    targetPrice=chartData[chartData.length-1];
    drawChart();
  }catch(err){ console.error(err); }
}
fetchPriceHistory();
setInterval(fetchPriceHistory,120000);

// ---- Chart.js ----
function drawChart(){
  const ctx=document.getElementById("priceChart").getContext("2d");
  if(chart) chart.destroy();
  chart=new Chart(ctx,{
    type:'line',
    data:{labels:chartData.map((_,i)=>i), datasets:[{
      label:'INJ 24h', data:chartData,
      borderColor:'#22c55e', backgroundColor:'rgba(34,197,94,0.1)', tension:0.3,
      pointRadius:5, pointHoverRadius:7,
      pointBackgroundColor: chartData.map((p,i)=>i===chartData.length-1? targetPrice>=chartData[i-1]?'#22c55e':'#ef4444':'#22c55e')
    }]},
    options:{responsive:true, plugins:{legend:{display:false}}, scales:{x:{display:false},y:{display:true}}}
  });
}

// ---- WebSocket Binance ----
const binanceWS=new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
binanceWS.onmessage=msg=>{
  const data=JSON.parse(msg.data);
  if(data?.p) targetPrice=parseFloat(data.p);
};

// ---- Animazione ----
function animate(){
  if(targetPrice){
    const oldP=displayedPrice;
    displayedPrice += (targetPrice-displayedPrice)*0.1;
  }

  const priceEl=document.getElementById("price");
  const price24hEl=document.getElementById("price24h");
  let perc24h=0, delta24h=0;
  if(price24hOpen>0){ perc24h=(displayedPrice-price24hOpen)/price24hOpen*100; delta24h=displayedPrice-price24hOpen;}
  updateNumber(priceEl, displayedPrice, displayedPrice,4);
  price24hEl.innerText=`${perc24h.toFixed(2)}% | ${formatUSD(delta24h)}`;
  price24hEl.className=perc24h>=0?"up":"down";

  // Altri box
  displayedStake += (stakeInj-displayedStake)*0.1;
  displayedRewards += (rewardsInj-displayedRewards)*0.1;
  displayedAvailable += (availableInj-displayedAvailable)*0.1;

  updateNumber(document.getElementById("stake"), displayedStake, displayedStake,4);
  document.getElementById("stakeUsd").innerText=formatUSD(displayedStake*displayedPrice);

  updateNumber(document.getElementById("rewards"), displayedRewards, displayedRewards,6);
  document.getElementById("rewardsUsd").innerText=formatUSD(displayedRewards*displayedPrice);

  updateNumber(document.getElementById("available"), displayedAvailable, displayedAvailable,6);
  document.getElementById("availableUsd").innerText=formatUSD(displayedAvailable*displayedPrice);

  document.getElementById("apr").innerText = apr.toFixed(2)+"%";
  document.getElementById("updated").innerText="Last Update: "+new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}
animate();