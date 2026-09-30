// --- Application Global State ---
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];
let financeChartInstance = null;
let editingTransactionId = null; // Tracks which transaction is currently being edited

// --- Cache Core UI DOM Target Nodes ---
const transactionForm = document.getElementById('transaction-form');
const descInputField = document.getElementById('desc');
const amountInputField = document.getElementById('amount');
const typeSelectField = document.getElementById('type');
const categorySelectField = document.getElementById('category');
const transactionHistoryTableBody = document.getElementById('transaction-list');
const csvExportButton = document.getElementById('export-btn');
const submitButton = transactionForm.querySelector('button[type="submit"]');

const totalBalanceDisplay = document.getElementById('total-balance');
const totalIncomeDisplay = document.getElementById('total-income');
const totalExpenseDisplay = document.getElementById('total-expense');

// --- Central Render & Calculation Controller ---
function updateFinancialDashboard() {
  let incomeAccumulator = 0;
  let expenseAccumulator = 0;
  
  const categoricalExpenseSplits = { Food: 0, Rent: 0, Entertainment: 0, Others: 0 };

  // 1. Process Totals & Distribution
  transactions.forEach(item => {
    if (item.type === 'income') {
      incomeAccumulator += item.amount;
    } else {
      expenseAccumulator += item.amount;
      if (categoricalExpenseSplits[item.category] !== undefined) {
        categoricalExpenseSplits[item.category] += item.amount;
      } else {
        categoricalExpenseSplits['Others'] += item.amount;
      }
    }
  });

  const netSavingsBalance = incomeAccumulator - expenseAccumulator;

  // 2. Refresh Metrics Labels Text
  totalBalanceDisplay.textContent = `₹${netSavingsBalance.toFixed(2)}`;
  totalIncomeDisplay.textContent = `₹${incomeAccumulator.toFixed(2)}`;
  totalExpenseDisplay.textContent = `₹${expenseAccumulator.toFixed(2)}`;
  
  // Shift colors depending on balance state
  totalBalanceDisplay.className = netSavingsBalance >= 0 ? "text-primary my-2" : "text-danger my-2";

  // 3. Populate Rows inside Data Log Elements
  transactionHistoryTableBody.innerHTML = '';
  
  if (transactions.length === 0) {
    transactionHistoryTableBody.innerHTML = `<tr><td colspan="4" class="text-muted text-center py-4">No active financial records found.</td></tr>`;
    csvExportButton.setAttribute('disabled', 'true');
  } else {
    csvExportButton.removeAttribute('disabled');
    transactions.forEach(record => {
      const rowItemNode = document.createElement('tr');
      const isRecordIncome = record.type === 'income';
      
      rowItemNode.innerHTML = `
        <td class="fw-semibold">${record.desc}</td>
        <td><span class="badge bg-secondary-subtle text-secondary-emphasis">${record.category}</span></td>
        <td class="text-end fw-bold ${isRecordIncome ? 'text-success' : 'text-danger'}">
          ${isRecordIncome ? '+' : '-'}₹${record.amount.toFixed(2)}
        </td>
        <td class="text-center">
          <!-- Edit Button Component -->
          <button class="btn btn-sm btn-outline-secondary border-0 me-1 text-secondary" style="background: transparent;" onclick="startEditingTransaction(${record.id})">
            ✏️
          </button>
          <!-- Delete Button Component -->
          <button class="delete-btn-action" style="background: transparent; border: none; color: #dc3545;" onclick="deleteTargetTransaction(${record.id})">
            🗑️
          </button>
        </td>
      `;
      transactionHistoryTableBody.appendChild(rowItemNode);
    });
  }

  // 4. Update Graphic Breakdown Panels & Persist Array Data
  renderDistributionChart(categoricalExpenseSplits);
  localStorage.setItem('transactions', JSON.stringify(transactions));
}

// --- Event Dispatches & Action Mutators ---
function handleFormSubmit(event) {
  event.preventDefault();
  
  const descValue = descInputField.value.trim();
  const amountValue = parseFloat(amountInputField.value);
  const typeValue = typeSelectField.value;
  const categoryValue = typeValue === 'income' ? 'Salary' : categorySelectField.value;

  if (editingTransactionId !== null) {
    // UPDATE MODE: Locate the target index and overwrite its record properties
    const targetIndex = transactions.findIndex(item => item.id === editingTransactionId);
    if (targetIndex !== -1) {
      transactions[targetIndex].desc = descValue;
      transactions[targetIndex].amount = amountValue;
      transactions[targetIndex].type = typeValue;
      transactions[targetIndex].category = categoryValue;
    }
    // Clear editing context states
    editingTransactionId = null;
    submitButton.textContent = "Add Transaction";
    submitButton.className = "btn px-4"; 
  } else {
    // CREATE MODE: Insert new entry block
    const payload = {
      id: Date.now(),
      desc: descValue,
      amount: amountValue,
      type: typeValue,
      category: categoryValue
    };
    transactions.unshift(payload);
  }

  updateFinancialDashboard();
  transactionForm.reset();
  categorySelectField.removeAttribute('disabled');
}

