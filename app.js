/********************
 * STATE
 ********************/
let address = localStorage.getItem("inj_address") || "";

let livePrice = 0, displayPrice = 0, price24hOpen = 0;
let available = 0, staked = 0, displayStaked = 0;
let rewards = 0, rewardRate = 0, lastRewardUpdate = Date.now();
let apr = 0;

let chart, chartData = [];
let lastUI = {};
let marketUI = {};

/********************
 * MARKET LIST (RIPULITA)
 ********************/
const marketSymbols = [
  "INJ","BTC","ETH","BNB","SOL","KSM","DOT","LINK","AVAX","APT","SUI",
  "MNT","UNI","ATOM","EGLD","TIA","RUNE","BANANA","ILV","TAO",
  "ASTER","AVNT","CAKE","PENDLE","KIMA","MET","RAY","PYTH","VIRTUAL",
  "JUP","JTO","KMNO"
];

const marketList = marketSymbols.map(s => ({
  symbol: s,
  price: 0,
  displayPrice: 0,
  change24h: 0
}));

const coingeckoMap = {
  BANANA: "banana-gun",
  ASTER: "aster",
  AVNT: "aventure",
  KIMA: "kima-network",
  VIRTUAL: "virtual-protocol"
};

/********************
 * UTILS
 ********************/
const fetchJSON = url => fetch(url).then(r => r.json());
const formatUSD = v => "≈ $" + v.toFixed(2);

function createDigits(el, v) {
  el.innerHTML = "";
  const s = v.toFixed(el.dataset.fixed || 4);
  for (let c of s) {
    const w = document.createElement("span");
    w.className = "digit-wrapper";
    const i = document.createElement("span");
    i.className = "digit-inner neutral";
    i.innerText = c;
    w.appendChild(i);
    el.appendChild(w);
  }
}

function updateDigits(el, key, v) {
  const s = v.toFixed(el.dataset.fixed || 4);
  if (!lastUI[key]) {
    createDigits(el, v);
    lastUI[key] = s;
    return;
  }
  const d = el.querySelectorAll(".digit-inner");
  for (let i = 0; i < s.length; i++) {
    if (!d[i]) continue;
    d[i].className =
      lastUI[key][i] < s[i] ? "digit-inner digit-up" :
      lastUI[key][i] > s[i] ? "digit-inner digit-down" :
      "digit-inner neutral";
    d[i].innerText = s[i];
  }
  lastUI[key] = s;
}

/********************
 * ADDRESS
 ********************/
const addrInput = document.getElementById("addressInput");
addrInput.value = address;
addrInput.onchange = e => {
  address = e.target.value.trim();
  localStorage.setItem("inj_address", address);
  loadOnchainData();
};

/********************
 * ONCHAIN
 ********************/
async function loadOnchainData() {
  if (!address) return;

  const bal = await fetchJSON(
    `https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`
  );
  available = (bal.balances || [])
    .filter(b => b.denom === "inj")
    .reduce((s, b) => s + Number(b.amount), 0) / 1e18;

  const stakeRes = await fetchJSON(
    `https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`
  );
  staked = (stakeRes.delegation_responses || [])
    .reduce((s, d) => s + Number(d.balance.amount), 0) / 1e18;

  const rewardsRes = await fetchJSON(
    `https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`
  );
  let r = 0;
  rewardsRes.rewards?.forEach(rr =>
    rr.reward?.forEach(c => {
      if (c.denom === "inj") r += Number(c.amount);
    })
  );
  rewards = r / 1e18;
  lastRewardUpdate = Date.now();

  const infl = await fetchJSON(
    "https://lcd.injective.network/cosmos/mint/v1beta1/inflation"
  );
  const pool = await fetchJSON(
    "https://lcd.injective.network/cosmos/staking/v1beta1/pool"
  );
  const bonded = Number(pool.pool.bonded_tokens);
  const total = bonded + Number(pool.pool.not_bonded_tokens);
  apr = (Number(infl.inflation) / (bonded / total)) * 100;
  rewardRate = (staked * (apr / 100)) / (365 * 24 * 3600);
}

loadOnchainData();
setInterval(loadOnchainData, 60000);

/********************
 * PRICE HISTORY + CHART COLOR
 ********************/
async function loadPriceHistory() {
  const r = await fetch(
    "https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=1h&limit=24"
  );
  const d = await r.json();
  chartData = d.map(c => parseFloat(c[4]));
  price24hOpen = parseFloat(d[0][1]);
  drawChart();
}

