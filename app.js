let address="";
let livePrice=0, displayPrice=0, price24hOpen=0;
let available=0, staked=0, rewards=0, apr=0, rewardRate=0;
let lastRewardUpdate=Date.now();
let chart, chartData=[];
let lastUI={ price:"", priceDeltaPerc:"", priceDeltaUSD:"", available:"", stake:"", rewards:"" };

let marketList=["BTC","ETH","BNB","SOL","KSM","DOT","LINK","AVAX","APT","SUI","MNT","UNI","ATOM","EGLD","TIA","RUNE","BANANA","ILV","TAO","HYPE","ASTER","AVNT","CAKE","PENDLE","KIMA","MET","RAY","PYTH","VIRTUAL","JUP","JTO","KMNO"];
let marketData={}, prevMarketPrices={};

// UTILS
const fetchJSON=(url,t=8000)=>Promise.race([fetch(url).then(r=>r.json()), new Promise((_,rej)=>setTimeout(()=>rej("timeout"),t))]);
const formatUSD=v=>"≈ $"+v.toFixed(2);

function createDigits(el,value){
  el.innerHTML="";
  const s=value.toFixed(el.dataset.fixed||4);
  for(let c of s){
    const w=document.createElement("span"); w.className="digit-wrapper";
    const inner=document.createElement("span"); inner.className="digit-inner neutral"; inner.innerText=c;
    w.appendChild(inner); el.appendChild(w);
  }
}

function updateNumber(el,key,newV){
  const s=newV.toFixed(el.dataset.fixed||4);
  if(!lastUI[key]){ createDigits(el,newV); lastUI[key]=s; return; }
  const children=el.querySelectorAll(".digit-inner");
  for(let i=0;i<s.length;i++){
    const old=lastUI[key][i]||"";
    if(!children[i]) continue;
    if(old<s[i]) children[i].className="digit-inner digit-up";
    else if(old>s[i]) children[i].className="digit-down";
    else children[i].className="digit-inner neutral";
    children[i].innerText=s[i];
  }
  lastUI[key]=s;
}

// ADDRESS INPUT
document.getElementById("addressInput").addEventListener("change",async e=>{
  address=e.target.value.trim();
  await loadOnchainData();
});

// ONCHAIN DATA
async function loadOnchainData(){
  if(!address) return;
  try{
    const bal=await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
    available=(bal.balances||[]).filter(b=>b.denom==="inj").reduce((s,b)=>s+Number(b.amount),0)/1e18;

    const stakeRes=await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
    staked=(stakeRes.delegation_responses||[]).reduce((s,d)=>s+Number(d.balance.amount),0)/1e18;

    const rewardsRes=await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    let r=0; rewardsRes.rewards?.forEach(rr=>rr.reward?.forEach(c=>{if(c.denom==="inj") r+=Number(c.amount);}));
    rewards=r/1e18; lastRewardUpdate=Date.now();

    const infl=await fetchJSON("https://lcd.injective.network/cosmos/mint/v1beta1/inflation");
    const pool=await fetchJSON("https://lcd.injective.network/cosmos/staking/v1beta1/pool");
    const bonded=Number(pool.pool.bonded_tokens), total=bonded+Number(pool.pool.not_bonded_tokens);
    apr=(Number(infl.inflation)/(bonded/total))*100;

    rewardRate=(staked*(apr/100))/(365*24*3600);

  }catch(e){ console.error("Onchain error:",e); }
}

// PRICE HISTORY
async function loadPriceHistory(){
  try{
    const res=await fetch("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=1h&limit=24");
    const data=await res.json();
    chartData=data.map(c=>parseFloat(c[4]));
    price24hOpen=parseFloat(data[0][1]);
  }catch(e){ console.error(e); }
}
loadPriceHistory();
setInterval(loadPriceHistory,120000);