// --- Edit Target Loader Engine ---
function startEditingTransaction(targetId) {
  const transactionToEdit = transactions.find(item => item.id === targetId);
  if (!transactionToEdit) return;

  // 1. Store operational context ID pointers globally
  editingTransactionId = targetId;

  // 2. Hydrate input fields interface matching model values
  descInputField.value = transactionToEdit.desc;
  amountInputField.value = transactionToEdit.amount;
  typeSelectField.value = transactionToEdit.type;
  
  if (transactionToEdit.type === 'income') {
    categorySelectField.value = 'Salary';
    categorySelectField.setAttribute('disabled', 'true');
  } else {
    categorySelectField.removeAttribute('disabled');
    categorySelectField.value = transactionToEdit.category;
  }

  // 3. Transition UI Submit buttons into highlighted confirmation save states
  submitButton.textContent = "⚙️ Update Transaction";
  submitButton.className = "btn btn-success px-4 text-white";
  
  // Bring window view attention upwards focus on editing panel input elements
  descInputField.focus();
}

function deleteTargetTransaction(targetId) {
  // If the item currently being edited gets deleted, reset the form state context cleanly
  if (editingTransactionId === targetId) {
    editingTransactionId = null;
    submitButton.textContent = "Add Transaction";
    submitButton.className = "btn px-4";
    transactionForm.reset();
    categorySelectField.removeAttribute('disabled');
  }
  
  transactions = transactions.filter(item => item.id !== targetId);
  updateFinancialDashboard();
}

// --- CSV Spreadsheet Generator Module ---
function generateDataSpreadsheet() {
  if (transactions.length === 0) return;

  const standardHeaders = ['Description', 'Category', 'Type', 'Amount (INR)'];
  const formattedRowStrings = transactions.map(t => [
    `"${t.desc.replace(/"/g, '""')}"`,
    `"${t.category}"`,
    `"${t.type.toUpperCase()}"`,
    t.amount.toFixed(2)
  ]);

  const outputCsvBlobString = [standardHeaders.join(','), ...formattedRowStrings.map(r => r.join(','))].join('\n');
  const systemDataBlob = new Blob([outputCsvBlobString], { type: 'text/csv;charset=utf-8;' });
  
  const triggerUrl = URL.createObjectURL(systemDataBlob);
  const hiddenDownloadAnchorNode = document.createElement("a");
  
  hiddenDownloadAnchorNode.setAttribute("href", triggerUrl);
  hiddenDownloadAnchorNode.setAttribute("download", `financial_ledger_${new Date().toISOString().slice(0,10)}.csv`);
  hiddenDownloadAnchorNode.style.visibility = 'hidden';
  
  document.body.appendChild(hiddenDownloadAnchorNode);
  hiddenDownloadAnchorNode.click();
  document.body.removeChild(hiddenDownloadAnchorNode);
}

// --- Dynamic Chart.js Rendering Logic ---
function renderDistributionChart(datasetMetrics) {
  const chartCanvasElement = document.getElementById('expenseChart');
  if (!chartCanvasElement) return;

  const context2D = chartCanvasElement.getContext('2d');
  const targetSplitValuesArray = [datasetMetrics.Food, datasetMetrics.Rent, datasetMetrics.Entertainment, datasetMetrics.Others];
  const validationCheckHasExpenses = targetSplitValuesArray.some(val => val > 0);

  if (typeof Chart === 'undefined') return;

  const payloadConfiguration = {
    type: 'doughnut',
    data: {
      labels: ['Food & Dining', 'Rent & Utilities', 'Entertainment', 'Others'],
      datasets: [{
        data: validationCheckHasExpenses ? targetSplitValuesArray :[1],
        backgroundColor: validationCheckHasExpenses 
          ? ['#ffc107', '#0dcaf0', '#fd7e14', '#6c757d'] 
          : ['#e9ecef'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' },
        tooltip: { enabled: validationCheckHasExpenses }
      }
    }
  };

  if (financeChartInstance) {
    financeChartInstance.destroy();
  }
  financeChartInstance = new Chart(context2D, payloadConfiguration);
}

// --- System Core Interactivity Wireframes & Hook Binding ---
transactionForm.addEventListener('submit', handleFormSubmit);
csvExportButton.addEventListener('click', generateDataSpreadsheet);

typeSelectField.addEventListener('change', () => {
  if (typeSelectField.value === 'income') {
    categorySelectField.value = 'Salary';
    categorySelectField.setAttribute('disabled', 'true');
  } else {
    categorySelectField.value = 'Food';
    categorySelectField.removeAttribute('disabled');
  }
});

// Bootstrap Initial Setup Execution
updateFinancialDashboard();
