let address = localStorage.getItem("inj_address") || "";

let livePrice = 0, displayPrice = 0, price24hOpen = 0;
let available = 0, staked = 0, displayStaked = 0;
let rewards = 0, rewardRate = 0, lastRewardUpdate = Date.now();
let apr = 0;
let chart, chartData = [];

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

/* ---------- UTILS ---------- */

function createDigits(el, value) {
  el.innerHTML = "";
  const s = value.toFixed(4);
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

/* ---------- INJ LIVE ---------- */

function connectWS() {
  const ws = new WebSocket("wss://stream.binance.com:9443/ws/injusdt@trade");
  ws.onmessage = e => {
    livePrice = parseFloat(JSON.parse(e.data).p);
    if (!displayPrice) displayPrice = livePrice;
  };
  ws.onclose = () => setTimeout(connectWS, 2000);
}
connectWS();

/* ---------- MARKET PRICES ---------- */

async function loadMarketPrices() {
  for (let c of marketList) {
    try {
      if (c.symbol === "INJ") {
        c.price = livePrice;
        continue;
      }

      const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${c.symbol}USDT`);
      const data = await res.json();

      if (!data.code) {
        c.price = parseFloat(data.lastPrice);
        c.change24h = parseFloat(data.priceChangePercent);
        continue;
      }

      const cg = coingeckoMap[c.symbol];
      if (!cg) continue;

      const cgRes = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${cg}&vs_currencies=usd&include_24hr_change=true`
      );
      const cgData = await cgRes.json();
      c.price = cgData[cg].usd;
      c.change24h = cgData[cg].usd_24h_change;

    } catch {}
  }
}

loadMarketPrices();
setInterval(loadMarketPrices, 60000);

/* ---------- TABLE ---------- */

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

/* ---------- LOOP ---------- */

function loop() {
  updateMarketTable();
  document.getElementById("updated").innerText =
    "Last Update: " + new Date().toLocaleTimeString();
  requestAnimationFrame(loop);
}

loop();
