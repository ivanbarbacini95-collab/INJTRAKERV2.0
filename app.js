/********************
 * STATE
 ********************/
let address = localStorage.getItem("inj_address") || "";

let livePrice=0, displayPrice=0, price24hOpen=0;
let available=0, staked=0, displayStaked=0;
let rewards=0, rewardRate=0;
let apr=0;
let chart, chartData=[];
let marketList = ["BTC","ETH","BNB","SOL","KSM","DOT","LINK","AVAX","APT","SUI","MNT","UNI","ATOM","EGLD","TIA","RUNE","BANANA","ILV","TAO","HYPE","ASTER","AVNT","CAKE","PENDLE","KIMA","MET","RAY","PYTH","VIRTUAL","JUP","JTO","KMNO"];

let lastUI = { price:"", priceDeltaPerc:"", priceDeltaUSD:"", available:"", stake:"", rewards:"" };
let lastMarketPrices = {};

/********************
 * UTILS
 ********************/
const fetchJSON = (url, timeout=8000) =>
  Promise.race([fetch(url).then(r=>r.json()), new Promise((_,rej)=>setTimeout(()=>rej("timeout"), timeout))]);

const formatUSD = v=>"≈ $"+v.toFixed(2);

function createDigits(el, value) {
  el.innerHTML="";
  const s=value.toFixed(el.dataset.fixed||4);
  for(let c of s){
    const w=document.createElement("span"); w.className="digit-wrapper";
    const inner=document.createElement("span"); inner.className="digit-inner neutral"; inner.innerText=c;
    w.appendChild(inner); el.appendChild(w);
  }
}

function updateDigits(el,key,newV){
  const s=newV.toFixed(el.dataset.fixed||4);
  if(!lastUI[key]) { createDigits(el,newV); lastUI[key]=s; return; }
  const children=el.querySelectorAll(".digit-inner");
  for(let i=0;i<s.length;i++){
    const oldChar=lastUI[key][i]||"";
    if(!children[i]) continue;
    if(oldChar<s[i]) children[i].className="digit-inner digit-up";
    else if(oldChar>s[i]) children[i].className="digit-down";
    else children[i].className="digit-inner neutral";
    children[i].innerText=s[i];
  }
  lastUI[key]=s;
}

/********************
 * THEME TOGGLE
 ********************/
document.getElementById("themeToggle").addEventListener("click",()=>{
  document.body.classList.toggle("light");
});

/********************
 * ADDRESS INPUT
 ********************/
const addrInput=document.getElementById("addressInput");
addrInput.value=address;
addrInput.addEventListener("change", async e=>{
  address=e.target.value.trim();
  localStorage.setItem("inj_address", address);
  await loadOnchainData();
  resetDisplayValues();
});

function resetDisplayValues(){
  displayStaked=0; rewards=0; displayPrice=0;
}

/********************
 * ONCHAIN DATA
 ********************/
async function loadOnchainData(){
  if(!address) return;
  try{
    const bal=await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
    available=(bal.balances||[]).filter(b=>b.denom==="inj").reduce((s,b)=>s+Number(b.amount),0)/1e18;

    const stakeRes=await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
    staked=(stakeRes.delegation_responses||[]).reduce((s,d)=>s+Number(d.balance.amount),0)/1e18;

    const rewardsRes=await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    let r=0; rewardsRes.rewards?.forEach(rr=>rr.reward?.forEach(c=>{if(c.denom==="inj") r+=Number(c.amount);}));
    rewards=r/1e18;

    const infl=await fetchJSON("https://lcd.injective.network/cosmos/mint/v1beta1/inflation");
    const pool=await fetchJSON("https://lcd.injective.network/cosmos/staking/v1beta1/pool");
    const bonded=Number(pool.pool.bonded_tokens), total=bonded+Number(pool.pool.not_bonded_tokens);
    apr=(Number(infl.inflation)/(bonded/total))*100;

    rewardRate=(staked*(apr/100))/(365*24*3600);

  }catch(e){ console.error("Onchain error:",e); }
}
loadOnchainData();

/********************
 * PRICE HISTORY 24H
 ********************/
