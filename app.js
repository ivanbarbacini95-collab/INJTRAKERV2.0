let address = localStorage.getItem("inj_address") || "";
let livePrice=0, targetPrice=0;
let available=0, staked=0, rewards=0;
let displayPrice=0, displayAvailable=0, displayStaked=0, displayRewards=0;
let apr=0;
let price24hOpen=0;
let chart, chartData=[];

const lastUI={price:"",available:"",stake:"",rewards:""};

// UTIL
const formatUSD=v=>"≈ $"+v.toFixed(2);
const fetchJSON=(url,t=8000)=>Promise.race([fetch(url).then(r=>r.json()),new Promise((_,rej)=>setTimeout(()=>rej("timeout"),t))]);

function createDigits(el,value){
  el.innerHTML="";
  const s=value.toFixed(el.dataset.fixed||4);
  for(let c of s){
    const w=document.createElement("span"); w.className="digit-wrapper";
    const inner=document.createElement("span"); inner.className="digit-inner neutral"; inner.innerText=c;
    w.appendChild(inner); el.appendChild(w);
  }
  lastUI[el.id]=s;
}

function updateDigits(el,value){
  if(value===undefined || isNaN(value)) return;
  const s=value.toFixed(el.dataset.fixed||4);
  const children=el.querySelectorAll(".digit-inner");
  if(children.length===0) return createDigits(el,value);
  for(let i=0;i<s.length;i++){
    const oldChar=children[i]?.innerText||"0";
    if(oldChar<s[i]) children[i].className="digit-inner digit-up";
    else if(oldChar>s[i]) children[i].className="digit-inner digit-down";
    else children[i].className="digit-inner neutral";
    if(children[i]) children[i].innerText=s[i];
  }
}

// THEME
document.getElementById("themeToggle").addEventListener("click",()=>document.body.classList.toggle("light"));

// ADDRESS
const addrInput=document.getElementById("addressInput");
addrInput.value=address;
addrInput.addEventListener("change",async e=>{
  address=e.target.value.trim();
  localStorage.setItem("inj_address",address);
  await loadOnchainData();
});

// ONCHAIN DATA
async function loadOnchainData(){
  if(!address) return;
  try{
    // BALANCE
    const bal=await fetchJSON(`https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`);
    available=(bal.balances||[]).find(b=>b.denom==="inj")?.amount/1e18 || 0;

    // STAKED
    const stakeRes=await fetchJSON(`https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`);
    staked=(stakeRes.delegation_responses||[]).reduce((s,d)=>s+Number(d.balance.amount),0)/1e18;

    // REWARDS
    const rewardsRes=await fetchJSON(`https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`);
    let r=0;
    rewardsRes.rewards?.forEach(rr=>rr.reward?.forEach(c=>{if(c.denom==="inj") r+=Number(c.amount)}));
    rewards=r/1e18;

    // APR
    const infl=await fetchJSON("https://lcd.injective.network/cosmos/mint/v1beta1/inflation");
    const pool=await fetchJSON("https://lcd.injective.network/cosmos/staking/v1beta1/pool");
    const bonded=Number(pool.pool.bonded_tokens), total=bonded+Number(pool.pool.not_bonded_tokens);
    apr=(Number(infl.inflation)/(bonded/total))*100;

    // Aggiorna subito i box con i valori iniziali
    displayAvailable = available;
    displayStaked = staked;
    displayRewards = rewards;
    updateDigits(document.getElementById("available"), displayAvailable);
    updateDigits(document.getElementById("stake"), displayStaked);
    updateDigits(document.getElementById("rewards"), displayRewards);
    document.getElementById("availableUsd").innerText=formatUSD(displayAvailable*displayPrice);
    document.getElementById("stakeUsd").innerText=formatUSD(displayStaked*displayPrice);
    document.getElementById("rewardsUsd").innerText=formatUSD(displayRewards*displayPrice);
    document.getElementById("apr").innerText=apr.toFixed(2)+"%";

  }catch(e){
    console.error("Errore dati on-chain:",e);
  }
}

// PRICE HISTORY
async function loadPriceHistory(){
  try{
    const res=await fetch("https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=1h&limit=24");
    const data=await res.json();
    chartData=data.map(c=>parseFloat(c[4]));
    price24hOpen=parseFloat(data[0][1]);
    drawChart();
  }catch(e){console.error(e);}
}
function drawChart(){
  const ctx=document.getElementById("priceChart").getContext("2d");
  if(chart) chart.destroy();
  const color=displayPrice>=price24hOpen?"#22c55e":"#ef4444";
  chart=new Chart(ctx,{
    type:'line',
    data:{labels:chartData.map((_,i)=>i), datasets:[{data:chartData,borderColor:color,borderWidth:2,tension:0.3,fill:true,backgroundColor:"rgba(34,197,94,0.1)",pointRadius:0}]},
    options:{responsive:true,plugins:{legend:{display:false}},scales:{x:{display:false},y:{display:true}}}
  });
}
loadPriceHistory();
setInterval(loadPriceHistory,10000);

// LIVE PRICE
async function loadInitialPrice(){
  try{
    const res=await fetch("https://api.binance.com/api/v3/ticker/price?symbol=INJUSDT");
    const data=await res.json();
    livePrice=targetPrice=parseFloat(data.price);
    displayPrice=targetPrice;
    createDigits(document.getElementById("price"), displayPrice);
  }catch(e){console.error(e);}
}
loadInitialPrice();

let ws=new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
ws.onmessage=msg=>{ targetPrice=parseFloat(JSON.parse(msg.data).p); };
ws.onclose=()=>setTimeout(()=>{ ws=new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade"); },2000);

// LOOP
function loop(){
  displayPrice += (targetPrice-displayPrice)*0.3;
  displayAvailable += (available-displayAvailable)*0.2;
  displayStaked += (staked-displayStaked)*0.2;
  displayRewards += (rewards-displayRewards)*0.2;

  updateDigits(document.getElementById("price"), displayPrice);
  updateDigits(document.getElementById("available"), displayAvailable);
  updateDigits(document.getElementById("stake"), displayStaked);
  updateDigits(document.getElementById("rewards"), displayRewards);

  // Price delta
  if(price24hOpen>0){
    const deltaPerc=(displayPrice-price24hOpen)/price24hOpen*100;
    const deltaUSD=displayPrice-price24hOpen;
    const percEl=document.getElementById("priceDeltaPerc");
    const usdEl=document.getElementById("priceDeltaUSD");
    percEl.innerText=deltaPerc.toFixed(2)+"%";
    percEl.className="sub "+(deltaPerc>=0?"digit-up":"digit-down");
    usdEl.innerText="≈ $"+deltaUSD.toFixed(4);
    usdEl.className="sub "+(deltaUSD>=0?"digit-up":"digit-down");
  }

  document.getElementById("availableUsd").innerText=formatUSD(displayAvailable*displayPrice);
  document.getElementById("stakeUsd").innerText=formatUSD(displayStaked*displayPrice);
  document.getElementById("rewardsUsd").innerText=formatUSD(displayRewards*displayPrice);
  document.getElementById("updated").innerText="Last Update: "+new Date().toLocaleTimeString();

  requestAnimationFrame(loop);
}
loop();

// Inizializza dati on-chain se già presente indirizzo
if(address) loadOnchainData();
setInterval(loadOnchainData,10000);
