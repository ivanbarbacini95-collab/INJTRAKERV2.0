/***********************
 * ELEMENTI DOM
 ***********************/
const priceEl = document.getElementById("price");
const price24hEl = document.getElementById("price24h");
const availableEl = document.getElementById("available");
const availableUsdEl = document.getElementById("availableUsd");
const stakeEl = document.getElementById("stake");
const stakeUsdEl = document.getElementById("stakeUsd");
const rewardsEl = document.getElementById("rewards");
const rewardsUsdEl = document.getElementById("rewardsUsd");
const aprEl = document.getElementById("apr");
const updatedEl = document.getElementById("updated");
const rewardBarEl = document.getElementById("rewardBar");
const addressInput = document.getElementById("addressInput");

/***********************
 * STATO
 ***********************/
let address = localStorage.getItem("inj_address") || "";
addressInput.value = address;

let targetPrice = 0;
let displayedPrice = 0;

let availableInj = 0, displayedAvailable = 0;
let stakeInj = 0, displayedStake = 0;
let rewardsInj = 0, displayedRewards = 0;

let apr = 0;

/***********************
 * UTILS
 ***********************/
const fetchJSON = url => fetch(url).then(r => r.json());
const formatUSD = v => "≈ $" + v.toFixed(2);

function updateNumber(el, oldV, newV, decimals) {
  if (!isFinite(newV)) return;
  el.classList.remove("up", "down");
  if (newV > oldV) el.classList.add("up");
  if (newV < oldV) el.classList.add("down");
  el.textContent = newV.toFixed(decimals);
}

/***********************
 * ADDRESS
 ***********************/
addressInput.onchange = e => {
  address = e.target.value.trim();
  localStorage.setItem("inj_address", address);
  loadData();
};

/***********************
 * LOAD DATA
 ***********************/
async function loadData() {
  if (!address) return;

  try {
    // BALANCE
    const bal = await fetchJSON(
      `https://lcd.injective.network/cosmos/bank/v1beta1/balances/${address}`
    );
    availableInj =
      (bal.balances?.find(b => b.denom === "inj")?.amount || 0) / 1e18;

    // STAKE
    const stake = await fetchJSON(
      `https://lcd.injective.network/cosmos/staking/v1beta1/delegations/${address}`
    );
    stakeInj =
      stake.delegation_responses?.reduce(
        (s, d) => s + Number(d.balance.amount),
        0
      ) / 1e18 || 0;

    // REWARDS (CORRETTO)
    const rew = await fetchJSON(
      `https://lcd.injective.network/cosmos/distribution/v1beta1/delegators/${address}/rewards`
    );
    rewardsInj =
      rew.rewards?.reduce(
        (sum, r) =>
          sum + r.reward.reduce((s, x) => s + Number(x.amount), 0),
        0
      ) / 1e18 || 0;

    // APR (CORRETTO)
    const inflation = await fetchJSON(
      `https://lcd.injective.network/cosmos/mint/v1beta1/inflation`
    );
    apr = Number(inflation.inflation) * 100;

  } catch (err) {
    console.error("Errore caricamento dati:", err);
  }
}

loadData();
setInterval(loadData, 60000);

/***********************
 * PRICE BINANCE
 ***********************/
function startWS() {
  const ws = new WebSocket(
    "wss://stream.binance.com:9443/ws/injusdt@trade"
  );
  ws.onmessage = e => {
    targetPrice = Number(JSON.parse(e.data).p);
  };
  ws.onclose = () => setTimeout(startWS, 3000);
}
startWS();

/***********************
 * ANIMAZIONE
 ***********************/
function animate() {
  // PRICE
  const prevP = displayedPrice;
  displayedPrice += (targetPrice - displayedPrice) * 0.08;
  updateNumber(priceEl, prevP, displayedPrice, 4);

  // AVAILABLE
  const prevA = displayedAvailable;
  displayedAvailable += (availableInj - displayedAvailable) * 0.08;
  updateNumber(availableEl, prevA, displayedAvailable, 6);
  availableUsdEl.textContent = formatUSD(displayedAvailable * displayedPrice);

  // STAKE
  const prevS = displayedStake;
  displayedStake += (stakeInj - displayedStake) * 0.08;
  updateNumber(stakeEl, prevS, displayedStake, 4);
  stakeUsdEl.textContent = formatUSD(displayedStake * displayedPrice);

  // REWARDS (scorrono sempre verso il valore reale)
  const prevR = displayedRewards;
  displayedRewards += (rewardsInj - displayedRewards) * 0.04;
  updateNumber(rewardsEl, prevR, displayedRewards, 7);
  rewardsUsdEl.textContent = formatUSD(displayedRewards * displayedPrice);

  // REWARD BAR (0 → 1 INJ)
  const perc = Math.min((displayedRewards / 1) * 100, 100);
  rewardBarEl.style.width = perc + "%";

  // APR
  aprEl.textContent = apr.toFixed(2) + "%";

  // UPDATE TIME
  updatedEl.textContent =
    "Last Update: " + new Date().toLocaleTimeString();

  requestAnimationFrame(animate);
}
animate();
