/********************
 * STATE
 ********************/
let address = localStorage.getItem("inj_address") || "";

let livePrice = 0, displayPrice = 0, price24hOpen = 0;
let available = 0, staked = 0, displayStaked = 0;
let rewards = 0, rewardRate = 0, lastRewardUpdate = Date.now();
let apr = 0;

let chart, chartData = [];

let lastUI = {
  price: "", available: "", stake: "", rewards: ""
};

/********************
 * MARKET LIST
 ********************/
const marketSymbols = [
  "INJ","BTC","ETH","BNB","SOL","KSM","DOT","LINK","AVAX","APT","SUI",
  "MNT","UNI","ATOM","EGLD","TIA","RUNE","BANANA","ILV","TAO","HYPE",
  "ASTER","AVNT","CAKE","PENDLE","KIMA","MET","RAY","PYTH","VIRTUAL",
  "JUP","JTO","KMNO","DRFIFT","OKB","BGB","KCS","GT"
];

const marketList = marketSymbols.map(s => ({
  symbol: s,
  price: 0,
  displayPrice: 0,
  change24h: 0
}));

const coingeckoMap = {
  BANANA: "banana-gun",
  HYPE: "hyperliquid",
  ASTER: "aster",
  AVNT: "aventure",
  KIMA: "kima-network",
  VIRTUAL: "virtual-protocol",
  DRFIFT: "drift-protocol"
};

/********************
 * UTILS
 ********************/
const fetchJSON = (url, timeout = 8000) =>
  Promise.race([
    fetch(url).then(r => r.json()),
    new Promise((_, rej) => setTimeout(() => rej("timeout"), timeout))
  ]);

const formatUSD = v => "≈ $" + v.toFixed(2);

function createDigits(el, value) {
  el.innerHTML = "";
  const s = value.toFixed(el.dataset.fixed || 4);
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

function updateDigits(el, key, value) {
  const s = value.toFixed(el.dataset.fixed || 4);
  if (!lastUI[key]) {
    createDigits(el, value);
    lastUI[key] = s;
    return;
  }
  const digits = el.querySelectorAll(".digit-inner");
  for (let i = 0; i < s.length; i++) {
    if (!digits[i]) continue;
    const old = lastUI[key][i];
    digits[i].className =
      old < s[i] ? "digit-inner digit-up" :
      old > s[i] ? "digit-inner digit-down" :
      "digit-inner neutral";
    digits[i].innerText = s[i];
  }
  lastUI[key] = s;
}

/********************
 * ADDRESS INPUT
 ********************/
const addrInput = document.getElementById("addressInput");
addrInput.value = address;
addrInput.addEventListener("change", async e => {
  address = e.target.value.trim();
  localStorage.setItem("inj_address", address);
  await loadOnchainData();
});

/********************
 * ONCHAIN DATA
 ********************/
async function loadOnchainData() {
  if (!address) return;
  try {
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

  } catch (e) {
    console.error("Onchain error:", e);
  }
}

loadOnchainData();
setInterval(loadOnchainData, 60000);

/********************
 * PRICE HISTORY 24H
 ********************/
async function loadPriceHistory() {
  try {
    const res = await fetch(
      "https://api.binance.com/api/v3/klines?symbol=INJUSDT&interval=1h&limit=24"
    );
    const data = await res.json();
    chartData = data.map(c => parseFloat(c[4]));
    price24hOpen = parseFloat(data[0][1]);
    drawChart();
  } catch (e) {
    console.error("Price history error:", e);
  }
}

function drawChart() {
  const ctx = document.getElementById("priceChart").getContext("2d");
  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: chartData.map((_, i) => i),
      datasets: [{
        data: chartData,
        borderColor: "#22c55e",
        borderWidth: 2,
        tension: 0.3,
        fill: true,
        backgroundColor: "rgba(34,197,94,0.1)",
        pointRadius: 0
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
 * MARKET PRICES (BINANCE + COINGECKO)
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
        c.price = parseFloat(d.lastPrice);
        c.change24h = parseFloat(d.priceChangePercent);
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
 * MARKET TABLE
 ********************/
function updateMarketTable() {
  const tbody = document.querySelector("#marketTable tbody");
  tbody.innerHTML = "";

  marketList.forEach(c => {
    c.displayPrice += (c.price - c.displayPrice) * 0.2;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.symbol}</td>
      <td>${c.displayPrice.toFixed(4)}</td>
      <td class="${c.change24h >= 0 ? "digit-up" : "digit-down"}">
        ${c.change24h.toFixed(2)}%
      </td>`;
    tbody.appendChild(tr);
  });
}

/********************
 * MAIN LOOP
 ********************/
function loop() {
  const now = Date.now();
  const dt = (now - lastRewardUpdate) / 1000;
  lastRewardUpdate = now;
  rewards += rewardRate * dt;

  if (livePrice > 0) {
    displayPrice += (livePrice - displayPrice) * 0.2;
    updateDigits(document.getElementById("price"), "price", displayPrice);
  }

  displayStaked += (staked - displayStaked) * 0.2;
  updateDigits(document.getElementById("stake"), "stake", displayStaked);
  updateDigits(document.getElementById("available"), "available", available);
  updateDigits(document.getElementById("rewards"), "rewards", rewards);

  document.getElementById("availableUsd").innerText = formatUSD(available * displayPrice);
  document.getElementById("stakeUsd").innerText = formatUSD(displayStaked * displayPrice);
  document.getElementById("rewardsUsd").innerText = formatUSD(rewards * displayPrice);

  document.getElementById("apr").innerText = apr.toFixed(2) + "%";
  document.getElementById("updated").innerText =
    "Last Update: " + new Date().toLocaleTimeString();

  updateMarketTable();
  requestAnimationFrame(loop);
}

loop();