function drawChart(){
  const ctx=document.getElementById("priceChart").getContext("2d");
  if(chart) chart.destroy();
  const color=displayPrice>=price24hOpen?"#22c55e":"#ef4444";
  chart=new Chart(ctx,{
    type:'line',
    data:{labels:chartData.map((_,i)=>i),datasets:[{data:chartData,borderColor:color,borderWidth:2,tension:0.3,fill:true,backgroundColor:color==="green"?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.1)",pointRadius:0}]},
    options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{display:false},y:{display:true}}}
  });
}

// SINGLE WS BINANCE
const allSymbols = ["injusdt", ...marketList.map(s=>s.toLowerCase()+"usdt")];
const ws = new WebSocket("wss://stream.binance.com:9443/stream?streams=" + allSymbols.map(s=>s+"@trade").join("/"));
ws.onmessage = e => {
  const msg = JSON.parse(e.data);
  const stream = msg.stream;
  const price = parseFloat(msg.data.p);

  if(stream.startsWith("injusdt")) livePrice = price;
  else {
    const sym = stream.replace("@trade","").replace("usdt","");
    const marketSym = marketList.find(s=>s.toLowerCase()===sym);
    if(!marketSym) return;
    const d=marketData[marketSym]||{};
    d.price=price; if(!d.open)d.open=price; marketData[marketSym]=d;
  }
};
ws.onclose=()=>setTimeout(()=>location.reload(),2000);

// LOOP
function loop(){
  const now=Date.now();
  const dt=(now-lastRewardUpdate)/1000;
  lastRewardUpdate=now;
  rewards+=rewardRate*dt;

  // INJ
  if(livePrice>0){
    displayPrice += (livePrice-displayPrice)*0.2;
    updateNumber(document.getElementById("price"),"price",displayPrice);

    const deltaPerc=(displayPrice-price24hOpen)/price24hOpen*100;
    const deltaUSD=displayPrice-price24hOpen;
    const percEl=document.getElementById("priceDeltaPerc");
    percEl.innerText=deltaPerc.toFixed(2)+"%";
    percEl.className="sub "+(deltaPerc>=0?"digit-up":"digit-down");
    const usdEl=document.getElementById("priceDeltaUSD");
    usdEl.innerText="≈ $"+deltaUSD.toFixed(4);
    usdEl.className="sub "+(deltaUSD>=0?"digit-up":"digit-down");
  }

  updateNumber(document.getElementById("available"),"available",available);
  updateNumber(document.getElementById("stake"),"stake",staked);
  updateNumber(document.getElementById("rewards"),"rewards",rewards);
  document.getElementById("availableUsd").innerText=formatUSD(available*displayPrice);
  document.getElementById("stakeUsd").innerText=formatUSD(staked*displayPrice);
  document.getElementById("rewardsUsd").innerText=formatUSD(rewards*displayPrice);

  document.getElementById("apr").innerText=apr.toFixed(2)+"%";
  document.getElementById("updated").innerText="Last Update: "+new Date().toLocaleTimeString();

  // MARKET TABLE
  const tbody=document.querySelector("#marketTable tbody");
  tbody.innerHTML="";
  marketList.forEach(sym=>{
    const d=marketData[sym]; if(!d) return;
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${sym}</td><td class="price-cell"></td><td class="perc-cell"></td>`;
    tbody.appendChild(tr);
    const priceCell=tr.querySelector(".price-cell");
    const percCell=tr.querySelector(".perc-cell");

    updateNumber(priceCell,"market_"+sym,d.price);
    const perc=(d.price-d.open)/d.open*100;
    percCell.innerText=perc.toFixed(2)+"%";
    percCell.className=perc>=0?"digit-up":"digit-down";

    const prev=prevMarketPrices[sym];
    if(prev && prev!==d.price){
      tr.style.transition="background 0.5s";
      tr.style.background=d.price>prev?"rgba(34,197,94,0.5)":"rgba(239,68,68,0.5)";
      setTimeout(()=>{ tr.style.background=""; },500);
    }
    prevMarketPrices[sym]=d.price;
  });

  drawChart();
  requestAnimationFrame(loop);
}
loop();

// THEME
document.getElementById("themeToggle").addEventListener("click",()=>{
  document.body.classList.toggle("light-theme");
});