async function loadPriceHistory(){
  try{
    const res=await fetch("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=1h&limit=24");
    const data=await res.json();
    chartData=data.map(c=>parseFloat(c[4]));
    price24hOpen=parseFloat(data[0][1]);
    drawChart();
  }catch(e){ console.error("Price history error:",e); }
}
function drawChart(){
  const ctx=document.getElementById("priceChart").getContext("2d");
  if(chart) chart.destroy();
  const color = displayPrice >= price24hOpen ? "#22c55e" : "#ef4444";
  chart=new Chart(ctx,{
    type:'line',
    data:{labels:chartData.map((_,i)=>i), datasets:[{data:chartData,borderColor:color,borderWidth:2,tension:0.3,fill:true,backgroundColor:color+"33",pointRadius:0}]},
    options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{display:false},y:{display:true}}}
  });
}
loadPriceHistory();
setInterval(loadPriceHistory,120000);

/********************
 * LIVE PRICE WS
 ********************/
function connectWS(){
  const ws=new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
  ws.onmessage=msg=>{
    const data=JSON.parse(msg.data);
    livePrice=parseFloat(data.p);
    if(displayPrice===0) displayPrice=livePrice;
  };
  ws.onclose=()=>setTimeout(connectWS,2000);
}
connectWS();

/********************
 * MARKET TABLE
 ********************/
async function updateMarket(){
  const tbody=document.querySelector("#marketTable tbody");
  for(let coin of marketList){
    try{
      const res=await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin.toLowerCase()}&vs_currencies=usd&include_24hr_change=true`);
      const data=await res.json();
      const price=data[coin.toLowerCase()]?.usd || 0;
      const delta=data[coin.toLowerCase()]?.usd_24h_change || 0;

      let row=tbody.querySelector(`tr[data-coin="${coin}"]`);
      if(!row){
        row=document.createElement("tr"); row.dataset.coin=coin;
        row.innerHTML=`<td>${coin}</td><td class="price"></td><td class="delta"></td>`;
        tbody.appendChild(row);
      }

      // Animazione prezzo
      const priceEl=row.querySelector(".price");
      const oldPrice=lastMarketPrices[coin]||0;
      priceEl.innerText="$"+price.toFixed(4);

      // Delta %
      const deltaEl=row.querySelector(".delta");
      deltaEl.innerText=delta.toFixed(2)+"%";
      deltaEl.style.color=delta>=0?"#22c55e":"#ef4444";

      // Riga lampeggiante se prezzo cambia
      if(oldPrice && oldPrice!==price){
        row.classList.remove("price-up","price-down");
        row.classList.add(price>oldPrice?"price-up":"price-down");
      }

      lastMarketPrices[coin]=price;

    }catch(e){ console.error("Market update error:",e); }
  }
}
updateMarket();
setInterval(updateMarket,5000);

/********************
 * LOOP ANIMATION
 ********************/
function loop(){
  const dt=0.1;

  // PRICE
  if(livePrice>0){
    displayPrice += (livePrice-displayPrice)*0.2;
    updateDigits(document.getElementById("price"),"price",displayPrice);

    if(price24hOpen>0){
      const deltaPerc = (displayPrice-price24hOpen)/price24hOpen*100;
      const deltaUSD = displayPrice-price24hOpen;

      const percEl = document.getElementById("priceDeltaPerc");
      percEl.innerText = deltaPerc.toFixed(2)+"%";
      percEl.className = "sub " + (deltaPerc>=0?"digit-up":"digit-down");

      const usdEl = document.getElementById("priceDeltaUSD");
      usdEl.innerText = "≈ $"+deltaUSD.toFixed(4);
      usdEl.className = "sub " + (deltaUSD>=0?"digit-up":"digit-down");
    }

    // Aggiorna colore grafico
    if(chart){
      const color = displayPrice >= price24hOpen ? "#22c55e" : "#ef4444";
      chart.data.datasets[0].borderColor=color;
      chart.data.datasets[0].backgroundColor=color+"33";
      chart.update("none");
    }
  }

  // STAKED / AVAILABLE / REWARDS
  displayStaked += (staked-displayStaked)*0.2;
  updateDigits(document.getElementById("stake"),"stake",displayStaked);
  updateDigits(document.getElementById("available"),"available",available);
  rewards += rewardRate*dt;
  updateDigits(document.getElementById("rewards"),"rewards",rewards);

  document.getElementById("availableUsd").innerText=formatUSD(available*displayPrice);
  document.getElementById("stakeUsd").innerText=formatUSD(displayStaked*displayPrice);
  document.getElementById("rewardsUsd").innerText=formatUSD(rewards*displayPrice);

  document.getElementById("apr").innerText=apr.toFixed(2)+"%";
  document.getElementById("updated").innerText="Last Update: "+new Date().toLocaleTimeString();

  requestAnimationFrame(loop);
}
loop();

/********************
 * REFRESH ONCHAIN DATA
 ********************/
setInterval(loadOnchainData,60000);