function drawChart() {
  const up = displayPrice >= price24hOpen;
  const color = up ? "#22c55e" : "#ef4444";

  if (chart) chart.destroy();
  chart = new Chart(document.getElementById("priceChart"), {
    type: "line",
    data: {
      labels: chartData.map((_, i) => i),
      datasets: [{
        data: chartData,
        borderColor: color,
        backgroundColor: up
          ? "rgba(34,197,94,0.1)"
          : "rgba(239,68,68,0.1)",
        tension: 0.3,
        pointRadius: 0,
        fill: true
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { x: { display: false } }
    }
  });
}

loadPriceHistory();
setInterval(loadPriceHistory, 120000);

/********************
 * INJ WEBSOCKET
 ********************/
function connectWS() {
  const ws = new WebSocket(
    "wss://stream.binance.com:9443/ws/injusdt@trade"
  );
  ws.onmessage = e => {
    livePrice = parseFloat(JSON.parse(e.data).p);
    if (!displayPrice) displayPrice = livePrice;
  };
  ws.onclose = () => setTimeout(connectWS, 2000);
}
connectWS();

/********************
 * MARKET PRICES
 ********************/
async function loadMarketPrices() {
  for (let c of marketList) {
    try {
      if (c.symbol === "INJ") {
        c.price = livePrice;
        if (price24hOpen > 0)
          c.change24h = (c.price - price24hOpen) / price24hOpen * 100;
        continue;
      }

      const r = await fetch(
        `https://api.binance.com/api/v3/ticker/24hr?symbol=${c.symbol}USDT`
      );
      const d = await r.json();

      if (!d.code) {
        c.price = +d.lastPrice;
        c.change24h = +d.priceChangePercent;
        continue;
      }

      const cg = coingeckoMap[c.symbol];
      if (!cg) continue;

      const cr = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${cg}&vs_currencies=usd&include_24hr_change=true`
      );
      const cd = await cr.json();
      c.price = cd[cg].usd;
      c.change24h = cd[cg].usd_24h_change;
    } catch {}
  }
}

loadMarketPrices();
setInterval(loadMarketPrices, 60000);

/********************
 * MARKET TABLE (DIGITS)
 ********************/
function updateMarketTable() {
  const tbody = document.querySelector("#marketTable tbody");

  marketList.forEach(c => {
    c.displayPrice += (c.price - c.displayPrice) * 0.2;

    if (!marketUI[c.symbol]) {
      const tr = document.createElement("tr");
      const tdS = document.createElement("td");
      tdS.innerText = c.symbol;
      const tdP = document.createElement("td");
      tdP.dataset.fixed = 4;
      const tdC = document.createElement("td");

      tr.append(tdS, tdP, tdC);
      tbody.appendChild(tr);

      marketUI[c.symbol] = { priceEl: tdP, chgEl: tdC };
      createDigits(tdP, c.displayPrice);
    }

    updateDigits(
      marketUI[c.symbol].priceEl,
      "m_" + c.symbol,
      c.displayPrice
    );

    marketUI[c.symbol].chgEl.innerText =
      c.change24h.toFixed(2) + "%";
    marketUI[c.symbol].chgEl.className =
      c.change24h >= 0 ? "digit-up" : "digit-down";
  });
}

/********************
 * MAIN LOOP
 ********************/
const el = {
  price: document.getElementById("price"),
  priceDeltaPerc: document.getElementById("priceDeltaPerc"),
  priceDeltaUSD: document.getElementById("priceDeltaUSD"),
  stake: document.getElementById("stake"),
  available: document.getElementById("available"),
  rewards: document.getElementById("rewards"),
  availableUsd: document.getElementById("availableUsd"),
  stakeUsd: document.getElementById("stakeUsd"),
  rewardsUsd: document.getElementById("rewardsUsd"),
  apr: document.getElementById("apr"),
  updated: document.getElementById("updated")
};

function loop() {
  const now = Date.now();
  rewards += rewardRate * ((now - lastRewardUpdate) / 1000);
  lastRewardUpdate = now;

  if (livePrice > 0) {
    displayPrice += (livePrice - displayPrice) * 0.2;
    updateDigits(el.price, "price", displayPrice);

    if (price24hOpen > 0) {
      const dp = (displayPrice - price24hOpen) / price24hOpen * 100;
      el.priceDeltaPerc.innerText = dp.toFixed(2) + "%";
      el.priceDeltaPerc.className = "sub " + (dp >= 0 ? "digit-up" : "digit-down");

      const du = displayPrice - price24hOpen;
      el.priceDeltaUSD.innerText = "≈ $" + du.toFixed(4);
      el.priceDeltaUSD.className = "sub " + (du >= 0 ? "digit-up" : "digit-down");

      drawChart();
    }
  }

  displayStaked += (staked - displayStaked) * 0.2;
  updateDigits(el.stake, "stake", displayStaked);
  updateDigits(el.available, "available", available);
  updateDigits(el.rewards, "rewards", rewards);

  el.availableUsd.innerText = formatUSD(available * displayPrice);
  el.stakeUsd.innerText = formatUSD(displayStaked * displayPrice);
  el.rewardsUsd.innerText = formatUSD(rewards * displayPrice);
  el.apr.innerText = apr.toFixed(2) + "%";
  el.updated.innerText = "Last Update: " + new Date().toLocaleTimeString();

  updateMarketTable();
  requestAnimationFrame(loop);
}

loop();

