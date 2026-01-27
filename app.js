/********************
 * STATE
 ********************/
let address = "";
let livePrice=0, displayPrice=0, price24hOpen=0;
let available=0, staked=0, displayStaked=0;
let rewards=0, rewardRate=0, lastRewardUpdate=Date.now();
let apr=0;
let chart, chartData=[];

let lastUI = { price:"", priceDeltaPerc:"", priceDeltaUSD:"", available:"", stake:"", rewards:"" };

const marketSymbols = ["BTC","ETH","BNB","SOL","KSM","DOT","LINK","AVAX","APT","SUI",
"MNT","UNI","ATOM","EGLD","TIA","RUNE","BANANA","ILV","TAO","HYPE","ASTER","AVNT","CAKE","PENDLE","KIMA","MET","RAY","PYTH","VIRTUAL","JUP","JTO","KMNO"];

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
addrInput.addEventListener("change", async e=>{
  address=e.target.value.trim();
  await loadOnchainData();
});

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
    rewards=r/1e18; lastRewardUpdate=Date.now();

    const infl=await fetchJSON("https://lcd.injective.network/cosmos/mint/v1beta1/inflation");
    const pool=await fetchJSON("https://lcd.injective.network/cosmos/staking/v1beta1/pool");
    const bonded=Number(pool.pool.bonded_tokens), total=bonded+Number(pool.pool.not_bonded_tokens);
    apr=(Number(infl.inflation)/(bonded/total))*100;

    rewardRate=(staked*(apr/100))/(365*24*3600);

  }catch(e){ console.error("Onchain error:",e); }
}

/********************
 * PRICE HISTORY 24H + LIVE
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
  const lineColor = displayPrice>=price24hOpen ? "#22c55e" : "#ef4444";
  chart=new Chart(ctx,{
    type:'line',
    data:{labels:chartData.map((_,i)=>i), datasets:[{data:chartData,borderColor:lineColor,borderWidth:2,tension:0.3,fill:true,backgroundColor:lineColor+"22",pointRadius:0}]},
    options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{display:false},y:{display:true}}}
  });
}
loadPriceHistory();
setInterval(loadPriceHistory,120000);

/********************
 * WS INJ PRICE
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
const marketTableBody=document.querySelector("#marketTable tbody");
let marketData={};

async function initMarket(){
  for(let s of marketSymbols){
    marketData[s]={price:0, change:0};
    const tr=document.createElement("tr");
    tr.id="row-"+s;
    tr.innerHTML=`<td>${s}</td><td class="price-cell">0</td><td class="change-cell">0%</td>`;
    marketTableBody.appendChild(tr);
    updateMarket(s);
  }
}
async function updateMarket(symbol){
  try{
    // Binance
    const binanceSymbols = ["BTC","ETH","BNB","SOL","DOT","LINK","AVAX","APT","SUI","UNI","ATOM"];
    let price=0, change=0;
    if(binanceSymbols.includes(symbol)){
      const res=await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`);
      const d=await res.json();
      price=parseFloat(d.lastPrice);
      change=parseFloat(d.priceChangePercent);
    } else {
      // CoinGecko fallback
      const cgId = symbol.toLowerCase();
      const res=await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd&include_24hr_change=true`);
      const d=await res.json();
      price=d[cgId]?.usd||0;
      change=d[cgId]?.usd_24h_change||0;
    }
    const oldPrice=marketData[symbol].price;
    marketData[symbol]={price,change};
    const row=document.getElementById("row-"+symbol);
    const priceCell=row.querySelector(".price-cell");
    const changeCell=row.querySelector(".change-cell");

    // Blink effect
    if(price>oldPrice) row.classList.add("blink-up");
    else if(price<oldPrice) row.classList.add("blink-down");
    setTimeout(()=>{row.classList.remove("blink-up","blink-down");},500);

    priceCell.innerText=price.toFixed(4);
    changeCell.innerText=change.toFixed(2)+"%";
    changeCell.className="change-cell "+(change>=0?"digit-up":"digit-down");

  }catch(e){ console.error("Market update error",symbol,e);}
  setTimeout(()=>updateMarket(symbol), 2000);
}
initMarket();

/********************
 * LOOP ANIMATION
 ********************/
function loop(){
  const now=Date.now();
  const dt=(now-lastRewardUpdate)/1000;
  lastRewardUpdate=now;
  rewards+=rewardRate*dt;

  // PRICE
  if(livePrice>0){
    displayPrice += (livePrice-displayPrice)*0.2;
    updateDigits(document.getElementById("price"),"price",displayPrice);

    if(price24hOpen>0){
      const deltaPerc = (displayPrice-price24hOpen)/price24hOpen*100;
      const deltaUSD = displayPrice-price24hOpen;

      document.getElementById("priceDeltaPerc").innerText = deltaPerc.toFixed(2) + "%";
      document.getElementById("priceDeltaPerc").className = "sub " + (deltaPerc>=0?"digit-up":"digit-down");

      document.getElementById("priceDeltaUSD").innerText = "≈ $" + deltaUSD.toFixed(4);
      document.getElementById("priceDeltaUSD").className = "sub " + (deltaUSD>=0?"digit-up":"digit-down");
    }
  }

  displayStaked += (staked-displayStaked)*0.2;
  updateDigits(document.getElementById("stake"),"stake",displayStaked);
  updateDigits(document.getElementById("available"),"available",available);
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
 * ONCHAIN + PRICE AUTO UPDATE
 ********************/
setInterval(loadOnchainData,60000);
