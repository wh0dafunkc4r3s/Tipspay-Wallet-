/*************************************************
 * TIPSPAY Web Wallet – FireFly
 *************************************************/

// === CONFIG ===
const API_URL = 'https://u0qm7yhexl-u0u5ffaky3-firefly-os.us0-aws-ws.kaleido.io';
const NAMESPACE = 'tipspay-corechain';
const POOL = 'ERC20NoData';
const DECIMALS = 6;

// === ROLE SYSTEM ===
const ROLES = {
  READ: 'read',
  WRITE: 'write',
  ADMIN: 'admin'
};

// değiştirerek test edebilirsin
let currentRole = ROLES.READ;

// === HELPERS ===
function formatToken(balance) {
  return Number(balance) / Math.pow(10, DECIMALS);
}

function fireflyUrl(path) {
  return `${API_URL}/api/v1/namespaces/${NAMESPACE}${path}`;
}

async function fireflyGet(path) {
  const res = await fetch(fireflyUrl(path));
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// === ROLE CHECK ===
function requireRole(role) {
  if (currentRole !== role && currentRole !== ROLES.ADMIN) {
    alert('Yetkin yok');
    return false;
  }
  return true;
}

// === BALANCES + TVL ===
async function loadPoolBalances() {
  const balances = await fireflyGet(`/tokens/balances?pool=${POOL}`);

  let html = '';
  let tvl = 0;

  balances.forEach(b => {
    const amount = formatToken(b.balance);
    const usd = amount; // USDT ≈ 1 USD
    tvl += usd;

    html += `
      <tr>
        <td>${b.address}</td>
        <td>${amount.toLocaleString()} USDT</td>
        <td>$${usd.toLocaleString()}</td>
      </tr>
    `;
  });

  document.getElementById('balancesBody').innerHTML = html;
  document.getElementById('tvl').textContent = `$${tvl.toLocaleString()}`;

  renderChart(balances);
}

// === POLLING ===
let poller = null;

function startPolling() {
  stopPolling();
  loadPoolBalances();
  loadTransfers();
  poller = setInterval(() => {
    loadPoolBalances();
    loadTransfers();
  }, 5000);
}

function stopPolling() {
  if (poller) clearInterval(poller);
}

// === CHART ===
let chart;

function renderChart(balances) {
  const labels = balances.map(b => b.address.slice(0, 8) + '...');
  const data = balances.map(b => formatToken(b.balance));

  if (chart) chart.destroy();

  chart = new Chart(document.getElementById('balanceChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'USDT Bakiye',
        data,
        backgroundColor: '#3b82f6'
      }]
    }
  });
}

// === TRANSFER HISTORY ===
async function loadTransfers() {
  const transfers = await fireflyGet(`/tokens/transfers?pool=${POOL}`);

  let html = '';

  transfers.forEach(tx => {
    html += `
      <tr>
        <td>${tx.from}</td>
        <td>${tx.to}</td>
        <td>${formatToken(tx.amount)} USDT</td>
        <td>${tx.status}</td>
      </tr>
    `;
  });

  document.getElementById('txBody').innerHTML = html;
}

// === TOKEN TRANSFER (WRITE ROLE) ===
async function sendTransfer(from, to, amount) {
  if (!requireRole(ROLES.WRITE)) return;

  const body = {
    pool: POOL,
    from,
    to,
    amount: String(amount * Math.pow(10, DECIMALS))
  };

  const res = await fetch(fireflyUrl('/tokens/transfers'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    alert(await res.text());
    return;
  }

  alert('Transfer gönderildi');
  loadTransfers();
}

// === CONTRACT INVOKE (ADMIN) ===
async function invokeContract(interfaceName, method, params) {
  if (!requireRole(ROLES.ADMIN)) return;

  const body = {
    interface: interfaceName,
    method,
    input: params
  };

  const res = await fetch(fireflyUrl('/contracts/invoke'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    alert(await res.text());
    return;
  }

  alert('Contract invoke gönderildi');
}

// === INIT ===
window.onload = () => {
  loadPoolBalances();
  loadTransfers();
};
