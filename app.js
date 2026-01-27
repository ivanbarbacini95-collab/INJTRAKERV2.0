body {
  font-family: "Inter", sans-serif;
  background: #000;
  color: #f9fafb;
  margin:0; padding:1rem;
}

h1 { text-align:center; margin-bottom:1rem; }

.header-row { display:flex; align-items:center; justify-content:space-between; }

.theme-btn { background:none; border:none; font-size:1.5rem; cursor:pointer; color:inherit; }

.container {
  max-width:600px;
  margin:0 auto;
  display:flex;
  flex-direction:column;
  gap:1rem;
}

.box {
  border:2px solid #4b5563;
  border-radius:0.6rem;
  padding:0.7rem 1rem;
  transition: all 0.25s ease;
}

.reward-box { border-color: #22c55e; }

.label { display:block; font-size:0.9rem; color:#9ca3af; margin-bottom:0.3rem; }
.value { font-size:1.5rem; font-weight:bold; display:inline-block; }
.sub { font-size:0.9rem; color:#9ca3af; }

.price-row { display:flex; justify-content:flex-start; align-items:center; gap:1rem; }
.sub-row { display:flex; justify-content:space-between; margin-top:0.2rem; }

.price-box { display:flex; justify-content:space-between; align-items:center; }
.price-box .value { font-size:2rem; }
.price-box .price-deltas { display:flex; flex-direction:column; text-align:right; gap:0.2rem; }

#addressInput {
  width:100%; padding:0.6rem 0.8rem; border-radius:0.5rem;
  border:2px solid #4b5563; background:#000; color:#f9fafb; font-size:1rem;
}
#addressInput:focus { outline:none; border-color:#38bdf8; box-shadow:0 0 10px rgba(56,189,248,0.3); }

canvas { max-width:100%; height:150px; }

.neutral { color:#f9fafb; }
.digit-up { color:#22c55e; }
.digit-down { color:#ef4444; }

.digit-wrapper { display:inline-block; position:relative; overflow:hidden; height:1em; }
.digit-inner { display:inline-block; transition: transform 0.3s ease, color 0.3s ease; }

@media (max-width:600px){ .value { font-size:1.2rem; } }

/* Tabella Market */
#marketTable { width:100%; border-collapse: collapse; margin-top:0.5rem; }
#marketTable th, #marketTable td { padding:0.3rem 0.5rem; text-align:center; border-bottom:1px solid #4b5563; font-size:0.9rem; }
#marketTable th { color:#9ca3af; font-weight:600; }
#marketTable td .digit-wrapper { display:inline-block; }
#marketTable td .digit-inner { transition: transform 0.2s, color 0.2s; }

tr.price-up { animation: flashGreen 0.5s; }
tr.price-down { animation: flashRed 0.5s; }

@keyframes flashGreen { 0% {background-color:#22c55e33;} 100% {background-color:transparent;} }
@keyframes flashRed { 0% {background-color:#ef444433;} 100% {background-color:transparent;} }

body.light { background:#f9fafb; color:#000; }
body.light input { background:#fff; color:#000; border-color:#9ca3af; }
body.light .box { border-color:#9ca3af; }
